import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { SierraDBClient } from './sierradb.js'
import {
  PartitionScanParams,
  StreamScanParams,
  EventGetParams,
  ProjectionRunRequestSchema,
  DebugSessionStartRequestSchema,
  DebugStepRequestSchema,
} from './types.js'
import { ProjectionEngine } from './projectionEngine.js'
import { DebugSessionManager } from './debugSessionManager.js'

const app = express()
const port = process.env.PORT || 3001
const sierraDBUrl = process.env.SIERRADB_URL || 'redis://localhost:9090'

app.use(cors())
app.use(express.json())

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('/app/client/dist'))
}

const sierraDB = new SierraDBClient(sierraDBUrl)
const projectionEngine = new ProjectionEngine(sierraDB)
const debugSessionManager = new DebugSessionManager(sierraDB)

const PartitionScanQuerySchema = z.object({
  partition: z.string().transform(val => {
    const num = Number(val)
    return isNaN(num) ? val : num
  }),
  start_sequence: z.string().transform(val => {
    if (val === '-' || val === '') return 0
    const num = Number(val)
    return isNaN(num) ? 0 : num
  }),
  end_sequence: z.string().transform(val => {
    if (val === '+' || val === '') return '+'
    const num = Number(val)
    return isNaN(num) ? '+' : num
  }),
  count: z.string().optional().transform(val => {
    if (!val) return undefined
    const num = Number(val)
    return isNaN(num) ? undefined : num
  }),
})

const StreamScanQuerySchema = z.object({
  stream_id: z.string(),
  start_version: z.string().transform(val => {
    if (val === '-' || val === '') return 0
    const num = Number(val)
    return isNaN(num) ? 0 : num
  }),
  end_version: z.string().transform(val => {
    if (val === '+' || val === '') return '+'
    const num = Number(val)
    return isNaN(num) ? '+' : num
  }),
  partition_key: z.string().optional(),
  count: z.string().optional().transform(val => {
    if (!val) return undefined
    const num = Number(val)
    return isNaN(num) ? undefined : num
  }),
})

const EventGetParamsSchema = z.object({
  event_id: z.string(),
})

app.get('/api/health', async (req, res) => {
  try {
    const result = await sierraDB.ping()
    res.json({ status: 'healthy', sierradb: result })
  } catch (error) {
    console.error('Health check error:', error)
    res.status(500).json({ status: 'unhealthy', error: 'Failed to connect to SierraDB' })
  }
})

app.get('/api/ping', async (req, res) => {
  try {
    const result = await sierraDB.ping()
    res.json({ result })
  } catch (error) {
    console.error('Ping error:', error)
    res.status(500).json({ error: 'Failed to ping SierraDB' })
  }
})

app.get('/api/hello', async (req, res) => {
  try {
    const result = await sierraDB.hello()
    res.json(result)
  } catch (error) {
    console.error('Hello error:', error)
    res.status(500).json({ error: 'Failed to get server info' })
  }
})

app.get('/api/events/:event_id', async (req, res) => {
  try {
    const params = EventGetParamsSchema.parse(req.params)
    const result = await sierraDB.getEvent(params)
    res.json(result)
  } catch (error) {
    console.error('Get event error:', error)
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid parameters', details: error.errors })
    } else {
      res.status(500).json({ error: 'Failed to get event' })
    }
  }
})

app.get('/api/partitions/:partition/scan', async (req, res) => {
  try {
    const queryParams = PartitionScanQuerySchema.parse({
      partition: req.params.partition,
      ...req.query,
    })
    const result = await sierraDB.scanPartition(queryParams)
    res.json(result)
  } catch (error) {
    console.error('Partition scan error:', error)
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid parameters', details: error.errors })
    } else {
      res.status(500).json({ error: 'Failed to scan partition' })
    }
  }
})

app.get('/api/streams/:stream_id/scan', async (req, res) => {
  try {
    const queryParams = StreamScanQuerySchema.parse({
      stream_id: req.params.stream_id,
      ...req.query,
    })

    const result = await sierraDB.scanStream(queryParams)
    res.json(result)
  } catch (error) {
    console.error('Stream scan error:', error)
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid parameters', details: error.errors })
    } else {
      res.status(500).json({ error: 'Failed to scan stream' })
    }
  }
})

app.post('/api/projections/run', async (req, res) => {
  try {
    const params = ProjectionRunRequestSchema.parse(req.body)
    
    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    })

    // Send initial connection event
    res.write('event: connected\n')
    res.write('data: {"status": "connected"}\n\n')
    
    // Flush the response to ensure it's sent immediately
    res.flushHeaders()

    // Run the projection (await it properly)
    try {
      await projectionEngine.runProjection(
        params.code,
        params.initialState || null,
        (progress) => {
          res.write('event: progress\n')
          res.write(`data: ${JSON.stringify(progress)}\n\n`)
          
          // Close connection when completed or error
          if (progress.status === 'completed' || progress.status === 'error') {
            res.end()
          }
        },
        params.streamId
      )
    } catch (projectionError) {
      console.error('Projection execution error:', projectionError)
      res.write('event: progress\n')
      res.write(`data: ${JSON.stringify({
        current_partition: 0,
        total_partitions: 0,
        events_processed: 0,
        current_state: null,
        status: 'error',
        error: projectionError instanceof Error ? projectionError.message : 'Unknown projection error'
      })}\n\n`)
      res.end()
    }

    // Handle client disconnect
    req.on('close', () => {
      projectionEngine.abort()
      res.end()
    })

  } catch (error) {
    console.error('Projection run error:', error)
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid parameters', details: error.errors })
    } else {
      res.status(500).json({ error: 'Failed to start projection' })
    }
  }
})

// Debug API endpoints
app.post('/api/projections/debug/start', async (req, res) => {
  try {
    const params = DebugSessionStartRequestSchema.parse(req.body)
    const sessionId = await debugSessionManager.createSession(params.code, params.initialState, params.streamId)
    
    res.json({ sessionId })
  } catch (error) {
    console.error('Debug session start error:', error)
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid parameters', details: error.errors })
    } else {
      res.status(500).json({ error: 'Failed to start debug session' })
    }
  }
})

app.post('/api/projections/debug/step', async (req, res) => {
  try {
    const params = DebugStepRequestSchema.parse(req.body)
    const result = await debugSessionManager.stepSession(params.sessionId)
    
    res.json(result)
  } catch (error) {
    console.error('Debug step error:', error)
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid parameters', details: error.errors })
    } else {
      res.status(500).json({ error: 'Failed to step debug session' })
    }
  }
})

app.get('/api/projections/debug/status/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId
    const status = debugSessionManager.getSession(sessionId)
    
    if (!status) {
      res.status(404).json({ error: 'Debug session not found' })
      return
    }
    
    res.json(status)
  } catch (error) {
    console.error('Debug status error:', error)
    res.status(500).json({ error: 'Failed to get debug session status' })
  }
})

app.post('/api/projections/debug/reset', async (req, res) => {
  try {
    const params = DebugStepRequestSchema.parse(req.body)
    const status = await debugSessionManager.resetSession(params.sessionId)
    
    res.json(status)
  } catch (error) {
    console.error('Debug reset error:', error)
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid parameters', details: error.errors })
    } else {
      res.status(500).json({ error: 'Failed to reset debug session' })
    }
  }
})

app.delete('/api/projections/debug/:sessionId', async (req, res) => {
  try {
    const sessionId = req.params.sessionId
    const destroyed = debugSessionManager.destroySession(sessionId)
    
    if (!destroyed) {
      res.status(404).json({ error: 'Debug session not found' })
      return
    }
    
    res.json({ success: true })
  } catch (error) {
    console.error('Debug destroy error:', error)
    res.status(500).json({ error: 'Failed to destroy debug session' })
  }
})

// Catch-all handler for React Router (must be last)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile('/app/client/dist/index.html')
  })
}

async function startServer() {
  try {
    console.log(`Starting server on port ${port}`)
    console.log(`Attempting to connect to SierraDB at: ${sierraDBUrl}`)
    
    await sierraDB.connect()
    console.log('Successfully connected to SierraDB')

    app.listen(port, () => {
      console.log(`SierraDB Inspector server running on port ${port}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    console.error('Error details:', error)
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...')
  await sierraDB.disconnect()
  process.exit(0)
})

startServer()
