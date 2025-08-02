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
  metadata: z.string().nullable(),
  payload: z.string().nullable(),
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

export type SierraDBEvent = z.infer<typeof SierraDBEventSchema>
export type PartitionScanResponse = z.infer<typeof PartitionScanResponseSchema>
export type StreamScanResponse = z.infer<typeof StreamScanResponseSchema>
export type EventGetResponse = z.infer<typeof EventGetResponseSchema>
export type PingResponse = z.infer<typeof PingResponseSchema>

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