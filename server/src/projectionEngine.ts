import ivm from 'isolated-vm'
import { SierraDBClient } from './sierradb.js'
import { ProjectionProgress, SierraDBEvent } from './types.js'

export class ProjectionEngine {
  private sierraDB: SierraDBClient
  private abortController: AbortController | null = null

  constructor(sierraDB: SierraDBClient) {
    this.sierraDB = sierraDB
  }

  async runProjection(
    code: string,
    initialState: any = null,
    onProgress: (progress: ProjectionProgress) => void
  ): Promise<void> {
    this.abortController = new AbortController()
    let currentState = initialState
    let eventsProcessed = 0

    try {
      // Get server info to determine total partitions
      const serverInfo = await this.sierraDB.hello()
      const totalPartitions = serverInfo.num_partitions

      // Create isolated VM context
      const isolate = new ivm.Isolate({ memoryLimit: 128 }) // 128MB limit
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

      // Compile the execution script once for reuse
      const executionScript = await isolate.compileScript(`
        JSON.stringify(global.projectFunction(currentState, currentEvent));
      `)

      // Process each partition sequentially
      for (let partition = 0; partition < totalPartitions; partition++) {
        if (this.abortController?.signal.aborted) {
          break
        }

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
        } catch (error) {
          console.error(`Error processing partition ${partition}:`, error)
          // Continue with next partition on error
        }
      }

      // Send final completion progress
      onProgress({
        current_partition: totalPartitions,
        total_partitions: totalPartitions,
        events_processed: eventsProcessed,
        current_state: currentState,
        status: 'completed',
      })

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
    const batchSize = 100

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
            break
          }

          try {
            // Execute projection function in isolated context
            currentState = await this.executeProjectionFunction(context, executionScript, currentState, event)
          } catch (error) {
            console.error(`Error processing event ${event.event_id}:`, error)
            // Continue with next event on error
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

  private async executeProjectionFunction(
    context: ivm.Context,
    executionScript: any,
    state: any,
    event: SierraDBEvent
  ): Promise<any> {
    try {
      // Pass state and event to the isolated context
      await context.global.set('currentState', new ivm.ExternalCopy(state).copyInto())
      await context.global.set('currentEvent', new ivm.ExternalCopy(event).copyInto())

      // Execute the pre-compiled script
      const resultString = await executionScript.run(context, { timeout: 1000 }) // 1 second timeout per event
      
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
    this.abortController?.abort()
  }
}