# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the sierradb-inspector project. It is a web interface for exploring events in SierraDB.

It should provide functionality for exploring event streams in a simple and intuative way using modern react.

A NodeJS server will need to be running to execute commands on SierraDB, which will then return the data back to the
web client.


## SierraDB Overview

SierraDB is a distributed event sourcing database built in Rust with libp2p for distributed communication, inspired by
Cassandra/ScyllaDB's architecture. The system organizes data around a configurable number of logical partitions 
(default 1,024, but can be customized) that serve as concurrency control boundaries, with each partition owned by 
multiple nodes according to a replication factor (typically 3). Streams are append-only sequences of immutable events identified by
UUIDs, where each stream belongs to exactly one partition determined by hashing its partition key. Events within
streams maintain stream versions - monotonic, gapless sequence numbers that ensure total ordering within each stream,
while partition sequences provide gapless monotonic counters across all streams within a partition, enabling
interleaved event ordering for concurrent stream processing.

## SierraDB Command Reference

SierraDB uses the redis protocol (resp).

### EAPPEND

Append an event to a stream

`EAPPEND <stream_id> <event_name> [EVENT_ID <event_id>] [PARTITION_KEY <partition_key>] [EXPECTED_VERSION <version>] [PAYLOAD <payload>] [METADATA <metadata>]`

- stream_id (required): Stream identifier
- event_name (required): Name/type of the event
- event_id (optional): UUID for the event (auto-generated if not provided)
- partition_key (optional): UUID to determine event partitioning
- expected_version (optional): Expected stream version (number, "any", "exists", "empty")
- payload (optional): Event payload data
- metadata (optional): Event metadata

Return Values: Array with 6 elements:
- [0]: event_id (string)
- [1]: partition_key (string)
- [2]: partition_id (integer)
- [3]: partition_sequence (integer)
- [4]: stream_version (integer)
- [5]: timestamp (integer, nanoseconds)

### EMAPPEND

Append multiple events to streams in a single transaction

`EMAPPEND <partition_key> <stream_id1> <event_name1> [EVENT_ID <event_id1>] [EXPECTED_VERSION <version1>] [PAYLOAD <payload1>] [METADATA <metadata1>] [<stream_id2> <event_name2> ...]`

- partition_key (required): UUID that determines which partition all events will be written to
- For each event:
  - stream_id (required): Stream identifier
  - event_name (required): Name/type of the event
  - event_id (optional): UUID for the event (auto-generated if not provided)
  - expected_version (optional): Expected stream version (number, "any", "exists", "empty")
  - payload (optional): Event payload data
  - metadata (optional): Event metadata

Return Values: Array with 6 elements:
- [0]: partition_key (string)
- [1]: partition_id (integer)
- [2]: first_partition_sequence (integer)
- [3]: last_partition_sequence (integer)
- [4]: timestamp (integer, nanoseconds)
- [5]: events array, each containing:
  - [0]: event_id (string)
  - [1]: stream_id (string)
  - [2]: stream_version (integer)

### EGET

Get an event by its unique identifier

`EGET <event_id>`

- event_id (required): UUID of the event to retrieve

Return Values:
- If found: Array with 11 elements:
  - [0]: event_id (string)
  - [1]: partition_key (string)
  - [2]: partition_id (integer)
  - [3]: transaction_id (string)
  - [4]: partition_sequence (integer)
  - [5]: stream_version (integer)
  - [6]: timestamp (integer, nanoseconds)
  - [7]: stream_id (string)
  - [8]: event_name (string)
  - [9]: metadata (bulk string)
  - [10]: payload (bulk string)
- If not found: null

### EPSCAN

Scan events in a partition by sequence number range

`EPSCAN <partition> <start_sequence> <end_sequence> [COUNT <count>]`

- partition (required): Partition selector (partition ID 0-65535 or UUID key)
- start_sequence (required): Starting sequence number (use "-" for beginning)
- end_sequence (required): Ending sequence number (use "+" for end, or specific number)
- count (optional): Maximum number of events to return (defaults to 100)

Return Values: Array with 2 elements:
- [0]: has_more (boolean)
- [1]: events array, each event containing same 11 elements as EGET

### ESCAN

Scan events in a stream by version range

`ESCAN <stream_id> <start_version> <end_version> [PARTITION_KEY <partition_key>] [COUNT <count>]`

- stream_id (required): Stream identifier to scan
- start_version (required): Starting version number (use "-" for beginning)
- end_version (required): Ending version number (use "+" for end, or specific number)
- partition_key (optional): UUID to scan specific partition
- count (optional): Maximum number of events to return (defaults to 100)

Return Values: Array with 2 elements:
- [0]: has_more (boolean)
- [1]: events array, each event containing same 11 elements as EGET

### EPSEQ

Get the current sequence number for a partition

`EPSEQ <partition>`

- partition (required): Partition selector (partition ID 0-65535 or UUID key)

Return Values: Currently returns "Not implemented" (string)

### ESVER

Get the current version number for a stream

`ESVER <stream_id> [PARTITION_KEY <partition_key>]`

- stream_id (required): Stream identifier to get version for
- partition_key (optional): UUID to check specific partition

Return Values: Currently returns "Not implemented" (string)

### PING

Test server connectivity

`PING`

- No parameters

Return Values: "PONG" (string)

## Build and Development Commands

### Installation
First, install dependencies for all packages:
```bash
npm install
cd client && npm install
cd ../server && npm install
cd ../shared && npm install
cd ..
```

### Development
- `npm run dev` - Start both client and server in development mode
- `npm run client:dev` - Start only the React frontend development server
- `npm run server:dev` - Start only the Node.js backend development server

### Building
- `npm run build` - Build both client and server for production
- `npm run client:build` - Build only the React frontend
- `npm run server:build` - Build only the Node.js backend

### Production
- `npm start` - Start the production server (backend only, serves API)

### Code Quality
- `npm run lint` - Run ESLint and fix issues automatically
- `npm run type-check` - Run TypeScript type checking

### Environment Variables
The server accepts these environment variables:
- `PORT` - Server port (default: 3001)
- `SIERRADB_URL` - Redis connection URL for SierraDB (default: redis://localhost:9090)

### Project Structure
- `client/` - React frontend application with Vite build system
- `server/` - Node.js/Express backend API with Redis client for SierraDB
- `shared/` - Shared TypeScript types and Zod schemas for API communication

### Features Implemented
- **Partition Explorer**: Browse events across 1,024 partitions by sequence number
- **Stream Explorer**: Navigate event streams by version number with optional partition filtering
- **Event Lookup**: Search for specific events by UUID with detailed inspection
- **Modern UI**: Tailwind CSS with shadcn/ui components, responsive design
- **Type Safety**: Full TypeScript coverage with runtime validation using Zod
