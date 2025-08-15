import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSavedProjections, useProjectionResults } from '@/hooks/useSavedProjections'
import { SavedProjectionsStorage } from '@/utils/savedProjections'
import { 
  Bookmark,
  Search,
  Plus,
  Play,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Calendar,
  Code,
  Eye,
  MoreVertical
} from 'lucide-react'

export function SavedProjectionsPage() {
  const { projections, loading, deleteProjection, duplicateProjection, refreshProjections } = useSavedProjections()
  const { getResult } = useProjectionResults()
  const [searchTerm, setSearchTerm] = useState('')
  const [showImportExport, setShowImportExport] = useState(false)
  const [importText, setImportText] = useState('')

  const filteredProjections = projections.filter(projection =>
    projection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    projection.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    projection.category?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteProjection(id)
    }
  }

  const handleDuplicate = (id: string, name: string) => {
    duplicateProjection(id, `${name} (Copy)`)
  }

  const handleExport = () => {
    const exportData = SavedProjectionsStorage.export()
    const blob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sierradb-projections-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    try {
      SavedProjectionsStorage.import(importText)
      refreshProjections()
      setImportText('')
      setShowImportExport(false)
      alert('Projections imported successfully!')
    } catch (error) {
      alert('Failed to import projections. Please check the format.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getStatusBadge = (projectionId: string) => {
    const result = getResult(projectionId)
    if (!result) return <Badge variant="outline">Never run</Badge>
    
    switch (result.status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      case 'running':
        return <Badge variant="secondary">Running</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading saved projections...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bookmark className="h-8 w-8" />
            Saved Projections
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your saved projection templates and view results
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowImportExport(!showImportExport)}
          >
            <MoreVertical className="h-4 w-4 mr-2" />
            Import/Export
          </Button>
          
          <Button asChild>
            <Link to="/projections">
              <Plus className="h-4 w-4 mr-2" />
              New Projection
            </Link>
          </Button>
        </div>
      </div>

      {/* Import/Export Section */}
      {showImportExport && (
        <Card>
          <CardHeader>
            <CardTitle>Import/Export Projections</CardTitle>
            <CardDescription>
              Backup or share your saved projections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Import from JSON:</label>
              <Input
                placeholder="Paste exported JSON here..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <Button 
                onClick={handleImport} 
                disabled={!importText.trim()}
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search projections by name, description, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Bookmark className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Total Projections</p>
                <p className="text-2xl font-bold">{projections.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Play className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">Recently Run</p>
                <p className="text-2xl font-bold">
                  {projections.filter(p => getResult(p.id)?.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <div className="ml-2">
                <p className="text-sm font-medium text-muted-foreground">HTML Rendered</p>
                <p className="text-2xl font-bold">
                  {projections.filter(p => p.renderMode === 'html').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projections List */}
      {filteredProjections.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {projections.length === 0 ? 'No saved projections yet' : 'No matching projections found'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {projections.length === 0 
                ? 'Create your first projection to get started with custom data analysis'
                : 'Try adjusting your search terms'
              }
            </p>
            {projections.length === 0 && (
              <Button asChild>
                <Link to="/projections">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Projection
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjections.map((projection) => {
            const result = getResult(projection.id)
            
            return (
              <Card key={projection.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg truncate">{projection.name}</CardTitle>
                    {getStatusBadge(projection.id)}
                  </div>
                  {projection.description && (
                    <CardDescription className="line-clamp-2">
                      {projection.description}
                    </CardDescription>
                  )}
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Created {formatDate(projection.createdAt)}</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Code className="h-3 w-3" />
                      <span>
                        {projection.renderMode === 'html' ? 'HTML Display' : 'JSON Display'}
                      </span>
                    </div>
                    
                    {projection.streamId && (
                      <div className="text-xs">
                        <Badge variant="outline" className="text-xs">
                          Stream: {projection.streamId}
                        </Badge>
                      </div>
                    )}
                    
                    {projection.category && (
                      <div className="text-xs">
                        <Badge variant="secondary" className="text-xs">
                          {projection.category}
                        </Badge>
                      </div>
                    )}
                    
                    {result && result.lastRun && (
                      <div className="text-xs pt-1 border-t">
                        Last run: {formatDate(result.lastRun)}
                        {result.eventsProcessed && (
                          <span className="ml-2">({result.eventsProcessed.toLocaleString()} events)</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" asChild className="flex-1">
                      <Link to={`/saved-projections/${projection.id}`}>
                        <Play className="h-3 w-3 mr-1" />
                        Run
                      </Link>
                    </Button>
                    
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/projections?edit=${projection.id}`}>
                        <Edit className="h-3 w-3" />
                      </Link>
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDuplicate(projection.id, projection.name)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => handleDelete(projection.id, projection.name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}