import { useState } from 'react'
import JsonView from '@uiw/react-json-view'
import { Button } from '@/components/ui/button'
import { Code, Eye } from 'lucide-react'

interface JsonViewerProps {
  content: string | null
  title?: string
}

export function JsonViewer({ content, title }: JsonViewerProps) {
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured')

  // Check if content is null or empty
  if (!content) {
    return (
      <div className="text-muted-foreground text-sm italic">
        No {title?.toLowerCase()} data
      </div>
    )
  }

  // Try to parse JSON
  let parsedJson = null
  let isValidJson = false
  
  try {
    parsedJson = JSON.parse(content)
    isValidJson = true
  } catch {
    isValidJson = false
  }

  // If not valid JSON, just show raw content
  if (!isValidJson) {
    return (
      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
        {content}
      </pre>
    )
  }

  return (
    <div className="space-y-2">
      {/* Toggle buttons for valid JSON */}
      <div className="flex gap-1">
        <Button
          variant={viewMode === 'structured' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('structured')}
          className="h-7 px-2 text-xs"
        >
          <Eye className="h-3 w-3 mr-1" />
          Structured
        </Button>
        <Button
          variant={viewMode === 'raw' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('raw')}
          className="h-7 px-2 text-xs"
        >
          <Code className="h-3 w-3 mr-1" />
          Raw
        </Button>
      </div>

      {/* Content display */}
      {viewMode === 'structured' ? (
        <div className="bg-muted p-3 rounded overflow-x-auto">
          <JsonView
            value={parsedJson}
            collapsed={2}
            displayDataTypes={false}
            enableClipboard={false}
            style={{
              backgroundColor: 'transparent',
              fontSize: '12px',
            }}
          />
        </div>
      ) : (
        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(parsedJson, null, 2)}
        </pre>
      )}
    </div>
  )
}