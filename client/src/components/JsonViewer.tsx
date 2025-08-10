import { useState } from 'react'
import JsonView from '@uiw/react-json-view'
import { Button } from '@/components/ui/button'
import { BinaryViewer } from '@/components/BinaryViewer'
import { Code, Eye, Database, FileText } from 'lucide-react'
import { detectDataFormat, type DataDetectionResult } from '@/utils/dataFormatDetection'

interface JsonViewerProps {
  content: string | null
  encoding?: 'base64-cbor' | 'base64-binary' | null
  title?: string
}

type ViewMode = 'structured' | 'raw'

export function JsonViewer({ content, encoding, title }: JsonViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('structured')

  // Check if content is null or empty
  if (!content) {
    return (
      <div className="text-muted-foreground text-sm italic">
        No {title?.toLowerCase()} data
      </div>
    )
  }

  // Detect the data format (use server encoding if provided)
  const detection: DataDetectionResult = detectDataFormat(content, encoding)

  // Handle binary data
  if (detection.format === 'binary') {
    return (
      <div className="space-y-2">
        <div className="flex gap-1 items-center">
          <span className="text-xs text-muted-foreground">
            Detected: Binary Data
          </span>
        </div>
        <BinaryViewer 
          content={content}
          isBase64Encoded={detection.isBase64Encoded}
          isHexEncoded={detection.isHexEncoded}
        />
      </div>
    )
  }

  // Handle text that's not structured
  if (detection.format === 'text') {
    return (
      <div className="space-y-2">
        <div className="flex gap-1 items-center">
          <span className="text-xs text-muted-foreground">
            Detected: Plain Text
          </span>
        </div>
        <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
          {content}
        </pre>
      </div>
    )
  }

  // Handle structured data (JSON or CBOR)
  const isStructuredData = detection.format === 'json' || detection.format === 'cbor'
  
  if (!isStructuredData) {
    return (
      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
        {content}
      </pre>
    )
  }

  return (
    <div className="space-y-2">
      {/* Format indicator and toggle buttons */}
      <div className="flex gap-1 items-center justify-between">
        <div className="flex gap-1 items-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {detection.format === 'cbor' ? (
              <>
                <Database className="h-3 w-3" />
                Detected: CBOR
                {detection.isBase64Encoded && ' (Base64)'}
                {detection.isHexEncoded && ' (Hex)'}
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" />
                Detected: JSON
              </>
            )}
          </span>
        </div>
        
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
      </div>

      {/* Content display */}
      {viewMode === 'structured' ? (
        <div className="bg-muted p-3 rounded overflow-x-auto">
          <JsonView
            value={detection.data}
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
        <div className="space-y-2">
          {detection.format === 'cbor' && (
            <div className="text-xs text-muted-foreground">
              Original CBOR data:
            </div>
          )}
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
            {detection.format === 'cbor' ? content : JSON.stringify(detection.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}