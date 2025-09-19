import ivm from 'isolated-vm'
import { SierraDBClient } from './sierradb.js'
import { ProjectionProgress, SierraDBEvent } from './types.js'
import { processEventFields } from './binaryUtils.js'

export class ProjectionEngine {
  private sierraDB: SierraDBClient
  private abortController: AbortController | null = null
  private useNativeExecution: boolean = false // Option for maximum performance
  private batchSize: number = 200 // Optimal batch size for VM processing
  private maxConcurrentPartitions: number = 6 // Concurrency limit
  
  // Memory optimization: reusable objects and caching
  private eventProcessingCache = new Map<string, any>()
  private isolateCache: ivm.Isolate | null = null
  private contextCache: ivm.Context | null = null
  private compiledScriptsCache = new Map<string, any>()

  constructor(sierraDB: SierraDBClient, useNativeExecution: boolean = false, batchSize: number = 200) {
    this.sierraDB = sierraDB
    this.useNativeExecution = useNativeExecution
    this.batchSize = batchSize
  }

  async runProjection(
    code: string,
    initialState: any = null,
    onProgress: (progress: ProjectionProgress) => void,
    streamId?: string
  ): Promise<void> {
    this.abortController = new AbortController()
    let currentState = initialState
    let eventsProcessed = 0
    let isolate: ivm.Isolate | null = null

    try {
      // Create or reuse isolated VM context with optimized memory settings
      isolate = this.isolateCache || new ivm.Isolate({ memoryLimit: 512 }) // Reasonable memory limit for stability
      const context = this.contextCache || await isolate.createContext()
      
      // Cache for reuse
      if (!this.isolateCache) {
        this.isolateCache = isolate
        this.contextCache = context
      }

      // Prepare the projection function in the isolated context
      const jail = context.global
      await jail.set('global', jail.derefInto())

      // Compile the user's projection code with batch support (use cache if available)
      const codeHash = this.hashCode(code)
      let script = this.compiledScriptsCache.get(`main_${codeHash}`)
      
      if (!script) {
        script = await isolate.compileScript(`
          ${code}
          
          // Export both single event and batch functions
          if (typeof project === 'function') {
            global.projectFunction = project;
            // Create optimized batch processor
            global.projectBatch = function(state, events) {
              for (let i = 0; i < events.length; i++) {
                state = project(state, events[i]);
              }
              return state;
            };
          } else {
            throw new Error('No project function defined');
          }
        `)
        this.compiledScriptsCache.set(`main_${codeHash}`, script)
      }
      
      await script.run(context)

      // Compile both single and batch execution scripts (use cache if available)
      let executionScript = this.compiledScriptsCache.get('execution_single')
      if (!executionScript) {
        executionScript = await isolate.compileScript(`
          // Parse JSON strings into objects (use var to allow redeclaration)
          var currentState = JSON.parse(currentStateJson);
          var currentEvent = JSON.parse(currentEventJson);
          
          // Execute user's projection function
          var result = global.projectFunction(currentState, currentEvent);
          
          // Return stringified result
          JSON.stringify(result);
        `)
        this.compiledScriptsCache.set('execution_single', executionScript)
      }
      
      let batchExecutionScript = this.compiledScriptsCache.get('execution_batch')
      if (!batchExecutionScript) {
        batchExecutionScript = await isolate.compileScript(`
          // Parse JSON strings into objects
          var currentState = JSON.parse(currentStateJson);
          var eventBatch = JSON.parse(eventBatchJson);
          
          // Execute batch projection function
          var result = global.projectBatch(currentState, eventBatch);
          
          // Return stringified result
          JSON.stringify(result);
        `)
        this.compiledScriptsCache.set('execution_batch', batchExecutionScript)
      }

      if (streamId) {
        // Stream-specific projection
        currentState = await this.processStream(
          streamId,
          currentState,
          context,
          executionScript,
          (newState, newEventsProcessed, currentVersion, totalVersions) => {
            eventsProcessed += newEventsProcessed
            
            onProgress({
              current_partition: currentVersion,
              total_partitions: totalVersions || currentVersion,
              events_processed: eventsProcessed,
              current_state: newState,
              status: 'running',
            })
          }
        )

        // Send final completion progress for stream
        onProgress({
          current_partition: eventsProcessed,
          total_partitions: eventsProcessed,
          events_processed: eventsProcessed,
          current_state: currentState,
          status: 'completed',
        })
      } else {
        // All events projection (original behavior)
        const serverInfo = await this.sierraDB.hello()
        const totalPartitions = serverInfo.num_partitions

        // Process partitions in parallel batches
        console.log(`Processing ${totalPartitions} partitions with batch size ${this.batchSize} and ${this.maxConcurrentPartitions} concurrent partitions`)
        const startTime = Date.now()
        
        // Process partitions in parallel groups
        for (let startPartition = 0; startPartition < totalPartitions; startPartition += this.maxConcurrentPartitions) {
          if (this.abortController?.signal.aborted) {
            console.log(`Projection aborted at partition ${startPartition}/${totalPartitions}`)
            break
          }
          
          const endPartition = Math.min(startPartition + this.maxConcurrentPartitions, totalPartitions)
          const partitionPromises: Promise<{ partition: number, newState: any, eventsProcessed: number, duration: number }>[] = []
          
          // Start parallel partition processing
          for (let partition = startPartition; partition < endPartition; partition++) {
            // CRITICAL FIX: Create separate context for each parallel partition to avoid race conditions
            const partitionContext = await isolate.createContext()
            
            // Set up the partition context with the same globals as the main context
            const jail = partitionContext.global
            await jail.set('global', jail.derefInto())
            await script.run(partitionContext)
            
            const partitionPromise = this.processPartitionOptimized(
              partition,
              null, // Each partition starts fresh to avoid double-counting
              partitionContext,
              batchExecutionScript,
              executionScript
            )
            partitionPromises.push(partitionPromise)
          }
          
          // Wait for all partitions in this batch to complete
          const results = await Promise.all(partitionPromises)
          
          // Clean up partition contexts to prevent memory leaks
          // Note: contexts will be cleaned up when the isolate is disposed
          
          // Merge results sequentially to maintain state consistency
          for (const result of results) {
            // CRITICAL FIX: Accumulate state instead of overwriting
            const previousEventCount = currentState?.eventCount || 0
            currentState = this.accumulateState(currentState, result.newState)
            eventsProcessed += result.eventsProcessed
            
            // Debug logging for state accumulation
            const newEventCount = currentState?.eventCount || 0
            const partitionEventCount = result.newState?.eventCount || 0
            console.log(`Partition ${result.partition}: added ${partitionEventCount} events, total eventCount ${previousEventCount} -> ${newEventCount} (+${result.eventsProcessed} events processed)`)
            
            if (result.duration > 100) {
              console.log(`Partition ${result.partition} took ${result.duration}ms`)
            }
            
            onProgress({
              current_partition: result.partition,
              total_partitions: totalPartitions,
              events_processed: eventsProcessed,
              current_state: currentState,
              status: 'running',
            })
          }
        }
        
        const totalTime = Date.now() - startTime
        const finalEventCount = currentState?.eventCount || 0
        console.log(`Completed projection in ${totalTime}ms, processed ${eventsProcessed} events, projection eventCount: ${finalEventCount}`)
        
        if (finalEventCount !== eventsProcessed) {
          console.log(`FINAL DISCREPANCY: processed ${eventsProcessed} events but final eventCount is ${finalEventCount} (difference: ${finalEventCount - eventsProcessed})`)
        }

        // Send final completion progress
        onProgress({
          current_partition: totalPartitions,
          total_partitions: totalPartitions,
          events_processed: eventsProcessed,
          current_state: currentState,
          status: 'completed',
        })
      }

    } catch (error) {
      console.error('Projection error:', error)
      
      onProgress({
        current_partition: 0,
        total_partitions: 0,
        events_processed: eventsProcessed,
        current_state: currentState,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      // Cleanup only if not cached (for reuse optimization)
      if (isolate && isolate !== this.isolateCache) {
        try {
          isolate.dispose()
        } catch (cleanupError) {
          console.error('Error cleaning up isolate:', cleanupError)
        }
      }
    }
  }

  private async processPartition(
    partition: number,
    initialState: any,
    context: ivm.Context,
    executionScript: any,
    onBatchProgress: (newState: any, eventsProcessed: number) => void
  ): Promise<any> {
    let startSequence = 0
    let currentState = initialState
    let hasMore = true
    const batchSize = 1000 // Maximum batch size for unrestricted performance

    while (hasMore && !this.abortController?.signal.aborted) {
      try {
        const result = await this.sierraDB.scanPartition({
          partition,
          start_sequence: startSequence,
          end_sequence: '+',
          count: batchSize,
        })

        hasMore = result.has_more
        
        if (result.events.length === 0) {
          break
        }

        // Process events through the projection function
        for (const event of result.events) {
          if (this.abortController?.signal.aborted) {
            console.log(`Projection aborted at partition ${partition}`)
            break
          }

          try {
            // Execute projection function in isolated context
            currentState = await this.executeProjectionFunction(context, executionScript, currentState, event)
          } catch (error) {
            console.error(`Error processing event ${event.event_id}:`, error)
            // Continue with next event on error - but count failures
          }
        }

        onBatchProgress(currentState, result.events.length)

        // Update start sequence for next batch
        if (hasMore && result.events.length > 0) {
          const lastEvent = result.events[result.events.length - 1]
          startSequence = lastEvent.partition_sequence + 1
        }

      } catch (error) {
        console.error(`Error scanning partition ${partition}:`, error)
        break
      }
    }
    
    return currentState
  }

  private async processPartitionOptimized(
    partition: number,
    initialState: any,
    context: ivm.Context,
    batchExecutionScript: any,
    singleExecutionScript: any
  ): Promise<{ partition: number, newState: any, eventsProcessed: number, duration: number }> {
    const startTime = Date.now()
    let startSequence = 0
    let currentState = initialState
    let hasMore = true
    let eventsProcessed = 0
    const dbBatchSize = 1000 // Database batch size

    while (hasMore && !this.abortController?.signal.aborted) {
      try {
        const result = await this.sierraDB.scanPartition({
          partition,
          start_sequence: startSequence,
          end_sequence: '+',
          count: dbBatchSize,
        })

        hasMore = result.has_more
        
        if (result.events.length === 0) {
          break
        }

        // Process events in optimized batches
        const events = result.events
        const processingBatches = []
        
        // Split database batch into smaller processing batches
        for (let i = 0; i < events.length; i += this.batchSize) {
          const batchEvents = events.slice(i, i + this.batchSize)
          processingBatches.push(batchEvents)
        }

        // Process each batch through VM
        for (const batch of processingBatches) {
          if (this.abortController?.signal.aborted) {
            break
          }

          try {
            if (batch.length === 1) {
              // Use single event processing for batches of 1
              currentState = await this.executeProjectionFunction(context, singleExecutionScript, currentState, batch[0])
              eventsProcessed += batch.length
            } else {
              // Use batch processing for larger batches
              currentState = await this.executeBatchProjectionFunction(context, batchExecutionScript, currentState, batch)
              eventsProcessed += batch.length
            }
          } catch (error) {
            console.error(`Partition ${partition}: Batch processing failed, falling back to individual processing for ${batch.length} events:`, error)
            // Process events individually as fallback (don't double-count)
            for (const event of batch) {
              try {
                currentState = await this.executeProjectionFunction(context, singleExecutionScript, currentState, event)
                eventsProcessed++
              } catch (singleError) {
                console.error(`Error processing event ${event.event_id}:`, singleError)
                // Still count events that failed processing for accurate tracking
                eventsProcessed++
              }
            }
          }
        }

        // Update start sequence for next batch
        if (hasMore && events.length > 0) {
          const lastEvent = events[events.length - 1]
          startSequence = lastEvent.partition_sequence + 1
        }

      } catch (error) {
        console.error(`Error scanning partition ${partition}:`, error)
        break
      }
    }
    
    const duration = Date.now() - startTime
    const projectionEventCount = currentState?.eventCount || 0
    
    // Log if there's a discrepancy between events processed and projection count
    if (projectionEventCount !== eventsProcessed) {
      console.log(`Partition ${partition}: DISCREPANCY - processed ${eventsProcessed} events but projection eventCount is ${projectionEventCount}`)
    }
    
    return { partition, newState: currentState, eventsProcessed, duration }
  }

  private async processStream(
    streamId: string,
    initialState: any,
    context: ivm.Context,
    executionScript: any,
    onBatchProgress: (newState: any, eventsProcessed: number, currentVersion: number, totalVersions?: number) => void
  ): Promise<any> {
    let startVersion = 0
    let currentState = initialState
    let hasMore = true
    let currentVersion = 0
    const batchSize = 1000 // Maximum batch size for unrestricted performance

    while (hasMore && !this.abortController?.signal.aborted) {
      try {
        const result = await this.sierraDB.scanStream({
          stream_id: streamId,
          start_version: startVersion,
          end_version: '+',
          count: batchSize,
        })

        hasMore = result.has_more
        
        if (result.events.length === 0) {
          break
        }

        // Process events through the projection function
        for (const event of result.events) {
          if (this.abortController?.signal.aborted) {
            break
          }

          try {
            // Execute projection function in isolated context
            currentState = await this.executeProjectionFunction(context, executionScript, currentState, event)
            currentVersion = event.stream_version
          } catch (error) {
            console.error(`Error processing event ${event.event_id}:`, error)
            // Continue with next event on error
          }
        }

        onBatchProgress(currentState, result.events.length, currentVersion)

        // Update start version for next batch
        if (hasMore && result.events.length > 0) {
          const lastEvent = result.events[result.events.length - 1]
          startVersion = lastEvent.stream_version + 1
        }

      } catch (error) {
        console.error(`Error scanning stream ${streamId}:`, error)
        break
      }
    }
    
    return currentState
  }

  private safeParseJSON(jsonString: string | null): any {
    if (!jsonString) return null
    
    try {
      return JSON.parse(jsonString)
    } catch (error) {
      console.warn('Failed to parse JSON in projection:', error)
      return jsonString // Return the raw string if parsing fails
    }
  }

  private processEventForProjection(event: SierraDBEvent): any {
    // Use cache for repeated event processing
    const cacheKey = `${event.event_id}`
    if (this.eventProcessingCache.has(cacheKey)) {
      return this.eventProcessingCache.get(cacheKey)
    }
    
    // Create a clean event object for the projection with processed data
    const processedEvent = {
      // Basic event properties (already converted from Buffers in sierradb.ts)
      event_id: event.event_id,
      partition_key: event.partition_key,
      partition_id: event.partition_id,
      transaction_id: event.transaction_id,
      partition_sequence: event.partition_sequence,
      stream_version: event.stream_version,
      timestamp: event.timestamp,
      stream_id: event.stream_id,
      event_name: event.event_name,
      
      // Process metadata - use parsed version if available, otherwise try to parse the raw string
      metadata: event.metadata_parsed || this.safeParseJSON(event.metadata),
      
      // Process payload - use parsed version if available, otherwise try to parse the raw string  
      payload: event.payload_parsed || this.safeParseJSON(event.payload),
      
      // Include encoding information for reference
      metadata_encoding: event.metadata_encoding,
      payload_encoding: event.payload_encoding,
    }

    // Cache processed event (limit cache size to prevent memory leaks)
    if (this.eventProcessingCache.size < 1000) {
      this.eventProcessingCache.set(cacheKey, processedEvent)
    }

    return processedEvent
  }

  private async executeProjectionFunction(
    context: ivm.Context,
    executionScript: any,
    state: any,
    event: SierraDBEvent
  ): Promise<any> {
    try {
      // Process the event to make it projection-friendly
      const processedEvent = this.processEventForProjection(event)
      
      // PERFORMANCE OPTIMIZATION: Use JSON for data transfer instead of ExternalCopy
      // This is much faster for frequent operations
      const stateJson = JSON.stringify(state)
      const eventJson = JSON.stringify(processedEvent)
      
      // Set the JSON strings in the context (much faster than ExternalCopy)
      await context.global.set('currentStateJson', stateJson)
      await context.global.set('currentEventJson', eventJson)

      // Execute optimized script with no timeout restrictions for maximum performance
      const resultString = await executionScript.run(context) // Removed timeout completely
      
      // Parse the JSON result back to an object
      if (resultString && typeof resultString === 'string') {
        try {
          return JSON.parse(resultString)
        } catch (parseError) {
          console.error('Error parsing projection result JSON:', parseError)
          return state
        }
      }
      
      // Fallback to original state if no valid result
      return state

    } catch (error) {
      console.error('Error executing projection function:', error)
      return state // Return unchanged state on error
    }
  }

  private async executeBatchProjectionFunction(
    context: ivm.Context,
    batchExecutionScript: any,
    state: any,
    events: SierraDBEvent[]
  ): Promise<any> {
    try {
      // Process all events in the batch
      const processedEvents = events.map(event => this.processEventForProjection(event))
      
      // Use JSON for batch data transfer
      const stateJson = JSON.stringify(state)
      const eventBatchJson = JSON.stringify(processedEvents)
      
      // Set the JSON strings in the context
      await context.global.set('currentStateJson', stateJson)
      await context.global.set('eventBatchJson', eventBatchJson)

      // Execute batch processing script
      const resultString = await batchExecutionScript.run(context)
      
      // Parse the JSON result back to an object
      if (resultString && typeof resultString === 'string') {
        try {
          return JSON.parse(resultString)
        } catch (parseError) {
          console.error('Error parsing batch projection result JSON:', parseError)
          return state
        }
      }
      
      return state

    } catch (error) {
      console.error('Error executing batch projection function:', error)
      return state
    }
  }

  abort(): void {
    console.log('Aborting projection...')
    this.abortController?.abort()
  }

  private accumulateState(baseState: any, newState: any): any {
    if (!baseState) return newState
    if (!newState) return baseState
    
    // Handle arrays specially - concatenate them instead of overwriting
    if (Array.isArray(baseState) && Array.isArray(newState)) {
      return [...baseState, ...newState]
    }
    
    // If one is array and other isn't, prioritize the array
    if (Array.isArray(newState)) return newState
    if (Array.isArray(baseState)) return baseState
    
    // Handle null or primitive values
    if (typeof newState !== 'object' || newState === null) {
      return newState
    }
    if (typeof baseState !== 'object' || baseState === null) {
      return newState
    }
    
    // Deep merge objects
    const result = { ...baseState }
    
    for (const [key, value] of Object.entries(newState)) {
      if (key in result) {
        const baseValue = result[key]
        
        // If both are numbers, add them (for counters like eventCount)
        if (typeof baseValue === 'number' && typeof value === 'number') {
          result[key] = baseValue + value
        }
        // If both are arrays, concatenate them
        else if (Array.isArray(baseValue) && Array.isArray(value)) {
          result[key] = [...baseValue, ...value]
        }
        // If both are objects, recursively merge
        else if (typeof baseValue === 'object' && typeof value === 'object' && 
                 baseValue !== null && value !== null && 
                 !Array.isArray(baseValue) && !Array.isArray(value)) {
          result[key] = this.accumulateState(baseValue, value)
        }
        // For other types, use the new value (latest wins)
        else {
          result[key] = value
        }
      } else {
        // New property, just add it
        result[key] = value
      }
    }
    
    return result
  }

  private hashCode(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  dispose(): void {
    // Clean up cached resources
    this.eventProcessingCache.clear()
    this.compiledScriptsCache.clear()
    
    if (this.contextCache) {
      try {
        this.contextCache = null
      } catch (error) {
        console.error('Error disposing context cache:', error)
      }
    }
    
    if (this.isolateCache) {
      try {
        this.isolateCache.dispose()
        this.isolateCache = null
      } catch (error) {
        console.error('Error disposing isolate cache:', error)
      }
    }
  }
}
