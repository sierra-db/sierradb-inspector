import { z } from 'zod';
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
});
export const PartitionScanResponseSchema = z.object({
    has_more: z.boolean(),
    events: z.array(SierraDBEventSchema),
});
export const StreamScanResponseSchema = z.object({
    has_more: z.boolean(),
    events: z.array(SierraDBEventSchema),
});
export const EventGetResponseSchema = SierraDBEventSchema.nullable();
export const PingResponseSchema = z.string();
