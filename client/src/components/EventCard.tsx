import { SierraDBEvent } from '../types.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

interface CopyableFieldProps {
  value: string
  children: React.ReactNode
  className?: string
}

function CopyableField({ value, children, className = "" }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card expansion when clicking copyable fields
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }
  
  return (
    <span 
      className={`cursor-pointer hover:bg-primary/10 rounded px-1 py-0.5 transition-colors relative ${className}`}
      onClick={handleCopy}
      title={`Click to copy: ${value}`}
    >
      {children}
      {copied && (
        <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          Copied!
        </span>
      )}
    </span>
  )
}

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
      <CardHeader 
        className="pb-3 pt-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">
            {event.event_name}
          </CardTitle>
          <div className="pointer-events-none">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            <CopyableField value={event.event_id} className="font-mono">
              ...{event.event_id.slice(-8)}
            </CopyableField>
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
                  <div><strong>Event ID:</strong> <CopyableField value={event.event_id} className="font-mono">{event.event_id}</CopyableField></div>
                  <div><strong>Stream ID:</strong> <CopyableField value={event.stream_id} className="font-mono">{event.stream_id}</CopyableField></div>
                  <div><strong>Transaction ID:</strong> <CopyableField value={event.transaction_id} className="font-mono">{event.transaction_id}</CopyableField></div>
                  <div><strong>Partition Key:</strong> <CopyableField value={event.partition_key} className="font-mono">{event.partition_key}</CopyableField></div>
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
            
            {(event.metadata || event.metadata_parsed) && (
              <div>
                <h4 className="font-medium mb-2">Metadata</h4>
                <JsonViewer 
                  content={event.metadata} 
                  encoding={event.metadata_encoding}
                  parsed_data={event.metadata_parsed}
                  title="metadata" 
                />
              </div>
            )}
            
            {(event.payload || event.payload_parsed) && (
              <div>
                <h4 className="font-medium mb-2">Payload</h4>
                <JsonViewer 
                  content={event.payload} 
                  encoding={event.payload_encoding}
                  parsed_data={event.payload_parsed}
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
