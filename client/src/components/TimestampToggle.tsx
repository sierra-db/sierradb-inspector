import { Button } from '@/components/ui/button'
import { useTimestamp } from '@/contexts/TimestampContext'
import { Clock, Globe } from 'lucide-react'

export function TimestampToggle() {
  const { format, setFormat } = useTimestamp()
  
  const toggleFormat = () => {
    setFormat(format === 'local' ? 'utc' : 'local')
  }
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleFormat}
      className="flex items-center gap-2"
      title={`Switch to ${format === 'local' ? 'UTC' : 'Local'} time`}
    >
      {format === 'local' ? (
        <>
          <Clock className="h-4 w-4" />
          Local
        </>
      ) : (
        <>
          <Globe className="h-4 w-4" />
          UTC
        </>
      )}
    </Button>
  )
}