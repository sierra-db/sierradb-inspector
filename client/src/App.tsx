import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { TimestampProvider } from './contexts/TimestampContext'
import { Home } from './pages/Home'
import { PartitionExplorer } from './pages/PartitionExplorer'
import { StreamExplorer } from './pages/StreamExplorer'
import { EventLookup } from './pages/EventLookup'
import { ProjectionRunner } from './pages/ProjectionRunner'
import { SavedProjectionsPage } from './pages/SavedProjectionsPage'
import { ProjectionViewPage } from './pages/ProjectionViewPage'

function App() {
  return (
    <TimestampProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/partitions" element={<PartitionExplorer />} />
          <Route path="/partitions/:partition" element={<PartitionExplorer />} />
          <Route path="/streams" element={<StreamExplorer />} />
          <Route path="/streams/:streamId" element={<StreamExplorer />} />
          <Route path="/events" element={<EventLookup />} />
          <Route path="/events/:eventId" element={<EventLookup />} />
          <Route path="/projections" element={<ProjectionRunner />} />
          <Route path="/saved-projections" element={<SavedProjectionsPage />} />
          <Route path="/saved-projections/:id" element={<ProjectionViewPage />} />
        </Routes>
      </Layout>
    </TimestampProvider>
  )
}

export default App