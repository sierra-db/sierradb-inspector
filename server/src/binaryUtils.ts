/**
 * Utility functions for handling binary data in server responses
 */

import { decode } from 'cbor-x'

export interface ProcessedField {
  content: string | null
  encoding?: 'base64-cbor' | 'base64-binary' | 'json' | null
  parsed_data?: any // Parsed CBOR/JSON data when available
}

/**
 * Convert input to Buffer, handling both string and Buffer inputs
 */
function toBuffer(input: string | Buffer): Buffer {
  if (Buffer.isBuffer(input)) {
    return input
  }
  // If it's a string, assume it's binary data encoded as latin1/binary
  return Buffer.from(input, 'binary')
}

/**
 * Check if content appears to be binary data
 */
function isBinaryData(content: string | Buffer): boolean {
  if (!content) return false
  
  // If it's already a Buffer, it's definitely binary
  if (Buffer.isBuffer(content)) {
    return true
  }
  
  // Check for non-printable characters (excluding common whitespace)
  // Also check for Unicode replacement character (0xFFFD = 65533) which indicates binary data
  for (let i = 0; i < content.length; i++) {
    const charCode = content.charCodeAt(i)
    // Check for control characters, high-bit characters, or replacement character
    if ((charCode >= 0 && charCode <= 8) || 
        (charCode >= 14 && charCode <= 31) || 
        (charCode >= 127 && charCode <= 255) ||
        charCode === 65533) {
      return true
    }
  }
  return false
}

/**
 * Check if a Buffer looks like a UUID (16 bytes)
 */
function isUUIDBuffer(buffer: Buffer): boolean {
  return Buffer.isBuffer(buffer) && buffer.length === 16
}

/**
 * Convert a UUID Buffer to string format
 */
function uuidBufferToString(buffer: Buffer): string {
  const hex = buffer.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-')
}

/**
 * Recursively convert UUID Buffers to strings in parsed data
 */
function convertUUIDs(data: any): any {
  if (isUUIDBuffer(data)) {
    return uuidBufferToString(data)
  }
  
  if (Array.isArray(data)) {
    return data.map(convertUUIDs)
  }
  
  if (data && typeof data === 'object' && data.constructor === Object) {
    const converted: any = {}
    for (const [key, value] of Object.entries(data)) {
      converted[key] = convertUUIDs(value)
    }
    return converted
  }
  
  return data
}

/**
 * Try to detect if content is CBOR data by actually parsing it
 */
function detectCborContent(content: string | Buffer): boolean {
  if (!content) return false
  
  try {
    // Convert to buffer properly
    const buffer = toBuffer(content)
    
    // Try to actually decode as CBOR - this is the definitive test
    const result = decode(buffer)
    return true
  } catch {
    // If parsing fails, it's not valid CBOR
    return false
  }
}

/**
 * Process a field that might contain binary/CBOR data
 */
export function processField(content: Buffer | null): ProcessedField {
  if (!content) {
    return { content: null, encoding: null }
  }
    
  try {
    const parsed = decode(content);
    const convertedData = convertUUIDs(parsed);
    return {
      content: JSON.stringify(convertedData),
      encoding: 'json',
      parsed_data: convertedData
    }
  } catch (_err) {
    // Not CBOR, continue
  }

  try {
    const contentStr = content.toString()
    const parsed = JSON.parse(contentStr)
    return {
      content: contentStr,
      encoding: 'json',
      parsed_data: parsed
    }
  } catch {
    // Not JSON, continue
  }
    
  // Plain text
  const stringContent = Buffer.isBuffer(content) ? content.toString('utf8') : content as string
  return { content: stringContent, encoding: null }
}

/**
 * Process event data fields (metadata and payload)
 */
export function processEventFields(metadata: Buffer | null, payload: Buffer | null) {
  const processedMetadata = processField(metadata)
  const processedPayload = processField(payload)
  
  return {
    metadata: processedMetadata.content,
    metadata_encoding: processedMetadata.encoding,
    metadata_parsed: processedMetadata.parsed_data,
    payload: processedPayload.content,
    payload_encoding: processedPayload.encoding,
    payload_parsed: processedPayload.parsed_data,
  }
}
