import ivm from 'isolated-vm'
import { SierraDBClient } from './sierradb.js'
import { ProjectionProgress, SierraDBEvent } from './types.js'
import { processEventFields } from './binaryUtils.js'

export class ProjectionEngine {
  private sierraDB: SierraDBClient
  private abortController: AbortController | null = null
  private useNativeExecution: boolean = false // Option for maximum performance

  constructor(sierraDB: SierraDBClient, useNativeExecution: boolean = false) {
    this.sierraDB = sierraDB
    this.useNativeExecution = useNativeExecution
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
      // Create isolated VM context with no memory limits for maximum performance
      isolate = new ivm.Isolate() // Removed memory limit - use system memory freely
      const context = await isolate.createContext()

      // Prepare the projection function in the isolated context
      const jail = context.global
      await jail.set('global', jail.derefInto())

      // Compile the user's projection code
      const script = await isolate.compileScript(`
        ${code}
        
        // Export the project function
        if (typeof project === 'function') {
          global.projectFunction = project;
        } else {
          throw new Error('No project function defined');
        }
      `)
      
      await script.run(context)

      // Compile the execution script once for reuse - optimized for JSON transfer
      const executionScript = await isolate.compileScript(`
        // Parse JSON strings into objects (use var to allow redeclaration)
        var currentState = JSON.parse(currentStateJson);
        var currentEvent = JSON.parse(currentEventJson);
        
        // Execute user's projection function
        var result = global.projectFunction(currentState, currentEvent);
        
        // Return stringified result
        JSON.stringify(result);
      `)

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

        // Process each partition sequentially  
        console.log(`Processing ${totalPartitions} partitions with batch size ${1000}`)
        const startTime = Date.now()
        
        for (let partition = 0; partition < totalPartitions; partition++) {
          if (this.abortController?.signal.aborted) {
            console.log(`Projection aborted at partition ${partition}/${totalPartitions}`)
            break
          }

          const partitionStartTime = Date.now()
          try {
            currentState = await this.processPartition(
              partition, 
              currentState, 
              context,
              executionScript, 
              (newState, newEventsProcessed) => {
                eventsProcessed += newEventsProcessed
                
                onProgress({
                  current_partition: partition,
                  total_partitions: totalPartitions,
                  events_processed: eventsProcessed,
                  current_state: newState,
                  status: 'running',
                })
              }
            )
            
            const partitionTime = Date.now() - partitionStartTime
            if (partitionTime > 100) { // Log slow partitions
              console.log(`Partition ${partition} took ${partitionTime}ms`)
            }
          } catch (error) {
            console.error(`Error processing partition ${partition}:`, error)
            // Continue with next partition on error
          }
        }
        
        const totalTime = Date.now() - startTime
        console.log(`Completed projection in ${totalTime}ms, processed ${eventsProcessed} events`)

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
      // Always clean up resources
      try {
        isolate?.dispose()
      } catch (cleanupError) {
        console.error('Error cleaning up isolate:', cleanupError)
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

  abort(): void {
    console.log('Aborting projection...')
    this.abortController?.abort()
  }
}