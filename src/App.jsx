import React, { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'
import MarkerDialog from './components/MarkerDialog'

function App() {
  const [currentEntity, setCurrentEntity] = useState(null)
  const [entities, setEntities] = useState([])
  const [cursorPosition, setCursorPosition] = useState(0)
  const [darkMode, setDarkMode] = useState(false)
  const [isMarkerDialogOpen, setIsMarkerDialogOpen] = useState(false)
  const editorRef = useRef(null)

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
  }, [darkMode])

  // Load entities on startup
  useEffect(() => {
    loadEntities()
  }, [])

  // Load markers when editor is ready
  const loadMarkers = useCallback(async () => {
    try {
      const markers = await invoke('get_all_markers')
      // Add each marker to the editor
      if (editorRef.current) {
        markers.forEach(marker => {
          editorRef.current.insertMarker(marker)
        })
      }
    } catch (error) {
      console.error('Failed to load markers:', error)
    }
  }, [])

  const handleEditorReady = useCallback(() => {
    loadMarkers()
  }, [loadMarkers])

  const loadEntities = useCallback(async () => {
    try {
      const loadedEntities = await invoke('get_all_entities')
      setEntities(loadedEntities)
      if (loadedEntities.length > 0 && !currentEntity) {
        setCurrentEntity(loadedEntities[0].id)
      }
    } catch (error) {
      console.error('Failed to load entities:', error)
    }
  }, [currentEntity])

  // Use useCallback to prevent function from being recreated on every render
  const handleCursorMove = useCallback((position) => {
    setCursorPosition(position)
  }, [])

  const handleMarkerInserted = useCallback((marker) => {
    // Add marker to editor
    if (editorRef.current) {
      editorRef.current.insertMarker(marker)
    }
    // Force sidebar to refresh by updating cursor position
    setCursorPosition(cursorPosition => cursorPosition)
  }, [])

  return (
    <div className="app">
      <div className="toolbar">
        <h1>LitRPG Writer</h1>
        <button onClick={() => console.log('New document')}>New</button>
        <button onClick={() => console.log('Open document')}>Open</button>
        <button onClick={() => console.log('Save document')}>Save</button>
        <button onClick={() => setIsMarkerDialogOpen(true)}>Insert State Change</button>
        <div style={{ flex: 1 }} />
        <button 
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
      
      <div className="main-content">
        <Editor
          ref={editorRef}
          onCursorMove={handleCursorMove}
          onEditorReady={handleEditorReady}
        />
        
        <Sidebar
          entities={entities}
          currentEntity={currentEntity}
          cursorPosition={cursorPosition}
          onEntityChange={setCurrentEntity}
          onEntitiesRefresh={loadEntities}
        />
      </div>

      <MarkerDialog
        isOpen={isMarkerDialogOpen}
        onClose={() => setIsMarkerDialogOpen(false)}
        entities={entities}
        cursorPosition={cursorPosition}
        onMarkerInserted={handleMarkerInserted}
      />
    </div>
  )
}

export default App