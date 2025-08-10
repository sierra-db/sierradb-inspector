import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { PartitionExplorer } from './pages/PartitionExplorer'
import { StreamExplorer } from './pages/StreamExplorer'
import { EventLookup } from './pages/EventLookup'
import { ProjectionRunner } from './pages/ProjectionRunner'

function App() {
  return (
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
      </Routes>
    </Layout>
  )
}

export default App