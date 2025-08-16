import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search } from '@/components/ui/search'
import { Pagination } from '@/components/ui/pagination'
import { JsonViewer } from '@/components/JsonViewer'
import { HTMLRenderConfig, RenderTemplate } from '../types.js'
import { 
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  Award,
  Clock,
  Copy,
  Check
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

// Smart detection for nested collections
function findCollectionsInObject(obj: any): { key: string; data: any[]; isCollection: boolean }[] {
  if (typeof obj !== 'object' || obj === null) return []
  
  const collections: { key: string; data: any[]; isCollection: boolean }[] = []
  
  for (const [key, value] of Object.entries(obj)) {
    // Check if value is an array of objects
    if (isArrayOfObjects(value)) {
      collections.push({ key, data: value as any[], isCollection: true })
    }
    // Check if value is an object containing objects (like activeGames: {id1: {}, id2: {}})
    else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const objectValues = Object.values(value)
      if (objectValues.length > 0 && objectValues.every(v => typeof v === 'object' && v !== null)) {
        // Convert object of objects to array
        const dataArray = Object.entries(value).map(([objKey, objValue]) => ({
          ...objValue,
          _key: objKey // Preserve the original key
        }))
        if (dataArray.length > 0) {
          collections.push({ key, data: dataArray, isCollection: true })
        }
      }
    }
  }
  
  return collections
}

// Extract the best collection from data
function extractMainCollection(data: any): { collection: any[]; meta: any; collectionName?: string } | null {
  if (isArrayOfObjects(data)) {
    return { collection: data, meta: null }
  }
  
  const collections = findCollectionsInObject(data)
  if (collections.length === 0) {
    return null
  }
  
  // Find the largest collection or prioritize common names
  const priorityNames = ['activeGames', 'games', 'items', 'records', 'entries', 'data', 'results']
  let bestCollection = collections[0]
  
  for (const collection of collections) {
    // Prioritize by name
    if (priorityNames.includes(collection.key)) {
      bestCollection = collection
      break
    }
    // Or by size
    if (collection.data.length > bestCollection.data.length) {
      bestCollection = collection
    }
  }
  
  // Create metadata object with non-collection data
  const meta: any = {}
  for (const [key, value] of Object.entries(data)) {
    if (key !== bestCollection.key) {
      meta[key] = value
    }
  }
  
  return {
    collection: bestCollection.data,
    meta: Object.keys(meta).length > 0 ? meta : null,
    collectionName: bestCollection.key
  }
}

// Auto-detect the best template for the data
function detectTemplate(data: any): RenderTemplate {
  if (hasListableStructure(data)) return 'list'
  if (isObjectWithNumericValues(data)) return 'stats'
  if (isArrayOfObjects(data)) return 'table'
  
  // Check for nested collections
  const mainCollection = extractMainCollection(data)
  if (mainCollection) {
    return hasListableStructure(mainCollection.collection) ? 'collection' : 'table'
  }
  
  return 'auto'
}

// Enhanced search function for filtering data
function searchInData(data: any[], searchTerm: string): any[] {
  if (!searchTerm.trim()) return data
  
  const term = searchTerm.toLowerCase()
  return data.filter(item => {
    return Object.entries(item).some(([key, value]) => {
      // Skip internal fields
      if (key.startsWith('_')) return false
      
      if (typeof value === 'string') {
        return value.toLowerCase().includes(term)
      }
      if (typeof value === 'number') {
        return value.toString().includes(term)
      }
      if (typeof value === 'boolean') {
        return value.toString().includes(term)
      }
      // Search in nested objects (shallow)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return Object.values(value).some(nestedValue => 
          typeof nestedValue === 'string' && nestedValue.toLowerCase().includes(term)
        )
      }
      return false
    })
  })
}

// Enhanced field formatting with truncation info
function formatFieldValue(key: string, value: any): { display: string; full: string; truncated: boolean } {
  if (value === null || value === undefined) return { display: '', full: '', truncated: false }
  
  const lowerKey = key.toLowerCase()
  let displayValue: string
  let fullValue: string
  
  // Format timestamps
  if ((lowerKey.includes('time') || lowerKey.includes('date') || lowerKey.includes('updated') || lowerKey.includes('created')) && 
      (typeof value === 'string' || typeof value === 'number')) {
    try {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        displayValue = date.toLocaleString()
        fullValue = displayValue
        return { display: displayValue, full: fullValue, truncated: false }
      }
    } catch {}
  }
  
  // Format numbers
  if (typeof value === 'number') {
    if (lowerKey.includes('count') || lowerKey.includes('total') || lowerKey.includes('amount')) {
      displayValue = value.toLocaleString()
      fullValue = displayValue
      return { display: displayValue, full: fullValue, truncated: false }
    }
    if (lowerKey.includes('price') || lowerKey.includes('cost') || lowerKey.includes('value')) {
      displayValue = value.toFixed(2)
      fullValue = displayValue
      return { display: displayValue, full: fullValue, truncated: false }
    }
  }
  
  // Handle string values with potential truncation
  fullValue = String(value)
  const maxLength = lowerKey.includes('url') || lowerKey.includes('link') ? 30 : 50
  
  if (fullValue.length > maxLength) {
    displayValue = fullValue.substring(0, maxLength - 3) + '...'
    return { display: displayValue, full: fullValue, truncated: true }
  }
  
  displayValue = fullValue
  return { display: displayValue, full: fullValue, truncated: false }
}

// Copy to clipboard component
function CopyableValue({ value, display, truncated }: { value: string; display: string; truncated: boolean }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }
  
  if (!truncated && value.length < 20) {
    return <span>{display}</span>
  }
  
  return (
    <span 
      className="cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 flex items-center gap-1 group"
      onClick={handleCopy}
      title={truncated ? `Click to copy full value: ${value}` : 'Click to copy'}
    >
      <span>{display}</span>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
      )}
    </span>
  )
}

// Enhanced field name formatting
function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1') // camelCase to space
    .replace(/_/g, ' ') // snake_case to space
    .replace(/^./, str => str.toUpperCase()) // capitalize first letter
    .trim()
}

// Paginate data array
function paginateData(data: any[], page: number, pageSize: number): any[] {
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  return data.slice(startIndex, endIndex)
}

// Template components
function ListTemplate({ data, title, description }: { data: any[], title?: string, description?: string }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  const filteredData = useMemo(() => searchInData(data, searchTerm), [data, searchTerm])
  const paginatedData = useMemo(() => paginateData(filteredData, currentPage, itemsPerPage), [filteredData, currentPage, itemsPerPage])
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  
  // Reset page when search changes
  useMemo(() => setCurrentPage(1), [searchTerm, itemsPerPage])
  return (
    <div className="space-y-4">
      {(title || description) && (
        <div>
          {title && <h2 className="text-2xl font-bold">{title}</h2>}
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <Search 
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={`Search ${data.length} items...`}
          className="max-w-sm"
        />
        <div className="text-sm text-muted-foreground">
          {filteredData.length} of {data.length} items
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedData.map((item, index) => {
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
                    
                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                      return (
                        <div key={key} className="flex justify-between gap-2">
                          <span className="text-muted-foreground text-xs">
                            {formatFieldName(key)}:
                          </span>
                          <span className="font-mono text-xs text-right flex-shrink-0 max-w-[60%]">
                            {(() => {
                              const formatted = formatFieldValue(key, value)
                              return (
                                <CopyableValue 
                                  value={formatted.full}
                                  display={formatted.display}
                                  truncated={formatted.truncated}
                                />
                              )
                            })()}
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
      
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          className="mt-6"
        />
      )}
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
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  if (data.length === 0) return null
  
  const filteredData = useMemo(() => searchInData(data, searchTerm), [data, searchTerm])
  const paginatedData = useMemo(() => paginateData(filteredData, currentPage, itemsPerPage), [filteredData, currentPage, itemsPerPage])
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  
  // Reset page when search changes
  useMemo(() => setCurrentPage(1), [searchTerm, itemsPerPage])
  
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
      
      <div className="flex items-center justify-between">
        <Search 
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={`Search ${data.length} records...`}
          className="max-w-sm"
        />
        <div className="text-sm text-muted-foreground">
          {filteredData.length} of {data.length} records
        </div>
      </div>
      
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  {displayColumns.map((column) => (
                    <th key={column} className="p-4 text-left font-medium text-xs">
                      {formatFieldName(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((row, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    {displayColumns.map((column) => (
                      <td key={column} className="p-4 text-sm">
                        {typeof row[column] === 'object' && row[column] !== null ? (
                          <Badge variant="secondary" className="text-xs">
                            {Array.isArray(row[column]) ? `Array (${row[column].length})` : 'Object'}
                          </Badge>
                        ) : (
                          <span className="block max-w-48">
                            {(() => {
                              const formatted = formatFieldValue(column, row[column])
                              return (
                                <CopyableValue 
                                  value={formatted.full}
                                  display={formatted.display}
                                  truncated={formatted.truncated}
                                />
                              )
                            })()}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          className="mt-6"
        />
      )}
    </div>
  )
}

// New CollectionTemplate for nested data structures
function CollectionTemplate({ 
  data, 
  title, 
  description, 
  collectionName, 
  meta 
}: { 
  data: any[], 
  title?: string, 
  description?: string,
  collectionName?: string,
  meta?: any 
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  const filteredData = useMemo(() => searchInData(data, searchTerm), [data, searchTerm])
  const paginatedData = useMemo(() => paginateData(filteredData, currentPage, itemsPerPage), [filteredData, currentPage, itemsPerPage])
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  
  // Reset page when search changes
  useMemo(() => setCurrentPage(1), [searchTerm, itemsPerPage])
  
  return (
    <div className="space-y-6">
      {(title || description) && (
        <div>
          {title && <h2 className="text-2xl font-bold">{title}</h2>}
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}
      
      {/* Show metadata/stats if available */}
      {meta && isObjectWithNumericValues(meta) && (
        <StatsTemplate data={meta} title="Summary" />
      )}
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold capitalize">
              {collectionName?.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ') || 'Items'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {data.length} items total
            </p>
          </div>
          <Search 
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={`Search ${data.length} items...`}
            className="max-w-sm"
          />
        </div>
        
        <div className="text-sm text-muted-foreground mb-4">
          {filteredData.length} of {data.length} items
        </div>
        
        {/* Use appropriate sub-template based on data structure */}
        {hasListableStructure(filteredData) ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedData.map((item, index) => {
              const displayTitle = item.name || item.title || item.id || item._key || `Item ${index + 1}`
              const subtitle = item.subtitle || item.description || item.type || item.sport
              const status = item.status || item.state
              const timestamp = item.timestamp || item.createdAt || item.updatedAt || item.lastUpdated
              
              return (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{displayTitle}</span>
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
                        if (['name', 'title', 'id', '_key', 'subtitle', 'description', 'status', 'state', 'sport', 'type'].includes(key)) {
                          return null // Skip already displayed fields
                        }
                        
                        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                          return (
                            <div key={key} className="flex justify-between gap-2">
                              <span className="text-muted-foreground text-xs">
                                {formatFieldName(key)}:
                              </span>
                              <span className="font-mono text-xs text-right flex-shrink-0 max-w-[60%]">
                                {(() => {
                                  const formatted = formatFieldValue(key, value)
                                  return (
                                    <CopyableValue 
                                      value={formatted.full}
                                      display={formatted.display}
                                      truncated={formatted.truncated}
                                    />
                                  )
                                })()}
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
        ) : (
          <TableTemplate data={paginatedData} />
        )}
        
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredData.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            className="mt-6"
          />
        )}
      </div>
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
      
    case 'collection': {
      const collectionData = extractMainCollection(data)
      return collectionData ? (
        <CollectionTemplate 
          data={collectionData.collection}
          title={displayTitle}
          description={displayDescription}
          collectionName={collectionData.collectionName}
          meta={collectionData.meta}
        />
      ) : (
        <AutoTemplate data={data} title={displayTitle} description={displayDescription} />
      )
    }

    case 'auto':
    default:
      return <AutoTemplate data={data} title={displayTitle} description={displayDescription} />
  }
}