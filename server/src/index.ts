import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { SierraDBClient } from './sierradb.js'
import {
  PartitionScanParams,
  StreamScanParams,
  EventGetParams,
} from './types.js'

const app = express()
const port = process.env.PORT || 3001
const sierraDBUrl = process.env.SIERRADB_URL || 'redis://localhost:9090'

app.use(cors())
app.use(express.json())

const sierraDB = new SierraDBClient(sierraDBUrl)

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

app.get('/api/ping', async (req, res) => {
  try {
    const result = await sierraDB.ping()
    res.json({ result })
  } catch (error) {
    console.error('Ping error:', error)
    res.status(500).json({ error: 'Failed to ping SierraDB' })
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

async function startServer() {
  try {
    await sierraDB.connect()
    console.log('Connected to SierraDB')

    app.listen(port, () => {
      console.log(`SierraDB Inspector server running on port ${port}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...')
  await sierraDB.disconnect()
  process.exit(0)
})

startServer()
