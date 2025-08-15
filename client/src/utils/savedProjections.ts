import { SavedProjection, SavedProjectionResult } from '../types.js'

const STORAGE_KEYS = {
  PROJECTIONS: 'sierradb-saved-projections',
  RESULTS: 'sierradb-projection-results'
} as const

// Utility functions for localStorage operations
export class SavedProjectionsStorage {
  // Get all saved projections
  static getAll(): SavedProjection[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROJECTIONS)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to load saved projections:', error)
      return []
    }
  }

  // Get a specific projection by ID
  static getById(id: string): SavedProjection | null {
    const projections = this.getAll()
    return projections.find(p => p.id === id) || null
  }

  // Save a new projection or update existing one
  static save(projection: Omit<SavedProjection, 'id' | 'createdAt' | 'updatedAt'>): SavedProjection {
    const projections = this.getAll()
    const now = new Date().toISOString()
    
    // Check if updating existing projection
    const existingIndex = projections.findIndex(p => p.name === projection.name)
    
    const savedProjection: SavedProjection = {
      ...projection,
      id: existingIndex >= 0 ? projections[existingIndex].id : crypto.randomUUID(),
      createdAt: existingIndex >= 0 ? projections[existingIndex].createdAt : now,
      updatedAt: now
    }

    if (existingIndex >= 0) {
      projections[existingIndex] = savedProjection
    } else {
      projections.push(savedProjection)
    }

    this.saveAll(projections)
    return savedProjection
  }

  // Update an existing projection
  static update(id: string, updates: Partial<SavedProjection>): SavedProjection | null {
    const projections = this.getAll()
    const index = projections.findIndex(p => p.id === id)
    
    if (index === -1) return null

    projections[index] = {
      ...projections[index],
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    }

    this.saveAll(projections)
    return projections[index]
  }

  // Delete a projection
  static delete(id: string): boolean {
    const projections = this.getAll()
    const filteredProjections = projections.filter(p => p.id !== id)
    
    if (filteredProjections.length === projections.length) {
      return false // No projection was deleted
    }

    this.saveAll(filteredProjections)
    this.deleteResult(id) // Also clean up any stored results
    return true
  }

  // Duplicate a projection
  static duplicate(id: string, newName?: string): SavedProjection | null {
    const original = this.getById(id)
    if (!original) return null

    const duplicated = this.save({
      ...original,
      name: newName || `${original.name} (Copy)`,
    })

    return duplicated
  }

  // Private method to save all projections
  private static saveAll(projections: SavedProjection[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECTIONS, JSON.stringify(projections))
    } catch (error) {
      console.error('Failed to save projections:', error)
      throw new Error('Failed to save projections to localStorage')
    }
  }

  // Get projection results
  static getResult(projectionId: string): SavedProjectionResult | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RESULTS)
      const results: Record<string, SavedProjectionResult> = stored ? JSON.parse(stored) : {}
      return results[projectionId] || null
    } catch (error) {
      console.error('Failed to load projection result:', error)
      return null
    }
  }

  // Save projection result
  static saveResult(result: SavedProjectionResult): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RESULTS)
      const results: Record<string, SavedProjectionResult> = stored ? JSON.parse(stored) : {}
      results[result.projectionId] = result
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results))
    } catch (error) {
      console.error('Failed to save projection result:', error)
    }
  }

  // Delete projection result
  static deleteResult(projectionId: string): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RESULTS)
      const results: Record<string, SavedProjectionResult> = stored ? JSON.parse(stored) : {}
      delete results[projectionId]
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results))
    } catch (error) {
      console.error('Failed to delete projection result:', error)
    }
  }

  // Export projections as JSON
  static export(): string {
    const projections = this.getAll()
    return JSON.stringify(projections, null, 2)
  }

  // Import projections from JSON
  static import(jsonString: string): SavedProjection[] {
    try {
      const imported: SavedProjection[] = JSON.parse(jsonString)
      
      // Validate structure
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected array')
      }

      const existingProjections = this.getAll()
      const newProjections = [...existingProjections]

      for (const projection of imported) {
        if (!projection.name || !projection.code) {
          continue // Skip invalid projections
        }

        // Generate new ID to avoid conflicts
        const newProjection: SavedProjection = {
          ...projection,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        newProjections.push(newProjection)
      }

      this.saveAll(newProjections)
      return imported
    } catch (error) {
      console.error('Failed to import projections:', error)
      throw new Error('Failed to import projections')
    }
  }

  // Clear all data (for development/testing)
  static clear(): void {
    localStorage.removeItem(STORAGE_KEYS.PROJECTIONS)
    localStorage.removeItem(STORAGE_KEYS.RESULTS)
  }
}