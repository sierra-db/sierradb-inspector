import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { 
  Database, 
  HardDrive, 
  Search, 
  FileText,
  Calculator
} from 'lucide-react'

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

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        <nav className="w-64 bg-card border-r border-border">
          <div className="p-6">
            <h1 className="text-xl font-bold text-foreground">
              SierraDB Inspector
            </h1>
          </div>
          
          <div className="px-3">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md mb-1 transition-colors',
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