import React, { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { open, save } from '@tauri-apps/api/dialog'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'
import MarkerDialog from './components/MarkerDialog'

function App() {
  const [currentEntity, setCurrentEntity] = useState(null)
  const [entities, setEntities] = useState([])
  const [cursorPosition, setCursorPosition] = useState(0)
  const [darkMode, setDarkMode] = useState(false)
  const [isMarkerDialogOpen, setIsMarkerDialogOpen] = useState(false)
  const [currentFilePath, setCurrentFilePath] = useState(null)
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

  const handleNewDocument = useCallback(async () => {
    if (confirm('Create new document? Any unsaved changes will be lost.')) {
      try {
        await invoke('new_document')
        // Clear editor
        if (editorRef.current) {
          editorRef.current.clearDocument()
        }
        // Clear current file path
        setCurrentFilePath(null)
        // Reload entities (should be empty now)
        await loadEntities()
      } catch (error) {
        console.error('Failed to create new document:', error)
        alert('Failed to create new document: ' + error)
      }
    }
  }, [])

  const handleSaveDocument = useCallback(async () => {
    try {
      // If we have a current file, save to it directly
      if (currentFilePath) {
        const content = editorRef.current?.getContent() || ''
        await invoke('save_document', {
          filePath: currentFilePath,
          content
        })
        alert('Document saved successfully!')
      } else {
        // Otherwise, show save dialog (Save As)
        await handleSaveAsDocument()
      }
    } catch (error) {
      console.error('Failed to save document:', error)
      alert('Failed to save document: ' + error)
    }
  }, [currentFilePath])

  const handleSaveAsDocument = useCallback(async () => {
    try {
      // Get content from editor
      const content = editorRef.current?.getContent() || ''

      // Show save dialog
      const filePath = await save({
        filters: [{
          name: 'QuestScribe Document',
          extensions: ['qsd']
        }]
      })

      if (filePath) {
        await invoke('save_document', {
          filePath,
          content
        })
        setCurrentFilePath(filePath)
        alert('Document saved successfully!')
      }
    } catch (error) {
      console.error('Failed to save document:', error)
      alert('Failed to save document: ' + error)
    }
  }, [])

  const handleLoadDocument = useCallback(async () => {
    try {
      // Show open dialog
      const filePath = await open({
        filters: [{
          name: 'QuestScribe Document',
          extensions: ['qsd']
        }]
      })

      if (filePath) {
        const document = await invoke('load_document', { filePath })

        // Set content in editor
        if (editorRef.current) {
          editorRef.current.setContent(document.content)
        }

        // Save the current file path
        setCurrentFilePath(filePath)

        // Reload entities and markers
        await loadEntities()
        await loadMarkers()

        alert('Document loaded successfully!')
      }
    } catch (error) {
      console.error('Failed to load document:', error)
      alert('Failed to load document: ' + error)
    }
  }, [loadMarkers])


  const handleExportDocument = useCallback(async () => {
    try {
      // Get formatted content (ProseMirror JSON with formatting, no markers)
      const formattedContent = editorRef.current?.getFormattedContent() || ''

      // Show save dialog with multiple format options
      const filePath = await save({
        filters: [
          { name: 'Plain Text', extensions: ['txt'] },
          { name: 'Rich Text Format', extensions: ['rtf'] },
          { name: 'Word Document', extensions: ['docx'] }
        ]
      })

      if (filePath) {
        await invoke('export_document', {
          filePath,
          content: formattedContent
        })
        alert('Document exported successfully!')
      }
    } catch (error) {
      console.error('Failed to export document:', error)
      alert('Failed to export document: ' + error)
    }
  }, [])

  return (
    <div className="app">
      <div className="toolbar">
        <h1>QuestScribe</h1>
        <button onClick={handleNewDocument}>New</button>
        <button onClick={handleLoadDocument}>Open</button>
        <button onClick={handleSaveDocument}>Save</button>
        <button onClick={handleSaveAsDocument}>Save As</button>
        <span className="toolbar-divider"></span>
        <button onClick={handleExportDocument}>Export</button>
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
          onInsertStateChange={() => setIsMarkerDialogOpen(true)}
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