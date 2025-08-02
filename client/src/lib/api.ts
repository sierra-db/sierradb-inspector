import {
  PartitionScanResponse,
  StreamScanResponse,
  EventGetResponse,
  PingResponse,
} from '../types.js'

const API_BASE = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`)
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiError(response.status, errorData.error || `HTTP ${response.status}`)
  }
  
  return response.json()
}

export const api = {
  async ping(): Promise<{ result: PingResponse }> {
    return fetchApi('/ping')
  },

  async getEvent(eventId: string): Promise<EventGetResponse> {
    return fetchApi(`/events/${encodeURIComponent(eventId)}`)
  },

  async scanPartition(
    partition: number | string,
    startSequence: number | string = 0,
    endSequence: number | string = '+',
    count?: number
  ): Promise<PartitionScanResponse> {
    const params = new URLSearchParams({
      start_sequence: startSequence.toString(),
      end_sequence: endSequence.toString(),
    })
    
    if (count !== undefined) {
      params.set('count', count.toString())
    }
    
    return fetchApi(`/partitions/${encodeURIComponent(partition)}/scan?${params}`)
  },

  async scanStream(
    streamId: string,
    startVersion: number | string = 0,
    endVersion: number | string = '+',
    partitionKey?: string,
    count?: number
  ): Promise<StreamScanResponse> {
    const params = new URLSearchParams({
      start_version: startVersion.toString(),
      end_version: endVersion.toString(),
    })
    
    if (partitionKey) {
      params.set('partition_key', partitionKey)
    }
    
    if (count !== undefined) {
      params.set('count', count.toString())
    }
    
    return fetchApi(`/streams/${encodeURIComponent(streamId)}/scan?${params}`)
  },
}

export { ApiError }