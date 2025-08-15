import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { JsonViewer } from '@/components/JsonViewer'
import { HTMLRenderConfig, RenderTemplate } from '../types.js'
import { 
  Calendar,
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  Award,
  Clock
} from 'lucide-react'

interface HTMLRendererProps {
  data: any
  config?: HTMLRenderConfig
  title?: string
  description?: string
}

// Type guards for data structure detection
function isArrayOfObjects(data: any): boolean {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null
}

function isObjectWithNumericValues(data: any): boolean {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false
  
  const values = Object.values(data)
  return values.some(v => typeof v === 'number') && values.length < 20 // Reasonable limit
}

function hasListableStructure(data: any): boolean {
  if (!isArrayOfObjects(data)) return false
  
  const firstItem = data[0]
  return 'title' in firstItem || 'name' in firstItem || 'id' in firstItem
}

// Auto-detect the best template for the data
function detectTemplate(data: any): RenderTemplate {
  if (hasListableStructure(data)) return 'list'
  if (isObjectWithNumericValues(data)) return 'stats'
  if (isArrayOfObjects(data)) return 'table'
  return 'auto'
}

// Template components
function ListTemplate({ data, title, description }: { data: any[], title?: string, description?: string }) {
  return (
    <div className="space-y-4">
      {(title || description) && (
        <div>
          {title && <h2 className="text-2xl font-bold">{title}</h2>}
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((item, index) => {
          const title = item.title || item.name || item.id || `Item ${index + 1}`
          const subtitle = item.subtitle || item.description || item.type
          const status = item.status || item.state
          const timestamp = item.timestamp || item.createdAt || item.updatedAt
          
          return (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{title}</span>
                  {status && (
                    <Badge variant={status === 'active' || status === 'completed' ? 'default' : 'secondary'}>
                      {status}
                    </Badge>
                  )}
                </CardTitle>
                {subtitle && <CardDescription>{subtitle}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {Object.entries(item).map(([key, value]) => {
                    if (['title', 'name', 'id', 'subtitle', 'description', 'status', 'state'].includes(key)) {
                      return null // Skip already displayed fields
                    }
                    
                    if (typeof value === 'string' || typeof value === 'number') {
                      return (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:
                          </span>
                          <span className="font-mono text-xs">
                            {key.toLowerCase().includes('time') ? new Date(value as any).toLocaleString() : String(value)}
                          </span>
                        </div>
                      )
                    }
                    return null
                  })}
                  
                  {timestamp && (
                    <div className="flex items-center gap-1 pt-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function StatsTemplate({ data, title, description }: { data: Record<string, any>, title?: string, description?: string }) {
  const stats = Object.entries(data).filter(([_, value]) => typeof value === 'number')
  const nonStats = Object.entries(data).filter(([_, value]) => typeof value !== 'number')
  
  const getIcon = (key: string) => {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes('revenue') || lowerKey.includes('money') || lowerKey.includes('amount')) {
      return DollarSign
    }
    if (lowerKey.includes('user') || lowerKey.includes('player')) {
      return Users
    }
    if (lowerKey.includes('count') || lowerKey.includes('total')) {
      return Activity
    }
    if (lowerKey.includes('score') || lowerKey.includes('rating')) {
      return Award
    }
    return TrendingUp
  }
  
  return (
    <div className="space-y-6">
      {(title || description) && (
        <div>
          {title && <h2 className="text-2xl font-bold">{title}</h2>}
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}
      
      {/* Stats Grid */}
      {stats.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map(([key, value]) => {
            const Icon = getIcon(key)
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')
            
            return (
              <Card key={key}>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="ml-2">
                      <p className="text-sm font-medium capitalize text-muted-foreground">
                        {displayKey}
                      </p>
                      <p className="text-2xl font-bold">
                        {typeof value === 'number' ? value.toLocaleString() : String(value)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      
      {/* Non-numeric data */}
      {nonStats.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Additional Data</h3>
          {nonStats.map(([key, value]) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base capitalize">
                  {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {typeof value === 'object' ? (
                  <JsonViewer content={JSON.stringify(value, null, 2)} title={key} />
                ) : (
                  <p className="text-sm">{String(value)}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function TableTemplate({ data, title, description }: { data: any[], title?: string, description?: string }) {
  if (data.length === 0) return null
  
  const columns = Object.keys(data[0])
  const maxColumns = 6 // Reasonable limit for table display
  const displayColumns = columns.slice(0, maxColumns)
  
  return (
    <div className="space-y-4">
      {(title || description) && (
        <div>
          {title && <h2 className="text-2xl font-bold">{title}</h2>}
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}
      
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {displayColumns.map((column) => (
                    <th key={column} className="p-4 text-left font-medium capitalize">
                      {column.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 100).map((row, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    {displayColumns.map((column) => (
                      <td key={column} className="p-4 text-sm">
                        {typeof row[column] === 'object' ? (
                          <Badge variant="secondary">Object</Badge>
                        ) : (
                          String(row[column] ?? '')
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 100 && (
            <div className="p-4 text-sm text-muted-foreground border-t">
              Showing first 100 of {data.length} items
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AutoTemplate({ data, title, description }: { data: any, title?: string, description?: string }) {
  return (
    <div className="space-y-4">
      {(title || description) && (
        <div>
          {title && <h2 className="text-2xl font-bold">{title}</h2>}
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Data Output</CardTitle>
          <CardDescription>
            Raw projection result (no suitable template detected)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JsonViewer content={JSON.stringify(data, null, 2)} title="projection-result" />
        </CardContent>
      </Card>
    </div>
  )
}

export function HTMLRenderer({ data, config, title, description }: HTMLRendererProps) {
  const template = useMemo(() => {
    if (config?.template === 'custom') {
      return 'custom'
    }
    return config?.template === 'auto' || !config?.template 
      ? detectTemplate(data) 
      : config.template
  }, [data, config])

  const displayTitle = config?.title || title
  const displayDescription = config?.description || description

  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No data to display</p>
        </CardContent>
      </Card>
    )
  }

  if (config?.template === 'custom' && config.customTemplate) {
    // In a more complete implementation, you'd parse the custom template
    // For now, we'll fall back to auto-detection
    return <AutoTemplate data={data} title={displayTitle} description={displayDescription} />
  }

  switch (template) {
    case 'list':
      return isArrayOfObjects(data) && hasListableStructure(data) ? (
        <ListTemplate data={data} title={displayTitle} description={displayDescription} />
      ) : (
        <AutoTemplate data={data} title={displayTitle} description={displayDescription} />
      )

    case 'stats':
      return isObjectWithNumericValues(data) ? (
        <StatsTemplate data={data} title={displayTitle} description={displayDescription} />
      ) : (
        <AutoTemplate data={data} title={displayTitle} description={displayDescription} />
      )

    case 'table':
      return isArrayOfObjects(data) ? (
        <TableTemplate data={data} title={displayTitle} description={displayDescription} />
      ) : (
        <AutoTemplate data={data} title={displayTitle} description={displayDescription} />
      )

    case 'auto':
    default:
      return <AutoTemplate data={data} title={displayTitle} description={displayDescription} />
  }
}