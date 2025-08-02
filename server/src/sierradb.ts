import { createClient } from 'redis'
import {
  SierraDBEvent,
  PartitionScanResponse,
  StreamScanResponse,
  EventGetResponse,
  PingResponse,
  PartitionScanParams,
  StreamScanParams,
  EventGetParams,
  SierraDBEventSchema,
  PartitionScanResponseSchema,
  StreamScanResponseSchema,
  EventGetResponseSchema,
  PingResponseSchema,
} from './types.js'

export class SierraDBClient {
  private client: any

  constructor(url: string = 'redis://localhost:6379') {
    this.client = createClient({ 
      url,
      RESP: 3, // Enable RESP3
    })
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect()
  }

  async ping(): Promise<PingResponse> {
    const result = await this.client.ping()
    return PingResponseSchema.parse(result)
  }

  async getEvent(params: EventGetParams): Promise<EventGetResponse> {
    const result = await this.client.sendCommand(['EGET', params.event_id])
    
    if (result === null) {
      return null
    }

    const resultArray = result as string[]
    const event = {
      event_id: resultArray[0],
      partition_key: resultArray[1],
      partition_id: parseInt(resultArray[2]),
      transaction_id: resultArray[3],
      partition_sequence: parseInt(resultArray[4]),
      stream_version: parseInt(resultArray[5]),
      timestamp: parseInt(resultArray[6]),
      stream_id: resultArray[7],
      event_name: resultArray[8],
      metadata: resultArray[9] || null,
      payload: resultArray[10] || null,
    }

    return EventGetResponseSchema.parse(event)
  }

  async scanPartition(params: PartitionScanParams): Promise<PartitionScanResponse> {
    const args = ['EPSCAN', params.partition.toString(), params.start_sequence.toString(), params.end_sequence.toString()]
    
    if (params.count !== undefined) {
      args.push('COUNT', params.count.toString())
    }

    const result = await this.client.sendCommand(args)
    const resultArray = result as [boolean, any[][]]
    
    const response = {
      has_more: resultArray[0],
      events: resultArray[1].map((eventArray: any[]) => ({
        event_id: eventArray[0],
        partition_key: eventArray[1],
        partition_id: parseInt(eventArray[2]),
        transaction_id: eventArray[3],
        partition_sequence: parseInt(eventArray[4]),
        stream_version: parseInt(eventArray[5]),
        timestamp: parseInt(eventArray[6]),
        stream_id: eventArray[7],
        event_name: eventArray[8],
        metadata: eventArray[9] === null ? null : eventArray[9],
        payload: eventArray[10] === null ? null : eventArray[10],
      }))
    }

    return PartitionScanResponseSchema.parse(response)
  }

  async scanStream(params: StreamScanParams): Promise<StreamScanResponse> {
    const args = ['ESCAN', params.stream_id, params.start_version.toString(), params.end_version.toString()]
    
    if (params.partition_key !== undefined) {
      args.push('PARTITION_KEY', params.partition_key)
    }
    
    if (params.count !== undefined) {
      args.push('COUNT', params.count.toString())
    }

    const result = await this.client.sendCommand(args)
    const resultArray = result as [boolean, any[][]]
    
    const response = {
      has_more: resultArray[0],
      events: resultArray[1].map((eventArray: any[]) => ({
        event_id: eventArray[0],
        partition_key: eventArray[1],
        partition_id: parseInt(eventArray[2]),
        transaction_id: eventArray[3],
        partition_sequence: parseInt(eventArray[4]),
        stream_version: parseInt(eventArray[5]),
        timestamp: parseInt(eventArray[6]),
        stream_id: eventArray[7],
        event_name: eventArray[8],
        metadata: eventArray[9] === null ? null : eventArray[9],
        payload: eventArray[10] === null ? null : eventArray[10],
      }))
    }

    return StreamScanResponseSchema.parse(response)
  }
}