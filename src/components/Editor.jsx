import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import { EditorState } from 'prosemirror-state'
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view'
import { DOMParser } from 'prosemirror-model'
import { schema } from 'prosemirror-schema-basic'
import { keymap } from 'prosemirror-keymap'
import { history, undo, redo } from 'prosemirror-history'
import { baseKeymap, toggleMark } from 'prosemirror-commands'
import { Plugin } from 'prosemirror-state'
import EditorToolbar from './EditorToolbar'
import 'prosemirror-view/style/prosemirror.css'

const Editor = forwardRef(({ onCursorMove, onEditorReady, onInsertStateChange }, ref) => {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const [editorView, setEditorView] = useState(null)
  const markersRef = useRef([])

  // Expose functions to parent via ref
  useImperativeHandle(ref, () => ({
    insertMarker: (marker) => {
      markersRef.current.push(marker)
      if (viewRef.current) {
        // Force update decorations
        const view = viewRef.current
        view.dispatch(view.state.tr)
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
          const newDoc = schema.nodeFromJSON(docJSON)
          const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content)
          view.dispatch(tr)
        } catch (e) {
          // If parsing fails, treat as plain text (backward compatibility)
          console.warn('Failed to parse document JSON, treating as plain text:', e)
          const newDoc = schema.node('doc', null, [
            schema.node('paragraph', null, content ? [schema.text(content)] : [])
          ])
          const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content)
          view.dispatch(tr)
        }
      }
    },
    clearDocument: () => {
      markersRef.current = []
      if (viewRef.current) {
        const view = viewRef.current
        const newDoc = schema.node('doc', null, [schema.node('paragraph')])
        const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content)
        view.dispatch(tr)
      }
    }
  }))

  // Plugin to render markers as decorations
  const markerPlugin = new Plugin({
    state: {
      init() { return DecorationSet.empty },
      apply(tr, set) {
        // Create decorations for all markers
        const decorations = markersRef.current.map(marker => {
          const elem = document.createElement('span')
          elem.className = 'marker'
          elem.style.color = marker.visual.color
          elem.style.cursor = 'pointer'
          elem.style.fontSize = '16px'
          elem.textContent = marker.visual.icon

          // Build tooltip with marker details
          const changes = marker.changes.map(c =>
            `${c.field_name}: ${c.change_type === 'absolute' ? 'Set to' : 'Add'} ${c.value}`
          ).join('\n')
          elem.title = `Marker (${marker.entity_id})\n${changes}`

          // Click handler to show marker details
          elem.onclick = (e) => {
            e.preventDefault()
            e.stopPropagation()
            alert(`Marker Details:\n\nEntity: ${marker.entity_id}\nPosition: ${marker.position}\n\n${changes}`)
          }

          return Decoration.widget(marker.position, elem, {
            side: 0,
            key: marker.id
          })
        })

        return DecorationSet.create(tr.doc, decorations)
      }
    },
    props: {
      decorations(state) {
        return this.getState(state)
      }
    }
  })

  useEffect(() => {
    // Only initialize once
    if (!editorRef.current || viewRef.current) return

    // Create a simple paragraph to start with
    const doc = DOMParser.fromSchema(schema).parse(
      document.createElement('div')
    )

    // Create editor state with plugins
    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        keymap({
          'Mod-z': undo,
          'Mod-Shift-z': redo,
          'Mod-y': redo,
          'Mod-b': toggleMark(schema.marks.strong),
          'Mod-i': toggleMark(schema.marks.em),
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