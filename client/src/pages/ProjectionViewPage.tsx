import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { HTMLRenderer } from '@/components/HTMLRenderer'
import { JsonViewer } from '@/components/JsonViewer'
import { useSavedProjections, useProjectionResults, useProjectionRunner } from '@/hooks/useSavedProjections'
import { 
  Play,
  Square,
  Eye,
  Code2,
  ArrowLeft,
  Edit,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Settings
} from 'lucide-react'

export function ProjectionViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getProjection } = useSavedProjections()
  const { getResult } = useProjectionResults()
  const { isRunning, progress, result, runProjection, stopProjection } = useProjectionRunner(id!)
  
  const [viewMode, setViewMode] = useState<'html' | 'json'>('html')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null)

  const projection = getProjection(id!)
  const storedResult = getResult(id!)

  useEffect(() => {
    if (!projection) {
      navigate('/saved-projections')
      return
    }

    // Set initial view mode based on projection preference
    setViewMode(projection.renderMode === 'html' ? 'html' : 'json')
  }, [projection, navigate])

  useEffect(() => {
    // Auto-refresh logic
    if (autoRefresh && !isRunning) {
      const interval = setInterval(() => {
        runProjection()
      }, 30000) // Refresh every 30 seconds
      
      setRefreshInterval(interval)
      return () => clearInterval(interval)
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }, [autoRefresh, isRunning, runProjection])

  if (!projection) {
    return (
      <div className="flex items-center justify-center py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Projection Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The requested projection could not be found.
            </p>
            <Button asChild>
              <Link to="/saved-projections">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Saved Projections
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentData = result || storedResult?.result
  const currentStatus = progress?.status || storedResult?.status
  const hasData = currentData !== null && currentData !== undefined

  const getStatusIcon = () => {
    if (isRunning) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    
    switch (currentStatus) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      default:
        return null
    }
  }

  const getProgressPercentage = () => {
    if (!progress || progress.total_partitions === 0) return 0
    return Math.round((progress.current_partition / progress.total_partitions) * 100)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/saved-projections">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
          </div>
          
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {projection.name}
            {getStatusIcon()}
          </h1>
          
          {projection.description && (
            <p className="text-muted-foreground mt-2">{projection.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-primary/10' : ''}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          
          <Button variant="outline" asChild>
            <Link to={`/projections?edit=${projection.id}`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          
          <Button 
            onClick={isRunning ? stopProjection : runProjection}
            disabled={!projection}
          >
            {isRunning ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Projection Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Created</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(projection.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Last Run</p>
                <p className="text-xs text-muted-foreground">
                  {storedResult?.lastRun 
                    ? new Date(storedResult.lastRun).toLocaleDateString()
                    : 'Never'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Render Mode</p>
                <p className="text-xs text-muted-foreground">
                  {projection.renderMode === 'html' ? 'HTML Display' : 'JSON Display'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Events Processed</p>
                <p className="text-xs text-muted-foreground">
                  {storedResult?.eventsProcessed?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar (when running) */}
      {progress && isRunning && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing Partitions</span>
                <span>{progress.current_partition} / {progress.total_partitions}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {getProgressPercentage()}% complete • {progress.events_processed.toLocaleString()} events processed
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {currentStatus === 'error' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Projection Error</p>
                <p className="text-sm">{progress?.error || storedResult?.error || 'Unknown error occurred'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Projection Results</CardTitle>
              <CardDescription>
                {hasData 
                  ? `Data visualization ${viewMode === 'html' ? 'with custom HTML rendering' : 'as JSON'}`
                  : 'No data available - run the projection to see results'
                }
              </CardDescription>
            </div>
            
            {hasData && (
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'html' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('html')}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  HTML
                </Button>
                <Button
                  variant={viewMode === 'json' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('json')}
                >
                  <Code2 className="h-4 w-4 mr-1" />
                  JSON
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {!hasData ? (
            <div className="text-center py-12">
              <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Run the projection to see results here
              </p>
            </div>
          ) : viewMode === 'html' ? (
            <HTMLRenderer 
              data={currentData}
              title={projection.name}
              description={projection.description}
              config={{
                template: 'auto',
                title: projection.name,
                description: projection.description
              }}
            />
          ) : (
            <JsonViewer 
              content={JSON.stringify(currentData, null, 2)}
              title="projection-result"
            />
          )}
        </CardContent>
      </Card>
      
      {/* Stream Filter Info */}
      {projection.streamId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stream Filter</CardTitle>
            <CardDescription>
              This projection only processes events from the specified stream
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="font-mono">
              Stream: {projection.streamId}
            </Badge>
          </CardContent>
        </Card>
      )}
      
      {/* Code Preview */}
      {projection.code && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projection Code</CardTitle>
            <CardDescription>
              The JavaScript function that processes events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
              {projection.code}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}