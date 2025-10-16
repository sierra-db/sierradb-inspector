import { createContext, useContext, useState, ReactNode } from 'react'

type TimestampFormat = 'local' | 'utc'

interface TimestampContextType {
  format: TimestampFormat
  setFormat: (format: TimestampFormat) => void
  formatTimestamp: (timestamp: number) => string
}

const TimestampContext = createContext<TimestampContextType | undefined>(undefined)

export function TimestampProvider({ children }: { children: ReactNode }) {
  const [format, setFormat] = useState<TimestampFormat>('local')
  
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    
    if (format === 'utc') {
      return date.toISOString().replace('T', ' ').replace('Z', ' UTC')
    } else {
      return date.toLocaleString()
    }
  }
  
  return (
    <TimestampContext.Provider value={{ format, setFormat, formatTimestamp }}>
      {children}
    </TimestampContext.Provider>
  )
}

export function useTimestamp() {
  const context = useContext(TimestampContext)
  if (context === undefined) {
    throw new Error('useTimestamp must be used within a TimestampProvider')
  }
  return context
}