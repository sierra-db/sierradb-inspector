export interface SierraDBEvent {
  event_id: string
  partition_key: string
  partition_id: number
  transaction_id: string
  partition_sequence: number
  stream_version: number
  timestamp: number
  stream_id: string
  event_name: string
  metadata: string | null
  payload: string | null
}

export interface PartitionScanResponse {
  has_more: boolean
  events: SierraDBEvent[]
}

export interface StreamScanResponse {
  has_more: boolean
  events: SierraDBEvent[]
}

export type EventGetResponse = SierraDBEvent | null

export type PingResponse = string