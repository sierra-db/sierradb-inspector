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
  metadata_encoding?: 'base64-cbor' | 'base64-binary' | null
  payload: string | null
  payload_encoding?: 'base64-cbor' | 'base64-binary' | null
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

export interface HelloResponse {
  version: string
  num_partitions: number
  server: string
  peer_id: string
}

export interface ProjectionRunRequest {
  code: string
  initialState?: any
  streamId?: string
}

export interface ProjectionProgress {
  current_partition: number
  total_partitions: number
  events_processed: number
  current_state: any
  status: 'running' | 'completed' | 'error'
  error?: string
}

// Debug Session Types
export interface DebugSessionStartRequest {
  code: string
  initialState?: any
  streamId?: string
}

export interface DebugStepRequest {
  sessionId: string
}

export interface ConsoleLog {
  timestamp: number
  level: 'log' | 'warn' | 'error'
  message: string
}

export interface DebugSessionStatus {
  sessionId: string
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error'
  currentPartition: number
  currentEventIndex: number
  totalEventsLoaded: number
  currentState: any
  currentEvent: SierraDBEvent | null
  previousState: any | null
  consoleLogs: ConsoleLog[]
  error?: string
}

export interface DebugStepResponse {
  sessionStatus: DebugSessionStatus
  stateChanged: boolean
  processingComplete: boolean
}