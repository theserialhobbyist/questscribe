import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { DOMParser } from 'prosemirror-model'
import { markerSchema } from './schema'
import { keymap } from 'prosemirror-keymap'
import { history, undo, redo } from 'prosemirror-history'
import { baseKeymap, toggleMark } from 'prosemirror-commands'
import { Plugin } from 'prosemirror-state'
import { AllSelection } from 'prosemirror-state'
import { invoke } from '@tauri-apps/api/tauri'
import EditorToolbar from './EditorToolbar'
import 'prosemirror-view/style/prosemirror.css'

const Editor = forwardRef(({ onCursorMove, onEditorReady, onInsertStateChange }, ref) => {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const [editorView, setEditorView] = useState(null)

  // Expose functions to parent via ref
  useImperativeHandle(ref, () => ({
    insertMarker: (marker) => {
      if (!viewRef.current) return

      const view = viewRef.current
      const { tr } = view.state

      // Create marker node
      const markerNode = markerSchema.nodes.marker.create({
        id: marker.id,
        entityId: marker.entity_id,
        changes: marker.changes,
        visual: marker.visual,
        description: marker.description || '',
        createdAt: marker.created_at || 0,
        modifiedAt: marker.modified_at || 0
      })

      // Insert at cursor position
      tr.insert(marker.position, markerNode)
      view.dispatch(tr)
    },
    updateMarker: (updatedMarker) => {
      if (!viewRef.current) return

      const view = viewRef.current
      const { tr, doc } = view.state
      let found = false

      // Find the marker node in the document
      doc.descendants((node, pos) => {
        if (node.type.name === 'marker' && node.attrs.id === updatedMarker.id) {
          // Replace the marker node with updated version
          const newMarker = markerSchema.nodes.marker.create({
            id: updatedMarker.id,
            entityId: updatedMarker.entity_id,
            changes: updatedMarker.changes,
            visual: updatedMarker.visual,
            description: updatedMarker.description || '',
            createdAt: updatedMarker.created_at || 0,
            modifiedAt: updatedMarker.modified_at || 0
          })

          tr.replaceWith(pos, pos + node.nodeSize, newMarker)
          found = true
          return false // Stop searching
        }
      })

      if (found) {
        view.dispatch(tr)
      }
    },
    removeMarker: (markerId) => {
      if (!viewRef.current) return

      const view = viewRef.current
      const { tr, doc } = view.state
      let found = false

      // Find and remove the marker node
      doc.descendants((node, pos) => {
        if (node.type.name === 'marker' && node.attrs.id === markerId) {
          tr.delete(pos, pos + node.nodeSize)
          found = true
          return false // Stop searching
        }
      })

      if (found) {
        view.dispatch(tr)
      }
    },
    getContent: () => {
      if (viewRef.current) {
        // Return the ProseMirror document as JSON to preserve formatting
        return JSON.stringify(viewRef.current.state.doc.toJSON())
      }
      return ''
    },
    getPlainText: () => {
      if (viewRef.current) {
        // Return plain text without any formatting or markers
        return viewRef.current.state.doc.textContent
      }
      return ''
    },
    getFormattedContent: () => {
      if (viewRef.current) {
        // Return the document structure for export (preserves formatting, excludes markers)
        return JSON.stringify(viewRef.current.state.doc.toJSON())
      }
      return ''
    },
    setContent: (content) => {
      if (viewRef.current) {
        const view = viewRef.current
        try {
          // Parse JSON and restore ProseMirror document
          const docJSON = JSON.parse(content)
          const newDoc = markerSchema.nodeFromJSON(docJSON)
          const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content)
          view.dispatch(tr)
        } catch (e) {
          // If parsing fails, treat as plain text (backward compatibility)
          console.warn('Failed to parse document JSON, treating as plain text:', e)
          const newDoc = markerSchema.node('doc', null, [
            markerSchema.node('paragraph', null, content ? [markerSchema.text(content)] : [])
          ])
          const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content)
          view.dispatch(tr)
        }
      }
    },
    clearDocument: () => {
      if (viewRef.current) {
        const view = viewRef.current
        const newDoc = markerSchema.node('doc', null, [markerSchema.node('paragraph')])
        const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content)
        view.dispatch(tr)
      }
    }
  }))

  // Plugin to handle marker node interactions and sync positions to backend
  const markerPlugin = new Plugin({
    props: {
      handleClickOn(view, pos, node, nodePos, event) {
        // Check if clicked node is a marker
        if (node.type.name === 'marker') {
          event.preventDefault()
          event.stopPropagation()

          // Convert marker node to the format expected by the edit dialog
          const marker = {
            id: node.attrs.id,
            entity_id: node.attrs.entityId,
            position: nodePos,
            changes: node.attrs.changes,
            visual: node.attrs.visual,
            description: node.attrs.description,
            created_at: node.attrs.createdAt,
            modified_at: node.attrs.modifiedAt
          }

          // Trigger edit modal
          if (window.editMarker) {
            window.editMarker(marker)
          }

          return true
        }
        return false
      }
    },
    // Sync marker positions to backend when document changes
    appendTransaction(transactions, oldState, newState) {
      const docChanged = transactions.some(tr => tr.docChanged)
      if (!docChanged) return null

      const positionUpdates = []

      // Find all marker nodes and their positions
      newState.doc.descendants((node, pos) => {
        if (node.type.name === 'marker') {
          positionUpdates.push([node.attrs.id, pos])
        }
      })

      // Update positions in backend
      if (positionUpdates.length > 0) {
        invoke('update_marker_positions', { positionUpdates })
          .catch(err => console.error('Failed to update marker positions:', err))
      }

      return null
    }
  })

  useEffect(() => {
    // Only initialize once
    if (!editorRef.current || viewRef.current) return

    // Create a simple paragraph to start with
    const doc = DOMParser.fromSchema(markerSchema).parse(
      document.createElement('div')
    )

    // Custom select all command that only selects document content
    const selectAll = (state, dispatch) => {
      if (dispatch) {
        const selection = new AllSelection(state.doc)
        dispatch(state.tr.setSelection(selection))
      }
      return true
    }

    // Create editor state with plugins
    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        keymap({
          'Mod-a': selectAll, // Override default select all
          'Mod-z': undo,
          'Mod-Shift-z': redo,
          'Mod-y': redo,
          'Mod-b': toggleMark(markerSchema.marks.strong),
          'Mod-i': toggleMark(markerSchema.marks.em),
        }),
        keymap(baseKeymap),
        markerPlugin,
      ],
    })

    // Create editor view
    const view = new EditorView(editorRef.current, {
      state,
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction)
        view.updateState(newState)
        
        // Notify parent of cursor position changes
        if (transaction.selection && onCursorMove) {
          onCursorMove(transaction.selection.from)
        }
      },
    })

    viewRef.current = view
    setEditorView(view)

    // Focus the editor on mount
    view.focus()

    console.log('ProseMirror editor initialized')

    // Notify parent that editor is ready
    if (onEditorReady) {
      onEditorReady()
    }

    // Cleanup
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, []) // Empty dependency array - only run once

  // Update cursor callback when it changes, without recreating editor
  useEffect(() => {
    if (viewRef.current && onCursorMove) {
      const view = viewRef.current
      const currentPos = view.state.selection.from
      onCursorMove(currentPos)
    }
  }, [onCursorMove])

  return (
    <div className="editor-container">
      <EditorToolbar editorView={editorView} onInsertStateChange={onInsertStateChange} />
      <div ref={editorRef} className="editor" />
    </div>
  )
})

Editor.displayName = 'Editor'

export default Editor