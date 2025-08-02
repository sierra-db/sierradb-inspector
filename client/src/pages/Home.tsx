import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { 
  Database, 
  HardDrive, 
  Search, 
  FileText,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react'

export function Home() {
  const { data: pingResult, isLoading, error } = useQuery({
    queryKey: ['ping'],
    queryFn: () => api.ping(),
    refetchInterval: 30000,
  })

  const isConnected = pingResult?.result === 'PONG'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">SierraDB Inspector</h1>
        <p className="text-muted-foreground mt-2">
          Explore events, partitions, and streams in your SierraDB cluster
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking connection...</span>
              </>
            ) : isConnected ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-700">Connected to SierraDB</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-700">
                  {error ? `Connection failed: ${error.message}` : 'Not connected'}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Partition Explorer
            </CardTitle>
            <CardDescription>
              Browse events across 1,024 partitions by sequence number
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/partitions">Explore Partitions</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Stream Explorer
            </CardTitle>
            <CardDescription>
              Navigate streams and browse events by version number
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/streams">Explore Streams</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Event Lookup
            </CardTitle>
            <CardDescription>
              Search for specific events by their unique identifier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/events">Lookup Events</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About SierraDB</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <p>
            SierraDB is a distributed event sourcing database with 1,024 logical partitions.
            Events are organized into streams with monotonic version numbers, while partitions
            maintain global sequence numbers for ordering across streams.
          </p>
          <ul className="mt-4 space-y-2">
            <li><strong>Partitions:</strong> 1,024 logical divisions for data distribution</li>
            <li><strong>Streams:</strong> Append-only sequences of related events</li>
            <li><strong>Events:</strong> Immutable records with timestamps and payloads</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}