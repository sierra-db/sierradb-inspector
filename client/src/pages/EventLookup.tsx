import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EventCard } from '@/components/EventCard'
import { api } from '@/lib/api'
import { 
  Search, 
  Loader2,
  AlertCircle,
  Copy,
  CheckCircle
} from 'lucide-react'

export function EventLookup() {
  const { eventId: urlEventId } = useParams()
  const navigate = useNavigate()
  
  const [eventId, setEventId] = useState(urlEventId || '')
  const [copied, setCopied] = useState(false)
  
  const { data: event, isLoading, error, refetch } = useQuery({
    queryKey: ['event-get', eventId],
    queryFn: () => api.getEvent(eventId),
    enabled: !!eventId,
  })

  const handleSearch = () => {
    if (eventId) {
      navigate(`/events/${encodeURIComponent(eventId)}`)
      refetch()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const copyEventId = async () => {
    if (event?.event_id) {
      await navigator.clipboard.writeText(event.event_id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const sampleEventIds = [
    '550e8400-e29b-41d4-a716-446655440000',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Search className="h-8 w-8" />
          Event Lookup
        </h1>
        <p className="text-muted-foreground mt-2">
          Search for specific events by their unique identifier (UUID)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event ID Search</CardTitle>
          <CardDescription>
            Enter the unique event ID (UUID) to retrieve event details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Event ID (UUID, e.g., 550e8400-e29b-41d4-a716-446655440000)"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 font-mono"
              />
              <Button onClick={handleSearch} disabled={!eventId}>
                <Search className="h-4 w-4 mr-2" />
                Lookup
              </Button>
            </div>
            
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Try these sample event IDs (these may not exist in your database):
              </p>
              <div className="flex flex-wrap gap-2">
                {sampleEventIds.map((sampleId) => (
                  <Button
                    key={sampleId}
                    variant="outline"
                    size="sm"
                    onClick={() => setEventId(sampleId)}
                    className="font-mono text-xs"
                  >
                    {sampleId.slice(0, 8)}...
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Looking up event...</span>
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

      {eventId && !isLoading && !error && event === null && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Event Not Found</h3>
              <p>No event was found with ID: <span className="font-mono">{eventId}</span></p>
              <p className="text-sm mt-2">
                The event may not exist, or the ID might be incorrect.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {event && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Event Details</h2>
            <Button 
              variant="outline" 
              size="sm"
              onClick={copyEventId}
              className="flex items-center gap-2"
            >
              {copied ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy ID'}
            </Button>
          </div>
          
          <EventCard event={event} />
          
          <Card>
            <CardHeader>
              <CardTitle>Related Navigation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  asChild
                >
                  <a href={`/partitions/${event.partition_id}`}>
                    View Partition {event.partition_id}
                  </a>
                </Button>
                <Button 
                  variant="outline" 
                  asChild
                >
                  <a href={`/streams/${encodeURIComponent(event.stream_id)}`}>
                    View Stream "{event.stream_id}"
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}