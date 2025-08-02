import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EventCard } from '@/components/EventCard'
import { api } from '@/lib/api'
import { 
  HardDrive, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react'

export function PartitionExplorer() {
  const { partition: urlPartition } = useParams()
  const navigate = useNavigate()
  
  const [partition, setPartition] = useState(urlPartition || '')
  const [startSequence, setStartSequence] = useState('0')
  const [endSequence, setEndSequence] = useState('+')
  const [count, setCount] = useState('100')
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['partition-scan', partition, startSequence, endSequence, count],
    queryFn: () => api.scanPartition(
      isNaN(Number(partition)) ? partition : Number(partition),
      startSequence === '' ? 0 : (isNaN(Number(startSequence)) ? startSequence : Number(startSequence)),
      endSequence === '' ? '+' : (isNaN(Number(endSequence)) ? endSequence : Number(endSequence)),
      count ? Number(count) : undefined
    ),
    enabled: !!partition,
  })

  const handleSearch = () => {
    if (partition) {
      navigate(`/partitions/${partition}`)
      refetch()
    }
  }

  const getRandomPartition = () => Math.floor(Math.random() * 1024).toString()
  
  const handlePartitionSelect = (partitionId: string) => {
    setPartition(partitionId)
    navigate(`/partitions/${partitionId}`)
  }

  const loadNext = () => {
    if (data?.events.length && data.has_more) {
      const lastEvent = data.events[data.events.length - 1]
      setStartSequence((lastEvent.partition_sequence + 1).toString())
      // Keep endSequence as '+' when going forward
      setEndSequence('+')
    }
  }

  const loadPrevious = () => {
    if (data?.events.length) {
      const firstEvent = data.events[0]
      const prevSequence = Math.max(0, firstEvent.partition_sequence - Number(count))
      setStartSequence(prevSequence.toString())
      
      // If endSequence is already '+', keep it as '+' (don't change it)
      if (endSequence !== '+') {
        // Only change endSequence if it's not already '+'
        if (prevSequence === 0) {
          setEndSequence('+')
        } else {
          setEndSequence((firstEvent.partition_sequence - 1).toString())
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <HardDrive className="h-8 w-8" />
          Partition Explorer
        </h1>
        <p className="text-muted-foreground mt-2">
          Browse events across SierraDB partitions by sequence number
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partition Selection</CardTitle>
          <CardDescription>
            SierraDB has 1,024 partitions (0-1023). Enter a partition ID or UUID, or try these quick options:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quick partition shortcuts */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePartitionSelect('0')}
              >
                First (0)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePartitionSelect('511')}
              >
                Middle (511)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePartitionSelect('1023')}
              >
                Last (1023)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePartitionSelect(getRandomPartition())}
              >
                Random
              </Button>
            </div>
            
            {/* Main partition input */}
            <div className="flex gap-2">
              <Input
                placeholder="Partition ID (0-1023) or UUID"
                value={partition}
                onChange={(e) => setPartition(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={!partition}>
                <Search className="h-4 w-4 mr-2" />
                Load Partition
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {partition && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Parameters</CardTitle>
            <CardDescription>
              Configure the sequence range to scan within partition {partition}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Start Sequence</label>
                <Input
                  placeholder="0 (beginning)"
                  value={startSequence}
                  onChange={(e) => setStartSequence(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Sequence</label>
                <Input
                  placeholder="+ (end)"
                  value={endSequence}
                  onChange={(e) => setEndSequence(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Count</label>
                <Input
                  placeholder="100"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSearch} className="w-full">
                  Scan Events
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
              Events in Partition {partition}
              <span className="text-sm text-muted-foreground ml-2">
                ({data.events.length} events{data.has_more ? ', more available' : ''})
              </span>
            </h2>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={loadPrevious}
                disabled={!data.events.length || (data.events.length > 0 && data.events[0].partition_sequence === 0)}
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
                No events found in this partition range.
              </CardContent>
            </Card>
          ) : (
            <div>
              {data.events.map((event) => (
                <EventCard key={event.event_id} event={event} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}