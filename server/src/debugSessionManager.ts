import ivm from 'isolated-vm'
import { v4 as uuidv4 } from 'uuid'
import { SierraDBClient } from './sierradb.js'
import { SierraDBEvent, DebugSessionStatus } from './types.js'

interface ConsoleLog {
  timestamp: number
  level: 'log' | 'warn' | 'error'
  message: string
}

interface DebugSession {
  id: string
  code: string
  isolate: ivm.Isolate
  context: ivm.Context
  executionScript: any
  
  // Event processing state
  events: SierraDBEvent[]
  currentEventIndex: number
  currentPartition: number
  totalPartitions: number
  
  // Projection state
  currentState: any
  previousState: any
  initialState: any
  
  // Debug state
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  consoleLogs: ConsoleLog[]
  error?: string
  
  // Session management
  lastAccessed: number
}

export class DebugSessionManager {
  private sessions: Map<string, DebugSession> = new Map()
  private sierraDB: SierraDBClient
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

  constructor(sierraDB: SierraDBClient) {
    this.sierraDB = sierraDB
    // Clean up expired sessions every 10 minutes
    setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000)
  }

  async createSession(code: string, initialState: any = null, streamId?: string): Promise<string> {
    const sessionId = uuidv4()
    
    try {
      // Get server info to determine total partitions
      const serverInfo = await this.sierraDB.hello()
      const totalPartitions = serverInfo.num_partitions

      // Create isolated VM context
      const isolate = new ivm.Isolate({ memoryLimit: 128 })
      const context = await isolate.createContext()

      // Prepare the projection function in the isolated context
      const jail = context.global
      await jail.set('global', jail.derefInto())

      // Set up console logging capture (after global is set up)
      await this.setupConsoleCapture(context)

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
        // Clear console logs for this execution
        global.debugLogs = [];
        
        try {
          const result = global.projectFunction(currentState, currentEvent);
          JSON.stringify({ result: result, logs: global.debugLogs });
        } catch (error) {
          JSON.stringify({ error: error.message, logs: global.debugLogs });
        }
      `)

      // Load initial events from partitions or specific stream
      const events = streamId 
        ? await this.loadStreamEvents(streamId)
        : await this.loadInitialEvents(totalPartitions)

      const session: DebugSession = {
        id: sessionId,
        code,
        isolate,
        context,
        executionScript,
        events,
        currentEventIndex: 0,
        currentPartition: 0,
        totalPartitions,
        currentState: initialState,
        previousState: null,
        initialState,
        status: 'idle',
        consoleLogs: [],
        lastAccessed: Date.now(),
      }

      this.sessions.set(sessionId, session)
      return sessionId

    } catch (error) {
      throw new Error(`Failed to create debug session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async setupConsoleCapture(context: ivm.Context): Promise<void> {
    // Override console methods in the isolated context using eval
    await context.eval(`
      global.debugLogs = [];
      
      global.console = {
        log: function(...args) {
          global.debugLogs.push({
            timestamp: Date.now(),
            level: 'log',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
          });
        },
        warn: function(...args) {
          global.debugLogs.push({
            timestamp: Date.now(),
            level: 'warn',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
          });
        },
        error: function(...args) {
          global.debugLogs.push({
            timestamp: Date.now(),
            level: 'error',
            message: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
          });
        }
      };
    `)
  }

  private async loadInitialEvents(totalPartitions: number, maxEvents: number = 1000): Promise<SierraDBEvent[]> {
    const events: SierraDBEvent[] = []
    
    // Try to load events from more partitions to find data
    // Check up to 50 partitions or until we find enough events
    const maxPartitionsToCheck = Math.min(totalPartitions, 50)
    
    for (let partition = 0; partition < maxPartitionsToCheck && events.length < maxEvents; partition++) {
      try {
        const result = await this.sierraDB.scanPartition({
          partition,
          start_sequence: 0,
          end_sequence: '+',
          count: Math.min(100, maxEvents - events.length),
        })

        if (result.events.length > 0) {
          events.push(...result.events)
        }
        
        if (events.length >= maxEvents) {
          break
        }
      } catch (error) {
        console.error(`Error loading events from partition ${partition}:`, error)
      }
    }

    // If still no events found in first 50 partitions, try some specific partitions and random ones
    if (events.length === 0 && totalPartitions > 50) {
      // Try some specific partitions that might have events (like 892)
      const specificPartitions = [892, 100, 200, 500, 800, 900, 1000]
      const randomPartitions: number[] = []
      
      // Add specific partitions if they exist
      for (const partition of specificPartitions) {
        if (partition < totalPartitions && !randomPartitions.includes(partition)) {
          randomPartitions.push(partition)
        }
      }
      
      // Add some truly random partitions
      for (let i = 0; i < Math.min(15, totalPartitions - randomPartitions.length); i++) {
        const randomPartition = Math.floor(Math.random() * totalPartitions)
        if (!randomPartitions.includes(randomPartition)) {
          randomPartitions.push(randomPartition)
        }
      }

      for (const partition of randomPartitions) {
        try {
          const result = await this.sierraDB.scanPartition({
            partition,
            start_sequence: 0,
            end_sequence: '+',
            count: Math.min(100, maxEvents - events.length),
          })

          if (result.events.length > 0) {
            events.push(...result.events)
          }
          
          if (events.length >= maxEvents) {
            break
          }
        } catch (error) {
          console.error(`Error loading events from partition ${partition}:`, error)
        }
      }
    }

    return events
  }

  private async loadStreamEvents(streamId: string, maxEvents: number = 1000): Promise<SierraDBEvent[]> {
    const events: SierraDBEvent[] = []
    let startVersion = 0
    let hasMore = true
    const batchSize = 100

    while (hasMore && events.length < maxEvents) {
      try {
        const result = await this.sierraDB.scanStream({
          stream_id: streamId,
          start_version: startVersion,
          end_version: '+',
          count: Math.min(batchSize, maxEvents - events.length),
        })

        hasMore = result.has_more
        
        if (result.events.length > 0) {
          events.push(...result.events)
          
          // Update start version for next batch
          const lastEvent = result.events[result.events.length - 1]
          startVersion = lastEvent.stream_version + 1
        } else {
          break
        }
        
        if (events.length >= maxEvents) {
          break
        }
      } catch (error) {
        console.error(`Error loading events from stream ${streamId}:`, error)
        break
      }
    }

    return events
  }

  async stepSession(sessionId: string): Promise<{
    sessionStatus: DebugSessionStatus
    stateChanged: boolean
    processingComplete: boolean
  }> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Debug session not found')
    }

    session.lastAccessed = Date.now()

    if (session.status === 'completed' || session.status === 'error') {
      return {
        sessionStatus: this.getSessionStatus(session),
        stateChanged: false,
        processingComplete: true,
      }
    }

    if (session.currentEventIndex >= session.events.length) {
      session.status = 'completed'
      return {
        sessionStatus: this.getSessionStatus(session),
        stateChanged: false,
        processingComplete: true,
      }
    }

    try {
      session.status = 'running'
      session.previousState = session.currentState

      const currentEvent = session.events[session.currentEventIndex]
      
      // Execute projection function for current event
      const result = await this.executeProjectionFunction(session, currentEvent)
      
      if (result.error) {
        session.status = 'error'
        session.error = result.error
      } else {
        session.currentState = result.result
        session.consoleLogs.push(...result.logs)
        session.currentEventIndex++
        session.status = session.currentEventIndex >= session.events.length ? 'completed' : 'paused'
      }

      const stateChanged = JSON.stringify(session.previousState) !== JSON.stringify(session.currentState)
      
      return {
        sessionStatus: this.getSessionStatus(session),
        stateChanged,
        processingComplete: session.status === 'completed' || session.status === 'error',
      }

    } catch (error) {
      session.status = 'error'
      session.error = error instanceof Error ? error.message : 'Unknown error'
      
      return {
        sessionStatus: this.getSessionStatus(session),
        stateChanged: false,
        processingComplete: true,
      }
    }
  }

  private async executeProjectionFunction(session: DebugSession, event: SierraDBEvent): Promise<{
    result?: any
    error?: string
    logs: ConsoleLog[]
  }> {
    try {
      // Pass state and event to the isolated context
      await session.context.global.set('currentState', new ivm.ExternalCopy(session.currentState).copyInto())
      await session.context.global.set('currentEvent', new ivm.ExternalCopy(event).copyInto())

      // Execute the pre-compiled script
      const resultString = await session.executionScript.run(session.context, { timeout: 5000 })
      
      if (resultString && typeof resultString === 'string') {
        const parsed = JSON.parse(resultString)
        return {
          result: parsed.result,
          error: parsed.error,
          logs: parsed.logs || [],
        }
      }
      
      return { logs: [] }

    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: [],
      }
    }
  }

  async resetSession(sessionId: string): Promise<DebugSessionStatus> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Debug session not found')
    }

    session.lastAccessed = Date.now()
    session.currentEventIndex = 0
    session.currentState = session.initialState
    session.previousState = null
    session.status = 'idle'
    session.consoleLogs = []
    session.error = undefined

    return this.getSessionStatus(session)
  }

  getSession(sessionId: string): DebugSessionStatus | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
    }

    session.lastAccessed = Date.now()
    return this.getSessionStatus(session)
  }

  private getSessionStatus(session: DebugSession): DebugSessionStatus {
    return {
      sessionId: session.id,
      status: session.status,
      currentPartition: session.currentPartition,
      currentEventIndex: session.currentEventIndex,
      totalEventsLoaded: session.events.length,
      currentState: session.currentState,
      currentEvent: session.currentEventIndex < session.events.length 
        ? session.events[session.currentEventIndex] 
        : null,
      previousState: session.previousState,
      consoleLogs: session.consoleLogs,
      error: session.error,
    }
  }

  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (session) {
      // Clean up isolate
      session.isolate.dispose()
      this.sessions.delete(sessionId)
      return true
    }
    return false
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now()
    const expiredSessions: string[] = []

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.SESSION_TIMEOUT) {
        expiredSessions.push(sessionId)
      }
    }

    for (const sessionId of expiredSessions) {
      this.destroySession(sessionId)
    }
  }
}