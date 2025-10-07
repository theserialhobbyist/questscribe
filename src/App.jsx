import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'

function App() {
  const [currentEntity, setCurrentEntity] = useState(null)
  const [entities, setEntities] = useState([])
  const [cursorPosition, setCursorPosition] = useState(0)
  const [darkMode, setDarkMode] = useState(false)

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

  return (
    <div className="app">
      <div className="toolbar">
        <h1>LitRPG Writer</h1>
        <button onClick={() => console.log('New document')}>New</button>
        <button onClick={() => console.log('Open document')}>Open</button>
        <button onClick={() => console.log('Save document')}>Save</button>
        <button onClick={() => console.log('Insert marker')}>Insert State Change</button>
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
          onCursorMove={handleCursorMove}
        />
        
        <Sidebar 
          entities={entities}
          currentEntity={currentEntity}
          cursorPosition={cursorPosition}
          onEntityChange={setCurrentEntity}
          onEntitiesRefresh={loadEntities}
        />
      </div>
    </div>
  )
}

export default App