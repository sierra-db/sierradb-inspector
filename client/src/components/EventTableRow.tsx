import { SierraDBEvent } from '../types.js'
import { TableCell, TableRow } from '@/components/ui/table'
import { JsonViewer } from '@/components/JsonViewer'
import { useTimestamp } from '@/contexts/TimestampContext'
import { 
  ChevronDown,
  ChevronRight,
  Hash,
  Database,
  FileText,
  Layers
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
    e.stopPropagation()
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
        <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
          Copied!
        </span>
      )}
    </span>
  )
}

interface EventTableRowProps {
  event: SierraDBEvent
}

export function EventTableRow({ event }: EventTableRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { formatTimestamp } = useTimestamp()

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-[30px] p-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium">
          {event.event_name}
        </TableCell>
        <TableCell>
          <CopyableField value={event.event_id} className="font-mono text-sm">
            {event.event_id}
          </CopyableField>
        </TableCell>
        <TableCell>
          <CopyableField value={event.stream_id} className="font-mono text-sm">
            {event.stream_id}
          </CopyableField>
        </TableCell>
        <TableCell className="text-center">
          {event.partition_id}
        </TableCell>
        <TableCell className="text-center">
          {event.partition_sequence}
        </TableCell>
        <TableCell className="text-center">
          {event.stream_version}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {formatTimestamp(event.timestamp)}
        </TableCell>
      </TableRow>
      
      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="p-0">
            <div className="bg-muted/30 p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Event Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Event ID:</strong> <CopyableField value={event.event_id} className="font-mono">{event.event_id}</CopyableField></div>
                    <div><strong>Stream ID:</strong> <CopyableField value={event.stream_id} className="font-mono">{event.stream_id}</CopyableField></div>
                    <div><strong>Transaction ID:</strong> <CopyableField value={event.transaction_id} className="font-mono">{event.transaction_id}</CopyableField></div>
                    <div><strong>Partition Key:</strong> <CopyableField value={event.partition_key} className="font-mono">{event.partition_key}</CopyableField></div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Positioning
                  </h4>
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
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Metadata
                  </h4>
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
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Payload
                  </h4>
                  <JsonViewer 
                    content={event.payload} 
                    encoding={event.payload_encoding}
                    parsed_data={event.payload_parsed}
                    title="payload" 
                  />
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}