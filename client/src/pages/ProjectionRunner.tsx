import { useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JsonViewer } from '@/components/JsonViewer'
import { useSavedProjections } from '@/hooks/useSavedProjections'
import { 
  Calculator, 
  Play, 
  Square, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Bug,
  StepForward,
  RotateCcw,
  Save,
  X
} from 'lucide-react'
import { ProjectionProgress, ProjectionRunRequest, DebugSessionStatus } from '../types.js'
import { api } from '@/lib/api'

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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { saveProjection, updateProjection, getProjection } = useSavedProjections()
  
  const editId = searchParams.get('edit')
  const editingProjection = editId ? getProjection(editId) : null
  
  const [code, setCode] = useState(() => {
    if (editingProjection) return editingProjection.code
    // Load from localStorage if available
    const saved = localStorage.getItem('projection-code')
    return saved || defaultProjectionCode
  })
  
  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState(editingProjection?.name || '')
  const [saveDescription, setSaveDescription] = useState(editingProjection?.description || '')
  const [saveCategory, setSaveCategory] = useState(editingProjection?.category || '')
  const [saveRenderMode, setSaveRenderMode] = useState<'html' | 'json'>(editingProjection?.renderMode || 'html')
  
  // Normal mode state
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<ProjectionProgress | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  
  // Debug mode state
  const [debugMode, setDebugMode] = useState(false)
  const [debugSession, setDebugSession] = useState<DebugSessionStatus | null>(null)
  const [isDebugging, setIsDebugging] = useState(false)
  const [debugSessionId, setDebugSessionId] = useState<string | null>(null)
  
  // Stream mode state
  const [streamMode, setStreamMode] = useState(editingProjection?.streamId ? true : false)
  const [streamId, setStreamId] = useState(editingProjection?.streamId || '')

  // Load projection when editing
  useEffect(() => {
    if (editingProjection) {
      setCode(editingProjection.code)
      setSaveName(editingProjection.name)
      setSaveDescription(editingProjection.description || '')
      setSaveCategory(editingProjection.category || '')
      setSaveRenderMode(editingProjection.renderMode)
      if (editingProjection.streamId) {
        setStreamMode(true)
        setStreamId(editingProjection.streamId)
      }
    }
  }, [editingProjection])

  const saveCodeToStorage = useCallback(() => {
    localStorage.setItem('projection-code', code)
  }, [code])

  const handleSaveProjection = async () => {
    if (!saveName.trim()) {
      alert('Please enter a name for the projection')
      return
    }

    try {
      if (editingProjection) {
        // Update existing projection
        updateProjection(editingProjection.id, {
          name: saveName,
          description: saveDescription,
          category: saveCategory,
          code,
          renderMode: saveRenderMode,
          streamId: streamMode ? streamId : undefined
        })
      } else {
        // Save new projection
        saveProjection({
          name: saveName,
          description: saveDescription,
          category: saveCategory,
          code,
          renderMode: saveRenderMode,
          streamId: streamMode ? streamId : undefined
        })
      }

      setShowSaveDialog(false)
      
      // Navigate to the saved projections page after saving
      setTimeout(() => {
        navigate('/saved-projections')
      }, 100)
    } catch (error) {
      alert('Failed to save projection')
      console.error('Save error:', error)
    }
  }

  const openSaveDialog = () => {
    if (!editingProjection && !saveName) {
      // Auto-generate a name based on the current timestamp
      setSaveName(`Projection ${new Date().toLocaleDateString()}`)
    }
    setShowSaveDialog(true)
  }

  const runProjection = async () => {
    if (isRunning) return

    try {
      setIsRunning(true)
      setProgress(null)
      saveCodeToStorage()

      const requestBody: ProjectionRunRequest = {
        code,
        initialState: null,
        ...(streamMode && streamId.trim() && { streamId: streamId.trim() })
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

      // Handle SSE manually with proper buffering for large payloads
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Append new chunk to buffer
          buffer += decoder.decode(value, { stream: true })
          
          // Process complete lines from buffer
          const lines = buffer.split('\n')
          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonString = line.substring(6)
                // Skip empty data lines
                if (jsonString.trim()) {
                  const data = JSON.parse(jsonString)
                  if (data.current_partition !== undefined) {
                    setProgress(data)
                    
                    if (data.status === 'completed' || data.status === 'error') {
                      setIsRunning(false)
                    }
                  }
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e, 'Line:', line.substring(6))
              }
            }
          }
        }
        
        // Process any remaining data in buffer
        if (buffer.trim() && buffer.startsWith('data: ')) {
          try {
            const jsonString = buffer.substring(6)
            if (jsonString.trim()) {
              const data = JSON.parse(jsonString)
              if (data.current_partition !== undefined) {
                setProgress(data)
                
                if (data.status === 'completed' || data.status === 'error') {
                  setIsRunning(false)
                }
              }
            }
          } catch (e) {
            console.error('Error parsing remaining SSE data:', e, 'Buffer:', buffer.substring(6))
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

  // Debug mode functions
  const startDebugSession = async () => {
    if (isDebugging || !code.trim()) return

    try {
      setIsDebugging(true)
      saveCodeToStorage()

      const response = await api.debugSessionStart({
        code,
        initialState: null,
        ...(streamMode && streamId.trim() && { streamId: streamId.trim() })
      })

      setDebugSessionId(response.sessionId)
      
      // Get initial session status
      const status = await api.debugSessionStatus(response.sessionId)
      setDebugSession(status)

    } catch (error) {
      console.error('Error starting debug session:', error)
      setIsDebugging(false)
    }
  }

  const stepDebugSession = async () => {
    if (!debugSessionId) return

    try {
      const response = await api.debugSessionStep({ sessionId: debugSessionId })
      setDebugSession(response.sessionStatus)

      if (response.processingComplete) {
        setIsDebugging(false)
      }
    } catch (error) {
      console.error('Error stepping debug session:', error)
      setIsDebugging(false)
    }
  }

  const resetDebugSession = async () => {
    if (!debugSessionId) return

    try {
      const status = await api.debugSessionReset({ sessionId: debugSessionId })
      setDebugSession(status)
    } catch (error) {
      console.error('Error resetting debug session:', error)
    }
  }

  const stopDebugSession = async () => {
    if (debugSessionId) {
      try {
        await api.debugSessionDestroy(debugSessionId)
      } catch (error) {
        console.error('Error destroying debug session:', error)
      }
    }
    
    setDebugSessionId(null)
    setDebugSession(null)
    setIsDebugging(false)
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
    <div className="h-screen flex flex-col">
      <div className="p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calculator className="h-8 w-8" />
              {editingProjection ? `Edit: ${editingProjection.name}` : 'Projection Runner'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {editingProjection 
                ? 'Edit and update your saved projection'
                : 'Write and run custom projections across all events or specific streams in SierraDB'
              }
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <Button
              onClick={openSaveDialog}
              disabled={!code.trim()}
              variant="outline"
            >
              <Save className="h-4 w-4 mr-2" />
              {editingProjection ? 'Update' : 'Save'} Projection
            </Button>
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              <label className="text-sm font-medium">Debug Mode</label>
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => {
                  setDebugMode(e.target.checked)
                  // Clean up any active sessions when switching modes
                  if (!e.target.checked) {
                    stopDebugSession()
                  }
                  if (e.target.checked) {
                    stopProjection()
                  }
                }}
                className="w-4 h-4"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Stream Mode</label>
              <input
                type="checkbox"
                checked={streamMode}
                onChange={(e) => setStreamMode(e.target.checked)}
                className="w-4 h-4"
              />
              {streamMode && (
                <input
                  type="text"
                  placeholder="Enter stream ID"
                  value={streamId}
                  onChange={(e) => setStreamId(e.target.value)}
                  className="ml-2 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 p-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
          {/* Code Editor */}
          <Card className="lg:col-span-1 flex flex-col h-full">
          <CardHeader>
            <CardTitle>Projection Code</CardTitle>
            <CardDescription>
              Write a JavaScript function that processes each event and maintains projection state
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="border rounded-lg overflow-hidden flex-1">
                <Editor
                  height="100%"
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
                {debugMode ? (
                  // Debug mode controls
                  <>
                    {!debugSessionId ? (
                      <Button 
                        onClick={startDebugSession} 
                        disabled={isDebugging || !code.trim()}
                        className="flex items-center gap-2"
                      >
                        {isDebugging ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Bug className="h-4 w-4" />
                        )}
                        {isDebugging ? 'Starting...' : 'Start Debug'}
                      </Button>
                    ) : (
                      <>
                        <Button 
                          onClick={stepDebugSession} 
                          disabled={debugSession?.status === 'completed' || debugSession?.status === 'error'}
                          className="flex items-center gap-2"
                        >
                          <StepForward className="h-4 w-4" />
                          Step
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          onClick={resetDebugSession}
                          disabled={debugSession?.status === 'running'}
                          className="flex items-center gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Reset
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          onClick={stopDebugSession}
                          className="flex items-center gap-2"
                        >
                          <Square className="h-4 w-4" />
                          Stop
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  // Normal mode controls
                  <>
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
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Progress and Results / Debug Interface */}
          <Card className="lg:col-span-1 flex flex-col h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {debugMode ? 'Debug Interface' : 'Progress & Results'}
              {debugMode && debugSession?.status === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              {debugMode && debugSession?.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
              {debugMode && debugSession?.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
              {!debugMode && getStatusIcon()}
            </CardTitle>
            <CardDescription>
              {debugMode 
                ? 'Step through events and inspect state changes' 
                : 'Live projection progress and current state'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {debugMode ? (
              // Debug Mode Interface
              <div className="space-y-4">
                {debugSession ? (
                  <>
                    {/* Debug Status */}
                    <div className="flex items-center gap-2 p-2 rounded bg-muted">
                      <Bug className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Status: {debugSession.status.charAt(0).toUpperCase() + debugSession.status.slice(1)}
                      </span>
                      {debugSession.error && (
                        <span className="text-xs text-red-600 ml-2">
                          {debugSession.error}
                        </span>
                      )}
                    </div>

                    {/* Event Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Event Progress</span>
                        <span>{debugSession.currentEventIndex} / {debugSession.totalEventsLoaded}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${debugSession.totalEventsLoaded > 0 
                              ? Math.round((debugSession.currentEventIndex / debugSession.totalEventsLoaded) * 100) 
                              : 0}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* Current Event */}
                    {debugSession.currentEvent && (
                      <div>
                        <h4 className="font-medium mb-2">Current Event</h4>
                        <div className="border rounded-lg p-3 space-y-2 text-sm">
                          <div><strong>ID:</strong> <span className="font-mono text-xs">{debugSession.currentEvent.event_id}</span></div>
                          <div><strong>Type:</strong> {debugSession.currentEvent.event_name}</div>
                          <div><strong>Stream:</strong> {debugSession.currentEvent.stream_id}</div>
                          <div><strong>Partition:</strong> {debugSession.currentEvent.partition_id}</div>
                        </div>
                      </div>
                    )}

                    {/* State Comparison */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <h4 className="font-medium mb-2">Previous State</h4>
                        <div className="border rounded-lg p-2 max-h-60 overflow-auto bg-gray-50">
                          <JsonViewer 
                            content={JSON.stringify(debugSession.previousState, null, 2)} 
                            title="previous-state"
                          />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Current State</h4>
                        <div className="border rounded-lg p-2 max-h-60 overflow-auto">
                          <JsonViewer 
                            content={JSON.stringify(debugSession.currentState, null, 2)} 
                            title="current-state"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Console Logs */}
                    {debugSession.consoleLogs.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Console Output</h4>
                        <div className="border rounded-lg p-2 max-h-40 overflow-auto bg-black text-green-400 font-mono text-xs">
                          {debugSession.consoleLogs.map((log, index) => (
                            <div key={index} className={`mb-1 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'}`}>
                              <span className="text-gray-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    <Bug className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Click "Start Debug" to begin debugging your projection</p>
                  </div>
                )}
              </div>
            ) : (
              // Normal Mode Interface
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
            )}
          </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{editingProjection ? 'Update' : 'Save'} Projection</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSaveDialog(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
              <CardDescription>
                {editingProjection 
                  ? 'Update the projection settings'
                  : 'Save this projection for later use and custom HTML rendering'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Name *</label>
                <Input
                  placeholder="e.g., Active Games, Revenue Summary"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Input
                  placeholder="Brief description of what this projection does"
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Input
                  placeholder="e.g., Analytics, Reports, Dashboard"
                  value={saveCategory}
                  onChange={(e) => setSaveCategory(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Display Mode</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="html"
                      checked={saveRenderMode === 'html'}
                      onChange={(e) => setSaveRenderMode(e.target.value as 'html')}
                    />
                    <span className="text-sm">HTML (Smart rendering)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="json"
                      checked={saveRenderMode === 'json'}
                      onChange={(e) => setSaveRenderMode(e.target.value as 'json')}
                    />
                    <span className="text-sm">JSON (Raw data)</span>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSaveProjection} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {editingProjection ? 'Update' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
