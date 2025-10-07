import React, { useEffect, useRef, useState } from 'react'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { DOMParser } from 'prosemirror-model'
import { schema } from 'prosemirror-schema-basic'
import { keymap } from 'prosemirror-keymap'
import { history, undo, redo } from 'prosemirror-history'
import { baseKeymap, toggleMark } from 'prosemirror-commands'
import EditorToolbar from './EditorToolbar'
import 'prosemirror-view/style/prosemirror.css'

function Editor({ onCursorMove }) {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const [editorView, setEditorView] = useState(null)

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
      <EditorToolbar editorView={editorView} />
      <div ref={editorRef} className="editor" />
    </div>
  )
}

export default Editor