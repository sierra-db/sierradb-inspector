import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Code, Binary, FileText } from 'lucide-react'
import { toHexString } from '@/utils/dataFormatDetection'

interface BinaryViewerProps {
  content: string
  isBase64Encoded?: boolean
  isHexEncoded?: boolean
}

type BinaryViewMode = 'hex' | 'base64' | 'raw'

export function BinaryViewer({ 
  content, 
  isBase64Encoded = false, 
  isHexEncoded = false
}: BinaryViewerProps) {
  const [viewMode, setViewMode] = useState<BinaryViewMode>(() => {
    if (isBase64Encoded) return 'base64'
    if (isHexEncoded) return 'hex'
    return 'hex'
  })

  // Convert content to different formats
  const getHexString = () => {
    if (isBase64Encoded) {
      return toHexString(content, 'base64')
    }
    if (isHexEncoded) {
      return content.toLowerCase()
    }
    return toHexString(content)
  }

  const getBase64String = () => {
    if (isBase64Encoded) {
      return content
    }
    if (isHexEncoded) {
      // Convert hex to base64
      const bytes = content.match(/.{2}/g)?.map(byte => parseInt(byte, 16)) || []
      const binaryString = String.fromCharCode(...bytes)
      return btoa(binaryString)
    }
    // Convert raw text to base64
    return btoa(content)
  }

  const formatHexWithAscii = (hexString: string) => {
    const lines: string[] = []
    const bytesPerLine = 16

    for (let i = 0; i < hexString.length; i += bytesPerLine * 2) {
      const lineHex = hexString.substr(i, bytesPerLine * 2)
      const offset = (i / 2).toString(16).padStart(8, '0').toUpperCase()
      
      // Format hex bytes with spaces
      const hexBytes = lineHex.match(/.{2}/g) || []
      const formattedHex = hexBytes.join(' ').padEnd(bytesPerLine * 3 - 1, ' ')
      
      // Generate ASCII representation
      const ascii = hexBytes
        .map(byte => {
          const code = parseInt(byte, 16)
          return code >= 32 && code <= 126 ? String.fromCharCode(code) : '.'
        })
        .join('')
        .padEnd(bytesPerLine, ' ')

      lines.push(`${offset}: ${formattedHex} |${ascii}|`)
    }

    return lines.join('\n')
  }

  const getDisplayContent = () => {
    const hexString = getHexString()
    
    switch (viewMode) {
      case 'hex':
        return formatHexWithAscii(hexString)
      case 'base64':
        return getBase64String()
      case 'raw':
        return content
      default:
        return content
    }
  }

  const getDataInfo = () => {
    const hexString = getHexString()
    const byteCount = hexString.length / 2
    const encoding = isBase64Encoded ? 'Base64' : isHexEncoded ? 'Hex' : 'Raw'
    
    return `${byteCount} bytes (${encoding} encoded)`
  }

  return (
    <div className="space-y-2">
      {/* View mode toggle buttons */}
      <div className="flex gap-1 items-center justify-between">
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'hex' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('hex')}
            className="h-7 px-2 text-xs"
          >
            <Binary className="h-3 w-3 mr-1" />
            Hex Dump
          </Button>
          <Button
            variant={viewMode === 'base64' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('base64')}
            className="h-7 px-2 text-xs"
          >
            <Code className="h-3 w-3 mr-1" />
            Base64
          </Button>
          <Button
            variant={viewMode === 'raw' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('raw')}
            className="h-7 px-2 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            Raw
          </Button>
        </div>
        
        {/* Data info */}
        <div className="text-xs text-muted-foreground">
          {getDataInfo()}
        </div>
      </div>

      {/* Content display */}
      <div className="bg-muted p-3 rounded overflow-x-auto">
        <pre 
          className={`text-xs whitespace-pre ${
            viewMode === 'hex' ? 'font-mono leading-relaxed' : 'whitespace-pre-wrap'
          }`}
        >
          {getDisplayContent()}
        </pre>
      </div>

      {/* Helpful info for hex dump */}
      {viewMode === 'hex' && (
        <div className="text-xs text-muted-foreground">
          Format: OFFSET: HEX_BYTES |ASCII|
        </div>
      )}
    </div>
  )
}