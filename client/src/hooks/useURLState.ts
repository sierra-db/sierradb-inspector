import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * Custom hook for managing form state in URL search parameters
 * This ensures form values persist across page reloads and navigation
 */
export function useURLState<T extends Record<string, string>>(
  initialState: T,
  basePath?: string
): [T, (newState: Partial<T>) => void, () => void] {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Parse current URL parameters into state
  const parseURLState = (): T => {
    const params = new URLSearchParams(location.search)
    const urlState = { ...initialState }
    
    Object.keys(initialState).forEach(key => {
      const value = params.get(key)
      if (value !== null) {
        urlState[key as keyof T] = value as T[keyof T]
      }
    })
    
    return urlState
  }
  
  const [state, setState] = useState<T>(parseURLState())
  
  // Update state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const newState = parseURLState()
    setState(newState)
  }, [location.search])
  
  // Update URL when state changes
  const updateState = (newState: Partial<T>) => {
    const updatedState = { ...state, ...newState }
    setState(updatedState)
    
    // Build URL search params
    const params = new URLSearchParams()
    Object.entries(updatedState).forEach(([key, value]) => {
      if (value && value !== initialState[key as keyof T]) {
        params.set(key, value as string)
      }
    })
    
    const searchString = params.toString()
    const newURL = basePath || location.pathname
    
    navigate(`${newURL}${searchString ? `?${searchString}` : ''}`, {
      replace: true // Use replace to avoid cluttering browser history
    })
  }
  
  // Reset to initial state
  const resetState = () => {
    setState(initialState)
    const newURL = basePath || location.pathname
    navigate(newURL, { replace: true })
  }
  
  return [state, updateState, resetState]
}