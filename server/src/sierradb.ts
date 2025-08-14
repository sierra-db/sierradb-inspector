import { createClient, RESP_TYPES } from 'redis'
import {
  SierraDBEvent,
  PartitionScanResponse,
  StreamScanResponse,
  EventGetResponse,
  PingResponse,
  HelloResponse,
  PartitionScanParams,
  StreamScanParams,
  EventGetParams,
  SierraDBEventSchema,
  PartitionScanResponseSchema,
  StreamScanResponseSchema,
  EventGetResponseSchema,
  PingResponseSchema,
  HelloResponseSchema,
} from './types.js'
import { processEventFields } from './binaryUtils.js'

export class SierraDBClient {
  private client: any
  private url: string
  private isConnecting: boolean = false

  constructor(url: string = 'redis://localhost:9090') {
    this.url = url
    this.createClient()
  }

  private createClient(): void {
    this.client = createClient({
      url: this.url,
      RESP: 3, // Enable RESP3
      socket: {
        reconnectStrategy: (retries) => {
          console.log(`Reconnection attempt ${retries + 1}`)
          // Exponential backoff with max delay of 3000ms
          return Math.min(retries * 50, 3000)
        },
        connectTimeout: 60000,
      },
    })
    .withTypeMapping({
      [RESP_TYPES.BLOB_STRING]: Buffer
    });   


    this.client.on('error', (err: Error) => {
      console.error('Redis connection error:', err)
    })

    this.client.on('connect', () => {
      console.log('Connected to SierraDB')
      this.isConnecting = false
    })

    this.client.on('ready', () => {
      console.log('SierraDB connection ready')
    })

    this.client.on('reconnecting', () => {
      console.log('Reconnecting to SierraDB...')
      this.isConnecting = true
    })

    this.client.on('end', () => {
      console.log('SierraDB connection ended')
    })
  }

  async connect(): Promise<void> {
    if (this.client.isOpen) {
      return
    }
    this.isConnecting = true
    await this.client.connect()
    
    this.isConnecting = false
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.disconnect()
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client.isOpen && !this.isConnecting) {
      console.log('Connection lost, attempting to reconnect...')
      try {
        await this.connect()
      } catch (error) {
        console.error('Failed to reconnect:', error)
        throw error
      }
    }
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await this.ensureConnected()
      return await operation()
    } catch (error: any) {
      if (error.message?.includes('connection') || error.code === 'ECONNREFUSED') {
        console.log('Connection error detected, retrying...')
        await this.ensureConnected()
        return await operation()
      }
      throw error
    }
  }

  async ping(): Promise<PingResponse> {
    return await this.executeWithRetry(async () => {
      const result = await this.client.ping()
      return PingResponseSchema.parse(result)
    })
  }

  async hello(): Promise<HelloResponse> {
    return await this.executeWithRetry(async () => {
      const result = await this.client.sendCommand(['HELLO', '3'], {
        typeMapping: {
          [RESP_TYPES.BLOB_STRING]: Buffer,
        }
      })
      const resultObj = result as Record<string, any>
      
      const hello = {
        version: Buffer.isBuffer(resultObj.version) ? resultObj.version.toString() : resultObj.version,
        num_partitions: resultObj.num_partitions,
        server: Buffer.isBuffer(resultObj.server) ? resultObj.server.toString() : resultObj.server,
        peer_id: Buffer.isBuffer(resultObj.peer_id) ? resultObj.peer_id.toString() : resultObj.peer_id,
      }
      
      return HelloResponseSchema.parse(hello)
    })
  }

  async getEvent(params: EventGetParams): Promise<EventGetResponse> {
    return await this.executeWithRetry(async () => {
      const result = await this.client.sendCommand(['EGET', params.event_id], {
        typeMapping: {
          [RESP_TYPES.BLOB_STRING]: Buffer,
        }
      })

      if (result === null) {
        return null
      }

      const resultObj = result as Record<string, any>
      
      // Process binary fields (metadata and payload)
      const processedFields = processEventFields(
        resultObj.metadata || null,
        resultObj.payload || null
      )
      
      const event = {
        event_id: Buffer.isBuffer(resultObj.event_id) ? resultObj.event_id.toString() : resultObj.event_id,
        partition_key: Buffer.isBuffer(resultObj.partition_key) ? resultObj.partition_key.toString() : resultObj.partition_key,
        partition_id: parseInt(resultObj.partition_id),
        transaction_id: Buffer.isBuffer(resultObj.transaction_id) ? resultObj.transaction_id.toString() : resultObj.transaction_id,
        partition_sequence: parseInt(resultObj.partition_sequence),
        stream_version: parseInt(resultObj.stream_version),
        timestamp: parseInt(resultObj.timestamp),
        stream_id: Buffer.isBuffer(resultObj.stream_id) ? resultObj.stream_id.toString() : resultObj.stream_id,
        event_name: Buffer.isBuffer(resultObj.event_name) ? resultObj.event_name.toString() : resultObj.event_name,
        metadata: processedFields.metadata,
        metadata_encoding: processedFields.metadata_encoding,
        metadata_parsed: processedFields.metadata_parsed,
        payload: processedFields.payload,
        payload_encoding: processedFields.payload_encoding,
        payload_parsed: processedFields.payload_parsed,
      }

      return EventGetResponseSchema.parse(event)
    })
  }

  async scanPartition(params: PartitionScanParams): Promise<PartitionScanResponse> {
    return await this.executeWithRetry(async () => {
      const args = ['EPSCAN', params.partition.toString(), params.start_sequence.toString(), params.end_sequence.toString()]

      if (params.count !== undefined) {
        args.push('COUNT', params.count.toString())
      }

      const result = await this.client.sendCommand(args, {
        typeMapping: {
          [RESP_TYPES.BLOB_STRING]: Buffer,
        }
      })
      const resultObj = result as Record<string, any>

      const response = {
        has_more: resultObj.has_more,
        events: resultObj.events.map((eventObj: Record<string, any>) => {
          const processedFields = processEventFields(
            eventObj.metadata || null,
            eventObj.payload || null
          )
          
          return {
            event_id: Buffer.isBuffer(eventObj.event_id) ? eventObj.event_id.toString() : eventObj.event_id,
            partition_key: Buffer.isBuffer(eventObj.partition_key) ? eventObj.partition_key.toString() : eventObj.partition_key,
            partition_id: parseInt(eventObj.partition_id),
            transaction_id: Buffer.isBuffer(eventObj.transaction_id) ? eventObj.transaction_id.toString() : eventObj.transaction_id,
            partition_sequence: parseInt(eventObj.partition_sequence),
            stream_version: parseInt(eventObj.stream_version),
            timestamp: parseInt(eventObj.timestamp),
            stream_id: Buffer.isBuffer(eventObj.stream_id) ? eventObj.stream_id.toString() : eventObj.stream_id,
            event_name: Buffer.isBuffer(eventObj.event_name) ? eventObj.event_name.toString() : eventObj.event_name,
            metadata: processedFields.metadata,
            metadata_encoding: processedFields.metadata_encoding,
            metadata_parsed: processedFields.metadata_parsed,
            payload: processedFields.payload,
            payload_encoding: processedFields.payload_encoding,
            payload_parsed: processedFields.payload_parsed,
          }
        })
      }

      return PartitionScanResponseSchema.parse(response)
    })
  }

  async scanStream(params: StreamScanParams): Promise<StreamScanResponse> {
    return await this.executeWithRetry(async () => {
      const args = ['ESCAN', params.stream_id, params.start_version.toString(), params.end_version.toString()]

      if (params.partition_key !== undefined) {
        args.push('PARTITION_KEY', params.partition_key)
      }

      if (params.count !== undefined) {
        args.push('COUNT', params.count.toString())
      }

      const result = await this.client.sendCommand(args, {
        typeMapping: {
          [RESP_TYPES.BLOB_STRING]: Buffer,
        }
      })
      
      const resultObj = result as Record<string, any>

      const response = {
        has_more: resultObj.has_more,
        events: resultObj.events.map((eventObj: Record<string, any>) => {
          const processedFields = processEventFields(
            eventObj.metadata || null,
            eventObj.payload || null
          )
          
          return {
            event_id: Buffer.isBuffer(eventObj.event_id) ? eventObj.event_id.toString() : eventObj.event_id,
            partition_key: Buffer.isBuffer(eventObj.partition_key) ? eventObj.partition_key.toString() : eventObj.partition_key,
            partition_id: parseInt(eventObj.partition_id),
            transaction_id: Buffer.isBuffer(eventObj.transaction_id) ? eventObj.transaction_id.toString() : eventObj.transaction_id,
            partition_sequence: parseInt(eventObj.partition_sequence),
            stream_version: parseInt(eventObj.stream_version),
            timestamp: parseInt(eventObj.timestamp),
            stream_id: Buffer.isBuffer(eventObj.stream_id) ? eventObj.stream_id.toString() : eventObj.stream_id,
            event_name: Buffer.isBuffer(eventObj.event_name) ? eventObj.event_name.toString() : eventObj.event_name,
            metadata: processedFields.metadata,
            metadata_encoding: processedFields.metadata_encoding,
            metadata_parsed: processedFields.metadata_parsed,
            payload: processedFields.payload,
            payload_encoding: processedFields.payload_encoding,
            payload_parsed: processedFields.payload_parsed,
          }
        })
      }

      return StreamScanResponseSchema.parse(response)
    })
  }
}
