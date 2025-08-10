import { decode } from 'cbor-x/decode'

export type DataFormat = 'json' | 'cbor' | 'binary' | 'text'

export interface DataDetectionResult {
  format: DataFormat
  data: any
  originalContent: string
  isBase64Encoded?: boolean
  isHexEncoded?: boolean
}

/**
 * Check if a string is valid base64
 */
function isBase64(str: string): boolean {
  try {
    // Must be at least 4 characters and multiple of 4 (with padding)
    if (str.length < 4) return false
    
    // Check if it's a valid base64 string (allow some flexibility)
    const base64Regex = /^[A-Za-z0-9+/]+=*$/
    if (!base64Regex.test(str)) return false
    
    // Try to decode it
    const decoded = atob(str)
    
    // If it decodes to something very short, it's probably not CBOR
    if (decoded.length < 2) return false
    
    return true
  } catch {
    return false
  }
}

/**
 * Check if a string is valid hexadecimal
 */
function isHex(str: string): boolean {
  const hexRegex = /^[0-9a-fA-F]+$/
  return hexRegex.test(str) && str.length % 2 === 0
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const buffer = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i)
  }
  return buffer
}

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const buffer = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    buffer[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return buffer
}

/**
 * Try to parse content as JSON
 */
function tryParseJson(content: string): any {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * Try to parse content as CBOR (handles base64/hex encoding)
 */
function tryParseCbor(content: string): any {
  console.log('Trying to parse CBOR, content type:', typeof content, 'length:', content.length)
  console.log('First 50 chars:', content.substring(0, 50))
  console.log('First 10 char codes:', content.substring(0, 10).split('').map(c => c.charCodeAt(0)))
  
  // Try base64 decoding first (most common for API responses)
  if (isBase64(content)) {
    try {
      console.log('Attempting base64 decode...')
      const buffer = base64ToUint8Array(content)
      const result = decode(buffer)
      console.log('Successfully parsed as base64 CBOR:', result)
      return result
    } catch (error) {
      console.log('Failed to parse as base64 CBOR:', error)
    }
  }
  
  // Try hex decoding (less common but possible)
  if (isHex(content)) {
    try {
      console.log('Attempting hex decode...')
      const buffer = hexToUint8Array(content)
      const result = decode(buffer)
      console.log('Successfully parsed as hex CBOR:', result)
      return result
    } catch (error) {
      console.log('Failed to parse as hex CBOR:', error)
    }
  }
  
  // Try treating the string as raw bytes (convert string to Uint8Array)
  try {
    console.log('Attempting raw byte conversion...')
    // Convert string to Uint8Array by treating each character as a byte
    const buffer = new Uint8Array(content.length)
    for (let i = 0; i < content.length; i++) {
      buffer[i] = content.charCodeAt(i) & 0xFF
    }
    console.log('Created buffer:', buffer.slice(0, 10))
    const result = decode(buffer)
    console.log('Successfully parsed as raw byte CBOR:', result)
    return result
  } catch (error) {
    console.log('Failed to parse as raw byte CBOR:', error)
  }
  
  // Try treating as URL-safe base64 (replace - with + and _ with /)
  const urlSafeBase64 = content.replace(/-/g, '+').replace(/_/g, '/')
  if (urlSafeBase64 !== content && isBase64(urlSafeBase64)) {
    try {
      console.log('Attempting URL-safe base64 decode...')
      const buffer = base64ToUint8Array(urlSafeBase64)
      const result = decode(buffer)
      console.log('Successfully parsed as URL-safe base64 CBOR:', result)
      return result
    } catch (error) {
      console.log('Failed to parse as URL-safe base64 CBOR:', error)
    }
  }
  
  // Last attempt: try to parse as Uint8Array if it looks like comma-separated numbers
  if (/^\d+(,\s*\d+)*$/.test(content.trim())) {
    try {
      console.log('Attempting comma-separated numbers...')
      const numbers = content.split(',').map(n => parseInt(n.trim()))
      const buffer = new Uint8Array(numbers)
      const result = decode(buffer)
      console.log('Successfully parsed as number array CBOR:', result)
      return result
    } catch (error) {
      console.log('Failed to parse as number array CBOR:', error)
    }
  }
  
  return null
}

/**
 * Check if content appears to be binary data
 */
function isBinaryData(content: string): boolean {
  // Check for non-printable characters (excluding common whitespace)
  const nonPrintableRegex = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/
  return nonPrintableRegex.test(content)
}

/**
 * Detect the format of content and parse it appropriately
 * If encoding is provided by server, use that information
 */
export function detectDataFormat(
  content: string | null, 
  encoding?: 'base64-cbor' | 'base64-binary' | null
): DataDetectionResult {
  if (!content) {
    return {
      format: 'text',
      data: null,
      originalContent: '',
    }
  }

  console.log('Detecting format for content:', {
    preview: content.substring(0, 100),
    length: content.length,
    serverEncoding: encoding,
    isBase64: isBase64(content),
    isHex: isHex(content),
    isBinary: isBinaryData(content)
  })

  // If server provided encoding metadata, use it
  if (encoding === 'base64-cbor') {
    try {
      const buffer = base64ToUint8Array(content)
      const cborData = decode(buffer)
      console.log('Server indicated base64-CBOR, successfully parsed:', cborData)
      return {
        format: 'cbor',
        data: cborData,
        originalContent: content,
        isBase64Encoded: true,
      }
    } catch (error) {
      console.log('Server indicated base64-CBOR but parsing failed:', error)
      // Fall through to other detection methods
    }
  }

  if (encoding === 'base64-binary') {
    console.log('Server indicated base64-binary')
    return {
      format: 'binary',
      data: content,
      originalContent: content,
      isBase64Encoded: true,
    }
  }

  // Try JSON first (most common structured format)
  const jsonData = tryParseJson(content)
  if (jsonData !== null) {
    console.log('Detected as JSON')
    return {
      format: 'json',
      data: jsonData,
      originalContent: content,
    }
  }

  // Try CBOR parsing (could be base64 or hex encoded)
  const cborData = tryParseCbor(content)
  if (cborData !== null) {
    console.log('Detected as CBOR', cborData)
    return {
      format: 'cbor',
      data: cborData,
      originalContent: content,
      isBase64Encoded: isBase64(content),
      isHexEncoded: !isBase64(content) && isHex(content),
    }
  }

  // Check if it looks like binary data
  if (isBinaryData(content) || isBase64(content) || isHex(content)) {
    console.log('Detected as binary')
    return {
      format: 'binary',
      data: content,
      originalContent: content,
      isBase64Encoded: isBase64(content),
      isHexEncoded: !isBase64(content) && isHex(content),
    }
  }

  // Default to text
  console.log('Detected as text')
  return {
    format: 'text',
    data: content,
    originalContent: content,
  }
}

/**
 * Convert binary data to hex string for display
 */
export function toHexString(data: string, encoding?: 'base64' | 'hex'): string {
  if (encoding === 'base64') {
    const buffer = base64ToUint8Array(data)
    return Array.from(buffer)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('')
  }
  
  if (encoding === 'hex') {
    return data.toLowerCase()
  }

  // For text data, convert each character to hex
  return Array.from(data)
    .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Format hex string for display with spaces and line breaks
 */
export function formatHexDump(hexString: string, bytesPerLine: number = 16): string {
  const result: string[] = []
  
  for (let i = 0; i < hexString.length; i += bytesPerLine * 2) {
    const line = hexString.substr(i, bytesPerLine * 2)
    const formattedLine = line.match(/.{2}/g)?.join(' ') || line
    result.push(formattedLine)
  }
  
  return result.join('\n')
}