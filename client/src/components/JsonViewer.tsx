import { useState } from 'react'
import JsonView from '@uiw/react-json-view'
import { Button } from '@/components/ui/button'
import { BinaryViewer } from '@/components/BinaryViewer'
import { Code, Eye, Database, FileText, Settings } from 'lucide-react'
import { detectDataFormat, type DataDetectionResult } from '@/utils/dataFormatDetection'

interface JsonViewerProps {
  content: string | null
  encoding?: 'base64-cbor' | 'base64-binary' | 'json' | null
  parsed_data?: any
  title?: string
}

type ViewMode = 'structured' | 'raw'
type ManualEncoding = 'auto' | 'json'

export function JsonViewer({ content, encoding, parsed_data, title }: JsonViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('structured')
  const [manualEncoding, setManualEncoding] = useState<ManualEncoding>('auto')

  // Check if content is null or empty (but allow parsed_data to exist without content)
  if (!content && !parsed_data) {
    return (
      <div className="text-muted-foreground text-sm italic">
        No {title?.toLowerCase()} data
      </div>
    )
  }

  // Simplified detection logic since server now handles CBOR parsing
  let detection: DataDetectionResult
  
  if (parsed_data && manualEncoding === 'auto') {
    // Server successfully parsed the data (CBOR -> JSON) - use it directly
    detection = {
      format: 'json', // Server returns parsed CBOR as JSON
      data: parsed_data,
      originalContent: content || '',
    }
  } else if (content && manualEncoding === 'json') {
    // Manual JSON override - try to parse content as JSON
    try {
      const jsonData = JSON.parse(content)
      detection = {
        format: 'json',
        data: jsonData,
        originalContent: content,
      }
    } catch {
      // If JSON parsing fails, fall back to auto-detection
      detection = detectDataFormat(content, encoding)
    }
  } else if (content) {
    // Auto detection using existing logic
    detection = detectDataFormat(content, encoding)
  } else {
    // Only parsed_data is available, no raw content
    detection = {
      format: 'json',
      data: parsed_data,
      originalContent: '',
    }
  }

  // Determine if we have structured data that can be displayed nicely
  const isStructuredData = detection.format === 'json' || detection.format === 'cbor'

  return (
    <div className="space-y-2">
      {/* Format indicator, encoding override, and toggle buttons */}
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {isStructuredData ? (
              <>
                {detection.format === 'cbor' ? (
                  <>
                    <Database className="h-3 w-3" />
                    {manualEncoding !== 'auto' ? 'Manual: CBOR' : 'Server Parsed: CBOR'}
                    {detection.isBase64Encoded && ' (Base64)'}
                  </>
                ) : (
                  <>
                    <FileText className="h-3 w-3" />
                    {manualEncoding !== 'auto' ? `Manual: ${manualEncoding.toUpperCase()}` : 
                     parsed_data && manualEncoding === 'auto' ? 'Server Parsed: JSON' : 'Detected: JSON'}
                  </>
                )}
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" />
                Detected: {detection.format === 'binary' ? 'Binary Data' : detection.format === 'text' ? 'Plain Text' : 'Raw Data'}
              </>
            )}
          </span>
          
          {/* Manual encoding override */}
          <div className="flex items-center gap-1">
            <Settings className="h-3 w-3 text-muted-foreground" />
            <select 
              value={manualEncoding} 
              onChange={(e) => setManualEncoding(e.target.value as ManualEncoding)}
              className="h-7 text-xs border border-border rounded px-2 bg-background"
            >
              <option value="auto">Auto</option>
              <option value="json">JSON</option>
            </select>
          </div>
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
          {isStructuredData ? (
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
          ) : detection.format === 'binary' && content ? (
            <BinaryViewer 
              content={content}
              isBase64Encoded={detection.isBase64Encoded}
              isHexEncoded={detection.isHexEncoded}
            />
          ) : (
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
              {content || detection.data || 'No content'}
            </pre>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
            {isStructuredData ? JSON.stringify(detection.data, null, 2) : (content || detection.data || 'No content')}
          </pre>
        </div>
      )}
    </div>
  )
}