import { useState, useRef, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { JsonViewer } from '@/components/JsonViewer'
import { 
  Calculator, 
  Play, 
  Square, 
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { ProjectionProgress, ProjectionRunRequest } from '../types.js'

const defaultProjectionCode = `// Projection function
// - state: current projection state (starts as null)
// - event: current event being processed
// - return: new projection state
function project(state, event) {
  // Initialize state on first run
  if (!state) {
    state = {
      eventCount: 0,
      eventsByType: {},
      streamCount: {}
    };
  }
  
  // Process the event
  state.eventCount++;
  
  // Count events by type
  state.eventsByType[event.event_name] = 
    (state.eventsByType[event.event_name] || 0) + 1;
  
  // Count events by stream
  state.streamCount[event.stream_id] = 
    (state.streamCount[event.stream_id] || 0) + 1;
  
  return state;
}`

export function ProjectionRunner() {
  const [code, setCode] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('projection-code')
    return saved || defaultProjectionCode
  })
  
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<ProjectionProgress | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const saveCodeToStorage = useCallback(() => {
    localStorage.setItem('projection-code', code)
  }, [code])

  const runProjection = async () => {
    if (isRunning) return

    try {
      setIsRunning(true)
      setProgress(null)
      saveCodeToStorage()

      const requestBody: ProjectionRunRequest = {
        code,
        initialState: null
      }

      // Close existing EventSource if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      // Note: EventSource only supports GET requests, so we use fetch with custom SSE handling
      const response = await fetch('/api/projections/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Handle SSE manually
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6))
                if (data.current_partition !== undefined) {
                  setProgress(data)
                  
                  if (data.status === 'completed' || data.status === 'error') {
                    setIsRunning(false)
                  }
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

    } catch (error) {
      console.error('Error running projection:', error)
      setProgress({
        current_partition: 0,
        total_partitions: 0,
        events_processed: 0,
        current_state: null,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      setIsRunning(false)
    }
  }

  const stopProjection = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsRunning(false)
  }

  const resetProjection = () => {
    setProgress(null)
    setCode(defaultProjectionCode)
  }

  const getStatusIcon = () => {
    if (!progress) return null
    
    switch (progress.status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
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
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Calculator className="h-8 w-8" />
          Projection Runner
        </h1>
        <p className="text-muted-foreground mt-2">
          Write and run custom projections across all events in SierraDB
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code Editor */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Projection Code</CardTitle>
            <CardDescription>
              Write a JavaScript function that processes each event and maintains projection state
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <Editor
                  height="800px"
                  defaultLanguage="javascript"
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    tabSize: 2,
                  }}
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={runProjection} 
                  disabled={isRunning || !code.trim()}
                  className="flex items-center gap-2"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {isRunning ? 'Running...' : 'Run Projection'}
                </Button>
                
                {isRunning && (
                  <Button 
                    variant="outline" 
                    onClick={stopProjection}
                    className="flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  onClick={resetProjection}
                  disabled={isRunning}
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress and Results */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Progress & Results
              {getStatusIcon()}
            </CardTitle>
            <CardDescription>
              Live projection progress and current state
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {progress && (
                <>
                  {/* Progress Bar */}
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

                  {/* Status */}
                  <div className="flex items-center gap-2 p-2 rounded bg-muted">
                    {getStatusIcon()}
                    <span className="text-sm font-medium">
                      Status: {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
                    </span>
                    {progress.error && (
                      <span className="text-xs text-red-600 ml-2">
                        {progress.error}
                      </span>
                    )}
                  </div>

                  {/* Current State */}
                  {progress.current_state && (
                    <div>
                      <h4 className="font-medium mb-2">Current Projection State</h4>
                      <div className="border rounded-lg p-2 max-h-[40rem] overflow-auto">
                        <JsonViewer 
                          content={JSON.stringify(progress.current_state, null, 2)} 
                          title="projection-state"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {!progress && (
                <div className="text-center text-muted-foreground py-8">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Run Projection" to start processing events</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>How to Write Projections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Function Signature:</h4>
              <code className="bg-muted px-2 py-1 rounded">function project(state, event)</code>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Parameters:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>state</strong>: Current projection state (null on first event)</li>
                <li><strong>event</strong>: Current SierraDB event being processed</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Return Value:</h4>
              <p>Return the updated projection state. This will be passed as <code>state</code> to the next event.</p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Event Object Properties:</h4>
              <ul className="list-disc pl-6 space-y-1">
                <li><code>event_id</code>, <code>event_name</code>, <code>stream_id</code></li>
                <li><code>partition_id</code>, <code>partition_sequence</code>, <code>stream_version</code></li>
                <li><code>timestamp</code>, <code>payload</code>, <code>metadata</code></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
