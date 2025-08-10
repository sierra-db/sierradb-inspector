import { SierraDBEvent } from '../types.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { JsonViewer } from '@/components/JsonViewer'
import { 
  Calendar, 
  Hash, 
  FileText, 
  Database,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'

interface EventCardProps {
  event: SierraDBEvent
}

export function EventCard({ event }: EventCardProps) {
  const [expanded, setExpanded] = useState(false)
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">
            {event.event_name}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            <span className="font-mono">{event.event_id.slice(0, 8)}...</span>
          </div>
          <div className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            <span>Partition {event.partition_id}</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>Version {event.stream_version}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatTimestamp(event.timestamp)}</span>
          </div>
        </div>
      </CardHeader>
      
      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Event Details</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Event ID:</strong> <span className="font-mono">{event.event_id}</span></div>
                  <div><strong>Stream ID:</strong> <span className="font-mono">{event.stream_id}</span></div>
                  <div><strong>Transaction ID:</strong> <span className="font-mono">{event.transaction_id}</span></div>
                  <div><strong>Partition Key:</strong> <span className="font-mono">{event.partition_key}</span></div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Positioning</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Partition ID:</strong> {event.partition_id}</div>
                  <div><strong>Partition Sequence:</strong> {event.partition_sequence}</div>
                  <div><strong>Stream Version:</strong> {event.stream_version}</div>
                  <div><strong>Timestamp:</strong> {formatTimestamp(event.timestamp)}</div>
                </div>
              </div>
            </div>
            
            {event.metadata && (
              <div>
                <h4 className="font-medium mb-2">Metadata</h4>
                <JsonViewer 
                  content={event.metadata} 
                  encoding={event.metadata_encoding}
                  title="metadata" 
                />
              </div>
            )}
            
            {event.payload && (
              <div>
                <h4 className="font-medium mb-2">Payload</h4>
                <JsonViewer 
                  content={event.payload} 
                  encoding={event.payload_encoding}
                  title="payload" 
                />
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
