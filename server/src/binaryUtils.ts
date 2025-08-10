/**
 * Utility functions for handling binary data in server responses
 */

export interface ProcessedField {
  content: string | null
  encoding?: 'base64-cbor' | 'base64-binary' | null
}

/**
 * Check if content appears to be binary data
 */
function isBinaryData(content: string): boolean {
  if (!content) return false
  
  // Check for non-printable characters (excluding common whitespace)
  const nonPrintableRegex = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/
  return nonPrintableRegex.test(content)
}

/**
 * Check if binary data might be CBOR by looking for CBOR magic numbers
 */
function mightBeCbor(buffer: Buffer): boolean {
  if (buffer.length < 3) return false
  
  // CBOR major types start with specific bit patterns
  const firstByte = buffer[0]
  
  // Check for common CBOR major types (0-7)
  const majorType = (firstByte >> 5) & 0x07
  
  // CBOR data typically starts with major types 0-6
  // Major type 7 is for special values but also valid
  return majorType >= 0 && majorType <= 7
}

/**
 * Try to detect if content is CBOR data
 */
function detectCborContent(content: string): boolean {
  try {
    // Convert string to buffer to analyze byte patterns
    const buffer = Buffer.from(content, 'binary')
    
    // Check if it looks like CBOR
    return mightBeCbor(buffer)
  } catch {
    return false
  }
}

/**
 * Process a field that might contain binary/CBOR data
 */
export function processField(content: string | null): ProcessedField {
  if (!content) {
    return { content: null, encoding: null }
  }
  
  // Check if it's binary data
  if (isBinaryData(content)) {
    const buffer = Buffer.from(content, 'binary')
    
    // Check if it might be CBOR
    if (detectCborContent(content)) {
      return {
        content: buffer.toString('base64'),
        encoding: 'base64-cbor'
      }
    } else {
      // Generic binary data
      return {
        content: buffer.toString('base64'),
        encoding: 'base64-binary'
      }
    }
  }
  
  // Not binary data, return as-is
  return { content, encoding: null }
}

/**
 * Process event data fields (metadata and payload)
 */
export function processEventFields(metadata: string | null, payload: string | null) {
  const processedMetadata = processField(metadata)
  const processedPayload = processField(payload)
  
  return {
    metadata: processedMetadata.content,
    metadata_encoding: processedMetadata.encoding,
    payload: processedPayload.content,
    payload_encoding: processedPayload.encoding,
  }
}