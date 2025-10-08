import React from 'react'
import { toggleMark, setBlockType } from 'prosemirror-commands'

// Helper function to insert a dinkus (section break)
function insertDinkus(view) {
  const { state, dispatch } = view
  const { $from } = state.selection
  
  // Create a centered paragraph with the dinkus
  const dinkusNode = state.schema.nodes.paragraph.create(
    { class: 'dinkus' },
    state.schema.text('* * *')
  )
  
  // Insert it and add blank paragraphs before/after
  const emptyPara = state.schema.nodes.paragraph.create()
  const tr = state.tr.insert($from.after(), [emptyPara, dinkusNode, emptyPara])
  
  dispatch(tr)
  view.focus()
}

// Helper function to insert a chapter break
function insertChapterBreak(view) {
  const { state, dispatch } = view
  const { $from } = state.selection
  
  // Create heading for chapter break
  const chapterNode = state.schema.nodes.heading.create(
    { level: 1, class: 'chapter-break' },
    state.schema.text('# # #')
  )
  
  // Insert it with blank paragraphs
  const emptyPara = state.schema.nodes.paragraph.create()
  const tr = state.tr.insert($from.after(), [emptyPara, chapterNode, emptyPara])
  
  dispatch(tr)
  view.focus()
}

function EditorToolbar({ editorView, onInsertStateChange }) {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0)

  // Re-render toolbar when selection changes
  React.useEffect(() => {
    if (!editorView) return

    const updateListener = () => {
      forceUpdate()
    }

    // Listen to state updates
    editorView.dom.addEventListener('focus', updateListener)
    editorView.dom.addEventListener('blur', updateListener)
    editorView.dom.addEventListener('keyup', updateListener)
    editorView.dom.addEventListener('mouseup', updateListener)

    return () => {
      editorView.dom.removeEventListener('focus', updateListener)
      editorView.dom.removeEventListener('blur', updateListener)
      editorView.dom.removeEventListener('keyup', updateListener)
      editorView.dom.removeEventListener('mouseup', updateListener)
    }
  }, [editorView])

  if (!editorView) return null

  const runCommand = (command) => {
    command(editorView.state, editorView.dispatch, editorView)
    editorView.focus()
    // Force update after command runs
    setTimeout(() => forceUpdate(), 0)
  }

  const isMarkActive = (markType) => {
    if (!markType) return false
    const { from, to, empty } = editorView.state.selection
    
    if (empty) {
      // Check stored marks when selection is empty (cursor position)
      return !!markType.isInSet(editorView.state.storedMarks || editorView.state.selection.$from.marks())
    }
    
    // Check if mark is active in selection
    let active = false
    editorView.state.doc.nodesBetween(from, to, (node) => {
      if (node.marks.find(mark => mark.type === markType)) {
        active = true
      }
    })
    return active
  }

  const isBlockActive = (nodeType, attrs = {}) => {
    const { $from } = editorView.state.selection
    const parentType = $from.parent.type
    
    if (parentType !== nodeType) return false
    
    // Check attributes match (e.g., heading level)
    if (Object.keys(attrs).length > 0) {
      return Object.entries(attrs).every(([key, value]) => 
        $from.parent.attrs[key] === value
      )
    }
    
    return true
  }

  const schema = editorView.state.schema

  return (
    <div className="editor-toolbar">
      <button
        className={isMarkActive(schema.marks.strong) ? 'active' : ''}
        onMouseDown={(e) => {
          e.preventDefault()
          runCommand(toggleMark(schema.marks.strong))
        }}
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>

      <button
        className={isMarkActive(schema.marks.em) ? 'active' : ''}
        onMouseDown={(e) => {
          e.preventDefault()
          runCommand(toggleMark(schema.marks.em))
        }}
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>

      <button
        className={isMarkActive(schema.marks.code) ? 'active' : ''}
        onMouseDown={(e) => {
          e.preventDefault()
          runCommand(toggleMark(schema.marks.code))
        }}
        title="Code"
      >
        {'</>'}
      </button>

      <div className="toolbar-separator" />

      <button
        className={isBlockActive(schema.nodes.heading, { level: 1 }) ? 'active' : ''}
        onMouseDown={(e) => {
          e.preventDefault()
          runCommand(setBlockType(schema.nodes.heading, { level: 1 }))
        }}
        title="Heading 1"
      >
        H1
      </button>

      <button
        className={isBlockActive(schema.nodes.heading, { level: 2 }) ? 'active' : ''}
        onMouseDown={(e) => {
          e.preventDefault()
          runCommand(setBlockType(schema.nodes.heading, { level: 2 }))
        }}
        title="Heading 2"
      >
        H2
      </button>

      <button
        className={isBlockActive(schema.nodes.paragraph) ? 'active' : ''}
        onMouseDown={(e) => {
          e.preventDefault()
          runCommand(setBlockType(schema.nodes.paragraph))
        }}
        title="Paragraph"
      >
        P
      </button>

      <div className="toolbar-separator" />

      <button
        onMouseDown={(e) => {
          e.preventDefault()
          insertDinkus(editorView)
        }}
        title="Section Break (Dinkus)"
      >
        * * *
      </button>

      <button
        onMouseDown={(e) => {
          e.preventDefault()
          insertChapterBreak(editorView)
        }}
        title="Chapter Break"
      >
        # # #
      </button>

      <div className="toolbar-separator" />

      <button
        onMouseDown={(e) => {
          e.preventDefault()
          if (onInsertStateChange) {
            onInsertStateChange()
          }
        }}
        title="Insert State Change"
      >
        ✨ State Change
      </button>
    </div>
  )
}

export default EditorToolbar