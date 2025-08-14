import { z } from 'zod';
export const SierraDBEventSchema = z.object({
  event_id: z.string(),
  partition_key: z.string(),
  partition_id: z.number(),
  transaction_id: z.string(),
  partition_sequence: z.number(),
  stream_version: z.number(),
  timestamp: z.number(),
  stream_id: z.instanceof(Buffer),
  event_name: z.instanceof(Buffer),
  metadata: z.nullable(z.instanceof(Buffer)),
  payload: z.nullable(z.instanceof(Buffer)),
});
export const PartitionScanResponseSchema = z.object({
  has_more: z.boolean(),
  events: z.array(SierraDBEventSchema),
});
export const StreamScanResponseSchema = z.object({
  has_more: z.boolean(),
  events: z.array(SierraDBEventSchema),
});
export const EventGetResponseSchema = z.nullable(SierraDBEventSchema);
export declare const PingResponseSchema: z.ZodString;
export type SierraDBEvent = z.infer<typeof SierraDBEventSchema>;
export type PartitionScanResponse = z.infer<typeof PartitionScanResponseSchema>;
export type StreamScanResponse = z.infer<typeof StreamScanResponseSchema>;
export type EventGetResponse = z.infer<typeof EventGetResponseSchema>;
export type PingResponse = z.infer<typeof PingResponseSchema>;
export interface PartitionScanParams {
    partition: number | string;
    start_sequence: number | string;
    end_sequence: number | string;
    count?: number;
}
export interface StreamScanParams {
    stream_id: string;
    start_version: number | string;
    end_version: number | string;
    partition_key?: string;
    count?: number;
}
export interface EventGetParams {
    event_id: string;
}
