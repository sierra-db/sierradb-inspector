import { useState, useEffect, useCallback } from 'react'
import { SavedProjection, SavedProjectionResult, ProjectionProgress } from '../types.js'
import { SavedProjectionsStorage } from '../utils/savedProjections.js'
import { api } from '../lib/api.js'

export function useSavedProjections() {
  const [projections, setProjections] = useState<SavedProjection[]>([])
  const [loading, setLoading] = useState(true)

  // Load projections from localStorage
  const loadProjections = useCallback(() => {
    setLoading(true)
    try {
      const saved = SavedProjectionsStorage.getAll()
      setProjections(saved)
    } catch (error) {
      console.error('Failed to load projections:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    loadProjections()
  }, [loadProjections])

  // Save a new projection
  const saveProjection = useCallback((projection: Omit<SavedProjection, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const saved = SavedProjectionsStorage.save(projection)
      loadProjections() // Refresh the list
      return saved
    } catch (error) {
      console.error('Failed to save projection:', error)
      throw error
    }
  }, [loadProjections])

  // Update an existing projection
  const updateProjection = useCallback((id: string, updates: Partial<SavedProjection>) => {
    try {
      const updated = SavedProjectionsStorage.update(id, updates)
      loadProjections() // Refresh the list
      return updated
    } catch (error) {
      console.error('Failed to update projection:', error)
      throw error
    }
  }, [loadProjections])

  // Delete a projection
  const deleteProjection = useCallback((id: string) => {
    try {
      const success = SavedProjectionsStorage.delete(id)
      if (success) {
        loadProjections() // Refresh the list
      }
      return success
    } catch (error) {
      console.error('Failed to delete projection:', error)
      throw error
    }
  }, [loadProjections])

  // Duplicate a projection
  const duplicateProjection = useCallback((id: string, newName?: string) => {
    try {
      const duplicated = SavedProjectionsStorage.duplicate(id, newName)
      if (duplicated) {
        loadProjections() // Refresh the list
      }
      return duplicated
    } catch (error) {
      console.error('Failed to duplicate projection:', error)
      throw error
    }
  }, [loadProjections])

  // Get a specific projection
  const getProjection = useCallback((id: string) => {
    return SavedProjectionsStorage.getById(id)
  }, [])

  return {
    projections,
    loading,
    saveProjection,
    updateProjection,
    deleteProjection,
    duplicateProjection,
    getProjection,
    refreshProjections: loadProjections
  }
}

export function useProjectionResults() {
  // Get result for a specific projection
  const getResult = useCallback((projectionId: string) => {
    return SavedProjectionsStorage.getResult(projectionId)
  }, [])

  // Save result for a projection
  const saveResult = useCallback((result: SavedProjectionResult) => {
    SavedProjectionsStorage.saveResult(result)
  }, [])

  // Delete result for a projection
  const deleteResult = useCallback((projectionId: string) => {
    SavedProjectionsStorage.deleteResult(projectionId)
  }, [])

  return {
    getResult,
    saveResult,
    deleteResult
  }
}

export function useProjectionRunner(projectionId: string) {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<ProjectionProgress | null>(null)
  const [result, setResult] = useState<any>(null)
  const { getProjection } = useSavedProjections()
  const { saveResult } = useProjectionResults()

  const runProjection = useCallback(async () => {
    const projection = getProjection(projectionId)
    if (!projection || isRunning) return

    try {
      setIsRunning(true)
      setProgress(null)
      setResult(null)

      const requestBody = {
        code: projection.code,
        initialState: null,
        ...(projection.streamId && { streamId: projection.streamId })
      }

      const response = await fetch('/api/projections/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Handle SSE manually
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6))
                if (data.current_partition !== undefined) {
                  setProgress(data)
                  
                  if (data.status === 'completed') {
                    setResult(data.current_state)
                    // Save result to localStorage
                    saveResult({
                      projectionId,
                      result: data.current_state,
                      status: 'completed',
                      lastRun: new Date().toISOString(),
                      eventsProcessed: data.events_processed
                    })
                    setIsRunning(false)
                  } else if (data.status === 'error') {
                    saveResult({
                      projectionId,
                      result: null,
                      status: 'error',
                      error: data.error,
                      lastRun: new Date().toISOString(),
                    })
                    setIsRunning(false)
                  }
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

    } catch (error) {
      console.error('Error running projection:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setProgress({
        current_partition: 0,
        total_partitions: 0,
        events_processed: 0,
        current_state: null,
        status: 'error',
        error: errorMessage
      })
      
      saveResult({
        projectionId,
        result: null,
        status: 'error',
        error: errorMessage,
        lastRun: new Date().toISOString(),
      })
      
      setIsRunning(false)
    }
  }, [projectionId, getProjection, isRunning, saveResult])

  const stopProjection = useCallback(() => {
    setIsRunning(false)
    // Note: In a real implementation, you might want to cancel the fetch request
  }, [])

  return {
    isRunning,
    progress,
    result,
    runProjection,
    stopProjection
  }
}