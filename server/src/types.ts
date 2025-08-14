import { z } from 'zod'

export const SierraDBEventSchema = z.object({
  event_id: z.string(),
  partition_key: z.string(),
  partition_id: z.number(),
  transaction_id: z.string(),
  partition_sequence: z.number(),
  stream_version: z.number(),
  timestamp: z.number(),
  stream_id: z.string(),
  event_name: z.string(),
  metadata: z.any().nullable(),
  metadata_encoding: z.enum(['base64-cbor', 'base64-binary', 'json']).nullable().optional(),
  metadata_parsed: z.any().nullable().optional(),
  payload: z.any().nullable(),
  payload_encoding: z.enum(['base64-cbor', 'base64-binary', 'json']).nullable().optional(),
  payload_parsed: z.any().nullable().optional(),
})

export const PartitionScanResponseSchema = z.object({
  has_more: z.boolean(),
  events: z.array(SierraDBEventSchema),
})

export const StreamScanResponseSchema = z.object({
  has_more: z.boolean(),
  events: z.array(SierraDBEventSchema),
})

export const EventGetResponseSchema = SierraDBEventSchema.nullable()

export const PingResponseSchema = z.string()

export const HelloResponseSchema = z.object({
  version: z.string(),
  num_partitions: z.number(),
  server: z.string(),
  peer_id: z.string(),
})

export type SierraDBEvent = z.infer<typeof SierraDBEventSchema>
export type PartitionScanResponse = z.infer<typeof PartitionScanResponseSchema>
export type StreamScanResponse = z.infer<typeof StreamScanResponseSchema>
export type EventGetResponse = z.infer<typeof EventGetResponseSchema>
export type PingResponse = z.infer<typeof PingResponseSchema>
export type HelloResponse = z.infer<typeof HelloResponseSchema>

export interface PartitionScanParams {
  partition: number | string
  start_sequence: number | string
  end_sequence: number | string
  count?: number
}

export interface StreamScanParams {
  stream_id: string
  start_version: number | string
  end_version: number | string
  partition_key?: string
  count?: number
}

export interface EventGetParams {
  event_id: string
}

export const ProjectionRunRequestSchema = z.object({
  code: z.string().min(1, 'Projection code is required'),
  initialState: z.any().optional(),
  streamId: z.string().optional(),
})

export const ProjectionProgressSchema = z.object({
  current_partition: z.number(),
  total_partitions: z.number(),
  events_processed: z.number(),
  current_state: z.any(),
  status: z.enum(['running', 'completed', 'error']),
  error: z.string().optional(),
})

export type ProjectionRunRequest = z.infer<typeof ProjectionRunRequestSchema>
export type ProjectionProgress = z.infer<typeof ProjectionProgressSchema>

// Debug Session Types
export const DebugSessionStartRequestSchema = z.object({
  code: z.string().min(1, 'Projection code is required'),
  initialState: z.any().optional(),
  streamId: z.string().optional(),
})

export const DebugStepRequestSchema = z.object({
  sessionId: z.string(),
})

export const DebugSessionStatusSchema = z.object({
  sessionId: z.string(),
  status: z.enum(['idle', 'running', 'paused', 'completed', 'error']),
  currentPartition: z.number(),
  currentEventIndex: z.number(),
  totalEventsLoaded: z.number(),
  currentState: z.any(),
  currentEvent: SierraDBEventSchema.nullable(),
  previousState: z.any().nullable(),
  consoleLogs: z.array(z.object({
    timestamp: z.number(),
    level: z.enum(['log', 'warn', 'error']),
    message: z.string(),
  })),
  error: z.string().optional(),
})

export const DebugStepResponseSchema = z.object({
  sessionStatus: DebugSessionStatusSchema,
  stateChanged: z.boolean(),
  processingComplete: z.boolean(),
})

export type DebugSessionStartRequest = z.infer<typeof DebugSessionStartRequestSchema>
export type DebugStepRequest = z.infer<typeof DebugStepRequestSchema>
export type DebugSessionStatus = z.infer<typeof DebugSessionStatusSchema>
export type DebugStepResponse = z.infer<typeof DebugStepResponseSchema>
