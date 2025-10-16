import { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { 
  Database, 
  HardDrive, 
  Search, 
  FileText,
  Calculator,
  ChevronDown,
  ChevronRight,
  Bookmark,
  Plus
} from 'lucide-react'
import { useSavedProjections } from '@/hooks/useSavedProjections'
import { TimestampToggle } from './TimestampToggle'

interface LayoutProps {
  children: ReactNode
}

const navigation = [
  { name: 'Home', href: '/', icon: Database },
  { name: 'Partitions', href: '/partitions', icon: HardDrive },
  { name: 'Streams', href: '/streams', icon: FileText },
  { name: 'Event Lookup', href: '/events', icon: Search },
  { name: 'Projections', href: '/projections', icon: Calculator },
]

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const [savedProjectionsExpanded, setSavedProjectionsExpanded] = useState(true)
  const { projections } = useSavedProjections()

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        <nav className="w-64 bg-card border-r border-border flex flex-col">
          <div className="p-6">
            <h1 className="text-xl font-bold text-foreground">
              SierraDB Inspector
            </h1>
          </div>
          
          <div className="px-3 space-y-1 flex-1">
            {/* Main Navigation */}
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}

            {/* Saved Projections Section */}
            <div className="pt-4">
              <button
                onClick={() => setSavedProjectionsExpanded(!savedProjectionsExpanded)}
                className={cn(
                  'flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {savedProjectionsExpanded ? (
                  <ChevronDown className="mr-2 h-4 w-4" />
                ) : (
                  <ChevronRight className="mr-2 h-4 w-4" />
                )}
                <Bookmark className="mr-2 h-4 w-4" />
                Saved Projections
                {projections.length > 0 && (
                  <span className="ml-auto text-xs bg-muted px-2 py-1 rounded-full">
                    {projections.length}
                  </span>
                )}
              </button>
              
              {savedProjectionsExpanded && (
                <div className="ml-4 mt-1 space-y-1">
                  {projections.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No saved projections
                    </div>
                  ) : (
                    projections.map((projection) => {
                      const isActive = location.pathname === `/saved-projections/${projection.id}`
                      
                      return (
                        <Link
                          key={projection.id}
                          to={`/saved-projections/${projection.id}`}
                          className={cn(
                            'flex items-center px-3 py-2 text-sm rounded-md transition-colors group',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                        >
                          <Calculator className="mr-2 h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{projection.name}</span>
                        </Link>
                      )
                    })
                  )}
                  
                  {/* Add New Projection Link */}
                  <Link
                    to="/saved-projections"
                    className={cn(
                      'flex items-center px-3 py-2 text-sm rounded-md transition-colors',
                      location.pathname === '/saved-projections'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    Manage All
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Bottom section with timestamp toggle */}
          <div className="p-3 border-t border-border">
            <TimestampToggle />
          </div>
        </nav>

        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}