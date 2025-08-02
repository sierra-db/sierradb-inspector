import { z } from 'zod';
export declare const SierraDBEventSchema: z.ZodObject<{
    event_id: z.ZodString;
    partition_key: z.ZodString;
    partition_id: z.ZodNumber;
    transaction_id: z.ZodString;
    partition_sequence: z.ZodNumber;
    stream_version: z.ZodNumber;
    timestamp: z.ZodNumber;
    stream_id: z.ZodString;
    event_name: z.ZodString;
    metadata: z.ZodNullable<z.ZodString>;
    payload: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    event_id: string;
    partition_key: string;
    partition_id: number;
    transaction_id: string;
    partition_sequence: number;
    stream_version: number;
    timestamp: number;
    stream_id: string;
    event_name: string;
    metadata: string | null;
    payload: string | null;
}, {
    event_id: string;
    partition_key: string;
    partition_id: number;
    transaction_id: string;
    partition_sequence: number;
    stream_version: number;
    timestamp: number;
    stream_id: string;
    event_name: string;
    metadata: string | null;
    payload: string | null;
}>;
export declare const PartitionScanResponseSchema: z.ZodObject<{
    has_more: z.ZodBoolean;
    events: z.ZodArray<z.ZodObject<{
        event_id: z.ZodString;
        partition_key: z.ZodString;
        partition_id: z.ZodNumber;
        transaction_id: z.ZodString;
        partition_sequence: z.ZodNumber;
        stream_version: z.ZodNumber;
        timestamp: z.ZodNumber;
        stream_id: z.ZodString;
        event_name: z.ZodString;
        metadata: z.ZodNullable<z.ZodString>;
        payload: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        event_id: string;
        partition_key: string;
        partition_id: number;
        transaction_id: string;
        partition_sequence: number;
        stream_version: number;
        timestamp: number;
        stream_id: string;
        event_name: string;
        metadata: string | null;
        payload: string | null;
    }, {
        event_id: string;
        partition_key: string;
        partition_id: number;
        transaction_id: string;
        partition_sequence: number;
        stream_version: number;
        timestamp: number;
        stream_id: string;
        event_name: string;
        metadata: string | null;
        payload: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    has_more: boolean;
    events: {
        event_id: string;
        partition_key: string;
        partition_id: number;
        transaction_id: string;
        partition_sequence: number;
        stream_version: number;
        timestamp: number;
        stream_id: string;
        event_name: string;
        metadata: string | null;
        payload: string | null;
    }[];
}, {
    has_more: boolean;
    events: {
        event_id: string;
        partition_key: string;
        partition_id: number;
        transaction_id: string;
        partition_sequence: number;
        stream_version: number;
        timestamp: number;
        stream_id: string;
        event_name: string;
        metadata: string | null;
        payload: string | null;
    }[];
}>;
export declare const StreamScanResponseSchema: z.ZodObject<{
    has_more: z.ZodBoolean;
    events: z.ZodArray<z.ZodObject<{
        event_id: z.ZodString;
        partition_key: z.ZodString;
        partition_id: z.ZodNumber;
        transaction_id: z.ZodString;
        partition_sequence: z.ZodNumber;
        stream_version: z.ZodNumber;
        timestamp: z.ZodNumber;
        stream_id: z.ZodString;
        event_name: z.ZodString;
        metadata: z.ZodNullable<z.ZodString>;
        payload: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        event_id: string;
        partition_key: string;
        partition_id: number;
        transaction_id: string;
        partition_sequence: number;
        stream_version: number;
        timestamp: number;
        stream_id: string;
        event_name: string;
        metadata: string | null;
        payload: string | null;
    }, {
        event_id: string;
        partition_key: string;
        partition_id: number;
        transaction_id: string;
        partition_sequence: number;
        stream_version: number;
        timestamp: number;
        stream_id: string;
        event_name: string;
        metadata: string | null;
        payload: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    has_more: boolean;
    events: {
        event_id: string;
        partition_key: string;
        partition_id: number;
        transaction_id: string;
        partition_sequence: number;
        stream_version: number;
        timestamp: number;
        stream_id: string;
        event_name: string;
        metadata: string | null;
        payload: string | null;
    }[];
}, {
    has_more: boolean;
    events: {
        event_id: string;
        partition_key: string;
        partition_id: number;
        transaction_id: string;
        partition_sequence: number;
        stream_version: number;
        timestamp: number;
        stream_id: string;
        event_name: string;
        metadata: string | null;
        payload: string | null;
    }[];
}>;
export declare const EventGetResponseSchema: z.ZodNullable<z.ZodObject<{
    event_id: z.ZodString;
    partition_key: z.ZodString;
    partition_id: z.ZodNumber;
    transaction_id: z.ZodString;
    partition_sequence: z.ZodNumber;
    stream_version: z.ZodNumber;
    timestamp: z.ZodNumber;
    stream_id: z.ZodString;
    event_name: z.ZodString;
    metadata: z.ZodNullable<z.ZodString>;
    payload: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    event_id: string;
    partition_key: string;
    partition_id: number;
    transaction_id: string;
    partition_sequence: number;
    stream_version: number;
    timestamp: number;
    stream_id: string;
    event_name: string;
    metadata: string | null;
    payload: string | null;
}, {
    event_id: string;
    partition_key: string;
    partition_id: number;
    transaction_id: string;
    partition_sequence: number;
    stream_version: number;
    timestamp: number;
    stream_id: string;
    event_name: string;
    metadata: string | null;
    payload: string | null;
}>>;
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
