import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useURLState } from '@/hooks/useURLState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EventTable } from '@/components/EventTable'
import { api } from '@/lib/api'
import { 
  FileText, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react'

export function StreamExplorer() {
  const { streamId: urlStreamId } = useParams()
  
  const [state, updateState] = useURLState({
    streamId: urlStreamId || '',
    startVersion: '0',
    endVersion: '+',
    partitionKey: '',
    count: '100'
  })
  
  const { streamId, startVersion, endVersion, partitionKey, count } = state
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stream-scan', streamId, startVersion, endVersion, partitionKey, count],
    queryFn: () => api.scanStream(
      streamId,
      startVersion === '' ? 0 : (isNaN(Number(startVersion)) ? startVersion : Number(startVersion)),
      endVersion === '' ? '+' : (isNaN(Number(endVersion)) ? endVersion : Number(endVersion)),
      partitionKey || undefined,
      count ? Number(count) : undefined
    ),
    enabled: !!streamId,
  })

  const handleSearch = () => {
    if (streamId) {
      refetch()
    }
  }

  const loadNext = () => {
    if (data?.events.length && data.has_more) {
      const lastEvent = data.events[data.events.length - 1]
      updateState({
        startVersion: (lastEvent.stream_version + 1).toString(),
        endVersion: '+'
      })
    }
  }

  const loadPrevious = () => {
    if (data?.events.length) {
      const firstEvent = data.events[0]
      const prevVersion = Math.max(0, firstEvent.stream_version - Number(count))
      const updates: any = { startVersion: prevVersion.toString() }
      
      // If endVersion is already '+', keep it as '+' (don't change it)
      if (endVersion !== '+') {
        // Only change endVersion if it's not already '+'
        if (prevVersion === 0) {
          updates.endVersion = '+'
        } else {
          updates.endVersion = (firstEvent.stream_version - 1).toString()
        }
      }
      
      updateState(updates)
    }
  }

  const resetToLatest = () => {
    updateState({
      startVersion: '0',
      endVersion: '+'
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-8 w-8" />
          Stream Explorer
        </h1>
        <p className="text-muted-foreground mt-2">
          Navigate event streams and browse events by version number
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stream Selection</CardTitle>
          <CardDescription>
            Enter a stream ID to explore its events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Stream ID (e.g., user-123, order-456)"
              value={streamId}
              onChange={(e) => updateState({ streamId: e.target.value })}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={!streamId}>
              <Search className="h-4 w-4 mr-2" />
              Load Stream
            </Button>
          </div>
        </CardContent>
      </Card>

      {streamId && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Parameters</CardTitle>
            <CardDescription>
              Configure the version range to scan within stream "{streamId}"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Start Version</label>
                <Input
                  placeholder="0 (beginning)"
                  value={startVersion}
                  onChange={(e) => updateState({ startVersion: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Version</label>
                <Input
                  placeholder="+ (end)"
                  value={endVersion}
                  onChange={(e) => updateState({ endVersion: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Partition Key (Optional)</label>
                <Input
                  placeholder="UUID partition key"
                  value={partitionKey}
                  onChange={(e) => updateState({ partitionKey: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Count</label>
                <Input
                  placeholder="100"
                  value={count}
                  onChange={(e) => updateState({ count: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleSearch} className="flex-1">
                  Scan
                </Button>
                <Button onClick={resetToLatest} variant="outline" size="sm">
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading events...</span>
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Error: {error.message}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Events in Stream "{streamId}"
              <span className="text-sm text-muted-foreground ml-2">
                ({data.events.length} events{data.has_more ? ', more available' : ''})
              </span>
            </h2>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={loadPrevious}
                disabled={!data.events.length || (data.events.length > 0 && data.events[0].stream_version === 0)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button 
                variant="outline" 
                onClick={loadNext}
                disabled={!data.has_more}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>

          {data.events.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No events found in this stream range. The stream may not exist or may be empty.
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="mb-4 text-sm text-muted-foreground">
                Events are ordered by stream version. Each event has a unique version number within its stream.
              </div>
              <EventTable 
                events={data.events}
                hasMore={data.has_more}
                canLoadPrevious={data.events.length > 0 && data.events[0].stream_version > 0}
                onLoadNext={loadNext}
                onLoadPrevious={loadPrevious}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}