import { SierraDBEvent } from '../types.js'
import { 
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { EventTableRow } from './EventTableRow'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface EventTableProps {
  events: SierraDBEvent[]
  hasMore?: boolean
  canLoadPrevious?: boolean
  onLoadNext?: () => void
  onLoadPrevious?: () => void
}

export function EventTable({ events, hasMore, canLoadPrevious, onLoadNext, onLoadPrevious }: EventTableProps) {
  if (events.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No events found.
      </div>
    )
  }

  const showPagination = onLoadNext || onLoadPrevious

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30px]"></TableHead>
              <TableHead>Event Name</TableHead>
              <TableHead>Event ID</TableHead>
              <TableHead>Stream ID</TableHead>
              <TableHead className="w-[80px]">Partition</TableHead>
              <TableHead className="w-[80px]">Sequence</TableHead>
              <TableHead className="w-[80px]">Version</TableHead>
              <TableHead className="w-[200px]">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <EventTableRow key={event.event_id} event={event} />
            ))}
          </TableBody>
        </Table>
      </div>
      
      {showPagination && (
        <div className="flex justify-center gap-2">
          <Button 
            variant="outline" 
            onClick={onLoadPrevious}
            disabled={!canLoadPrevious}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button 
            variant="outline" 
            onClick={onLoadNext}
            disabled={!hasMore}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}