/**
 * QuestScribe - Main Application Component
 *
 * This is the root component of the QuestScribe application, a specialized word processor
 * for writing LitRPG novels with dynamic character state tracking.
 *
 * Features:
 * - Rich text editing with ProseMirror
 * - State change markers for tracking character progression
 * - Document management (new, open, save, export)
 * - Character/entity management
 * - Dark mode support
 *
 * @component
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { open, save, ask, message as showMessage } from '@tauri-apps/api/dialog'
import { appWindow } from '@tauri-apps/api/window'
import Editor from './components/Editor'
import Sidebar from './components/Sidebar'
import MarkerDialog from './components/MarkerDialog'
import StatusBar from './components/StatusBar'
import { checkForUpdates, ignoreUpdate } from './utils/updateChecker'
import logo from './QuestScribeLogo.png'

function App() {
  const [currentEntity, setCurrentEntity] = useState(null)
  const [entities, setEntities] = useState([])
  const [cursorPosition, setCursorPosition] = useState(0)
  const [wordCount, setWordCount] = useState(0)
  const [darkMode, setDarkMode] = useState(false)
  const [isMarkerDialogOpen, setIsMarkerDialogOpen] = useState(false)
  const [editingMarker, setEditingMarker] = useState(null)
  const [currentFilePath, setCurrentFilePath] = useState(null)
  const [updateInfo, setUpdateInfo] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false)
  const editorRef = useRef(null)
  const autoSaveTimerRef = useRef(null)
  const lastSavedContentRef = useRef('')
  const hasUnsavedChangesRef = useRef(false)

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

  // Check for updates on startup
  useEffect(() => {
    const checkUpdates = async () => {
      const update = await checkForUpdates()
      if (update) {
        setUpdateInfo(update)
      }
    }
    checkUpdates()
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

  // Track document changes for unsaved indicator
  const handleDocumentChange = useCallback(() => {
    setHasUnsavedChanges(true)
    hasUnsavedChangesRef.current = true
  }, [])

  // Use useCallback to prevent function from being recreated on every render
  const handleCursorMove = useCallback((position) => {
    setCursorPosition(position)
  }, [])

  const handleWordCountChange = useCallback((count) => {
    setWordCount(count)
  }, [])

  const handleMarkerInserted = useCallback(async (marker, isEditing, isDeleted) => {
    if (isDeleted) {
      // Remove marker from editor
      if (editorRef.current) {
        editorRef.current.removeMarker(marker.id)
      }
    } else if (isEditing) {
      // Update marker in editor
      if (editorRef.current) {
        editorRef.current.updateMarker(marker)
      }
    } else {
      // Add new marker to editor
      if (editorRef.current) {
        editorRef.current.insertMarker(marker)
      }
    }
    // Force sidebar to refresh by updating cursor position
    setCursorPosition(cursorPosition => cursorPosition)

    // Reload entities to get updated field lists
    await loadEntities()
  }, [loadEntities])

  const handleEditMarker = useCallback((marker) => {
    setEditingMarker(marker)
    setIsMarkerDialogOpen(true)
  }, [])

  // Set up global edit marker function for the editor
  useEffect(() => {
    window.editMarker = handleEditMarker
    return () => {
      delete window.editMarker
    }
  }, [handleEditMarker])

  const handleNewDocument = useCallback(async () => {
    // Only warn if there are unsaved changes
    if (hasUnsavedChanges) {
      const proceed = await ask('You have unsaved changes. Create new document anyway? All unsaved changes will be lost.', {
        title: 'Unsaved Changes',
        type: 'warning'
      })
      if (!proceed) return
    }

    try {
      await invoke('new_document')
      // Clear editor
      if (editorRef.current) {
        editorRef.current.clearDocument()
      }
      // Clear current file path
      setCurrentFilePath(null)
      // Reset saved content and unsaved changes
      lastSavedContentRef.current = ''
      setHasUnsavedChanges(false)
      hasUnsavedChangesRef.current = false
      // Reload entities (should be empty now)
      await loadEntities()
    } catch (error) {
      console.error('Failed to create new document:', error)
      await showMessage('Failed to create new document: ' + error, {
        title: 'Error',
        type: 'error'
      })
    }
  }, [hasUnsavedChanges, loadEntities])

  const handleSaveDocument = useCallback(async (silent = false) => {
    try {
      // If we have a current file, save to it directly
      if (currentFilePath) {
        const content = editorRef.current?.getContent() || ''
        await invoke('save_document', {
          filePath: currentFilePath,
          content
        })
        lastSavedContentRef.current = content
        setHasUnsavedChanges(false)
        hasUnsavedChangesRef.current = false
        if (!silent) {
          alert('Document saved successfully!')
        }
      } else {
        // Otherwise, show save dialog (Save As)
        await handleSaveAsDocument()
      }
    } catch (error) {
      console.error('Failed to save document:', error)
      if (!silent) {
        alert('Failed to save document: ' + error)
      }
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
        lastSavedContentRef.current = content
        setHasUnsavedChanges(false)
        hasUnsavedChangesRef.current = false
        alert('Document saved successfully!')
      }
    } catch (error) {
      console.error('Failed to save document:', error)
      alert('Failed to save document: ' + error)
    }
  }, [])

  const handleLoadDocument = useCallback(async () => {
    try {
      // Warn if there are unsaved changes
      if (hasUnsavedChanges) {
        const proceed = await ask('You have unsaved changes. Open a different document anyway? All unsaved changes will be lost.', {
          title: 'Unsaved Changes',
          type: 'warning'
        })
        if (!proceed) return
      }

      // Show open dialog
      const filePath = await open({
        filters: [{
          name: 'QuestScribe Document',
          extensions: ['qsd']
        }]
      })

      if (filePath) {
        const document = await invoke('load_document', { filePath })

        // Set content in editor (markers are already embedded in the document)
        if (editorRef.current) {
          editorRef.current.setContent(document.content)
        }

        // Save the current file path
        setCurrentFilePath(filePath)

        // Update saved content reference and clear unsaved changes
        lastSavedContentRef.current = document.content
        setHasUnsavedChanges(false)
        hasUnsavedChangesRef.current = false

        // Reload entities only (markers are already in the document)
        await loadEntities()
      }
    } catch (error) {
      console.error('Failed to load document:', error)
      await showMessage('Failed to load document: ' + error, {
        title: 'Error',
        type: 'error'
      })
    }
  }, [hasUnsavedChanges, loadEntities])


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

  // Navigation handlers
  const handlePreviousChapter = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.navigateToPreviousChapter()
    }
  }, [])

  const handleNextChapter = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.navigateToNextChapter()
    }
  }, [])

  const handlePreviousMarker = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.navigateToPreviousMarker()
    }
  }, [])

  const handleNextMarker = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.navigateToNextMarker()
    }
  }, [])

  const handleInsertCharacterSheet = useCallback(async (entityId) => {
    if (!editorRef.current) return

    try {
      const sheet = await invoke('format_character_sheet', {
        entityId,
        position: cursorPosition
      })

      editorRef.current.insertText(sheet)
    } catch (error) {
      console.error('Failed to insert character sheet:', error)
      alert('Failed to insert character sheet: ' + error)
    }
  }, [cursorPosition])

  const handleIgnoreUpdate = useCallback(() => {
    if (updateInfo) {
      ignoreUpdate(updateInfo.version)
      setUpdateInfo(null)
    }
  }, [updateInfo])

  const handleToggleAutoSave = useCallback(() => {
    setAutoSaveEnabled(prev => !prev)
  }, [])

  // Autosave effect - runs every 3 minutes if enabled and there are unsaved changes
  useEffect(() => {
    if (autoSaveEnabled && hasUnsavedChanges && currentFilePath) {
      // Set up interval for 3 minutes (180000 ms)
      autoSaveTimerRef.current = setInterval(() => {
        if (hasUnsavedChanges && currentFilePath) {
          handleSaveDocument(true) // silent save
        }
      }, 180000) // 3 minutes

      return () => {
        if (autoSaveTimerRef.current) {
          clearInterval(autoSaveTimerRef.current)
        }
      }
    }
  }, [autoSaveEnabled, hasUnsavedChanges, currentFilePath, handleSaveDocument])

  // Prevent window close if there are unsaved changes
  // Register only once on mount
  useEffect(() => {
    let unlisten = null
    let isAsking = false

    const setupCloseHandler = async () => {
      try {
        unlisten = await appWindow.onCloseRequested(async (event) => {
          // Always prevent default first
          event.preventDefault()

          // If we're already asking, don't show another dialog
          if (isAsking) return

          // Use ref to get current value
          if (hasUnsavedChangesRef.current) {
            isAsking = true
            try {
              const proceed = await ask('You have unsaved changes. Close anyway? All unsaved changes will be lost.', {
                title: 'Unsaved Changes',
                type: 'warning'
              })

              if (proceed) {
                // Unregister the handler to avoid recursive calls
                if (unlisten) {
                  unlisten()
                  unlisten = null
                }
                // Force close the window
                await appWindow.close()
              }
            } finally {
              isAsking = false
            }
          } else {
            // No unsaved changes, allow close
            if (unlisten) {
              unlisten()
              unlisten = null
            }
            await appWindow.close()
          }
        })
      } catch (error) {
        console.error('Failed to setup close handler:', error)
      }
    }

    setupCloseHandler()

    return () => {
      if (unlisten && typeof unlisten === 'function') {
        unlisten()
      }
    }
  }, []) // Empty dependency array - only run once

  return (
    <div className="app">
      <div className="toolbar">
        <img src={logo} alt="QuestScribe" className="app-logo" />
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
          onWordCountChange={handleWordCountChange}
          onDocumentChange={handleDocumentChange}
          onEditorReady={handleEditorReady}
          onInsertStateChange={() => setIsMarkerDialogOpen(true)}
        />

        <Sidebar
          entities={entities}
          currentEntity={currentEntity}
          cursorPosition={cursorPosition}
          onEntityChange={setCurrentEntity}
          onEntitiesRefresh={loadEntities}
          editorRef={editorRef}
          onInsertCharacterSheet={handleInsertCharacterSheet}
        />
      </div>

      <StatusBar
        wordCount={wordCount}
        onPreviousChapter={handlePreviousChapter}
        onNextChapter={handleNextChapter}
        onPreviousMarker={handlePreviousMarker}
        onNextMarker={handleNextMarker}
        updateInfo={updateInfo}
        onIgnoreUpdate={handleIgnoreUpdate}
        hasUnsavedChanges={hasUnsavedChanges}
        autoSaveEnabled={autoSaveEnabled}
        onToggleAutoSave={handleToggleAutoSave}
      />

      <MarkerDialog
        isOpen={isMarkerDialogOpen}
        onClose={() => {
          setIsMarkerDialogOpen(false)
          setEditingMarker(null)
        }}
        entities={entities}
        cursorPosition={cursorPosition}
        onMarkerInserted={handleMarkerInserted}
        editingMarker={editingMarker}
      />
    </div>
  )
}

export default App