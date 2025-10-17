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
import { Decoration, DecorationSet } from 'prosemirror-view'
import { invoke } from '@tauri-apps/api/tauri'
import EditorToolbar from './EditorToolbar'
import ContextMenu from './ContextMenu'
import { initSpellChecker, checkWord, getSuggestions, addToCustomDictionary } from '../utils/spellChecker'
import 'prosemirror-view/style/prosemirror.css'

const Editor = forwardRef(({ onCursorMove, onWordCountChange, onDocumentChange, onEditorReady, onInsertStateChange }, ref) => {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const [editorView, setEditorView] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)

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
    },
    navigateToPreviousChapter: () => {
      if (!viewRef.current) return
      const view = viewRef.current
      const { doc, selection } = view.state
      const currentPos = selection.from
      let foundPos = null

      // Find previous heading before current position
      doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && pos < currentPos) {
          foundPos = pos
        }
      })

      if (foundPos !== null) {
        const tr = view.state.tr.setSelection(
          view.state.selection.constructor.near(view.state.doc.resolve(foundPos))
        ).scrollIntoView()
        view.dispatch(tr)
        view.focus()
      }
    },
    navigateToNextChapter: () => {
      if (!viewRef.current) return
      const view = viewRef.current
      const { doc, selection } = view.state
      const currentPos = selection.from
      let foundPos = null

      // Find next heading after current position
      doc.descendants((node, pos) => {
        if (foundPos === null && node.type.name === 'heading' && pos > currentPos) {
          foundPos = pos
          return false // Stop searching
        }
      })

      if (foundPos !== null) {
        const tr = view.state.tr.setSelection(
          view.state.selection.constructor.near(view.state.doc.resolve(foundPos))
        ).scrollIntoView()
        view.dispatch(tr)
        view.focus()
      }
    },
    navigateToPreviousMarker: () => {
      if (!viewRef.current) return
      const view = viewRef.current
      const { doc, selection } = view.state
      const currentPos = selection.from
      let foundPos = null

      // Find previous marker before current position
      doc.descendants((node, pos) => {
        if (node.type.name === 'marker' && pos < currentPos) {
          foundPos = pos
        }
      })

      if (foundPos !== null) {
        const tr = view.state.tr.setSelection(
          view.state.selection.constructor.near(view.state.doc.resolve(foundPos))
        ).scrollIntoView()
        view.dispatch(tr)
        view.focus()
      }
    },
    navigateToNextMarker: () => {
      if (!viewRef.current) return
      const view = viewRef.current
      const { doc, selection } = view.state
      const currentPos = selection.from
      let foundPos = null

      // Find next marker after current position
      doc.descendants((node, pos) => {
        if (foundPos === null && node.type.name === 'marker' && pos > currentPos) {
          foundPos = pos
          return false // Stop searching
        }
      })

      if (foundPos !== null) {
        const tr = view.state.tr.setSelection(
          view.state.selection.constructor.near(view.state.doc.resolve(foundPos))
        ).scrollIntoView()
        view.dispatch(tr)
        view.focus()
      }
    },
    insertText: (text) => {
      if (!viewRef.current) return
      const view = viewRef.current
      const { from } = view.state.selection

      // Split text into lines and create paragraph nodes
      const lines = text.split('\n')
      const nodes = lines.map(line =>
        markerSchema.nodes.paragraph.create(
          null,
          line ? [markerSchema.text(line)] : []
        )
      )

      // Insert paragraphs at cursor
      const tr = view.state.tr.replaceWith(
        from,
        from,
        nodes
      )
      view.dispatch(tr)
      view.focus()
    },
    insertSectionBreak: () => {
      if (!viewRef.current) return
      const view = viewRef.current
      const { from } = view.state.selection

      const breakText = '\n* * *\n'
      const lines = breakText.split('\n')
      const nodes = lines.map(line =>
        markerSchema.nodes.paragraph.create(
          null,
          line ? [markerSchema.text(line)] : []
        )
      )

      const tr = view.state.tr.replaceWith(from, from, nodes)
      view.dispatch(tr)
      view.focus()
    },
    insertChapterBreak: () => {
      if (!viewRef.current) return
      const view = viewRef.current
      const { from } = view.state.selection

      const heading = markerSchema.nodes.heading.create(
        { level: 1 },
        [markerSchema.text('Chapter X')]
      )
      const emptyPara = markerSchema.nodes.paragraph.create()

      const tr = view.state.tr.replaceWith(from, from, [heading, emptyPara])
      view.dispatch(tr)
      view.focus()
    }
  }))

  // Plugin to add red underlines to misspelled words
  const spellCheckPlugin = new Plugin({
    state: {
      init(_, { doc }) {
        return findMisspelledWords(doc)
      },
      apply(tr, oldDecorations) {
        // Only recompute if document changed
        if (tr.docChanged) {
          return findMisspelledWords(tr.doc)
        }
        // Map decorations through changes
        return oldDecorations.map(tr.mapping, tr.doc)
      }
    },
    props: {
      decorations(state) {
        return this.getState(state)
      }
    }
  })

  // Helper function to find misspelled words in the document
  function findMisspelledWords(doc) {
    const decorations = []
    const wordRegex = /\b[a-zA-Z]+\b/g

    doc.descendants((node, pos) => {
      if (node.isText) {
        const text = node.text
        let match

        while ((match = wordRegex.exec(text)) !== null) {
          const word = match[0]
          const from = pos + match.index
          const to = from + word.length

          // Check if word is misspelled
          if (!checkWord(word)) {
            decorations.push(
              Decoration.inline(from, to, {
                class: 'spelling-error'
              })
            )
          }
        }
      }
    })

    return DecorationSet.create(doc, decorations)
  }

  // Plugin to handle marker node interactions and sync positions to backend
  const markerPlugin = new Plugin({
    props: {
      handleClickOn(view, pos, node, nodePos, event) {
        // Check if clicked node is a marker
        if (node.type.name === 'marker') {
          // Only handle left-click (button 0), not right-click (button 2)
          if (event.button !== 0) {
            return false
          }

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

      // Build sets of marker IDs in old and new documents
      const oldMarkerIds = new Set()
      const newMarkerIds = new Set()
      const positionUpdates = []

      oldState.doc.descendants((node) => {
        if (node.type.name === 'marker') {
          oldMarkerIds.add(node.attrs.id)
        }
      })

      newState.doc.descendants((node, pos) => {
        if (node.type.name === 'marker') {
          newMarkerIds.add(node.attrs.id)
          positionUpdates.push([node.attrs.id, pos])
        }
      })

      // Detect deleted markers
      const deletedMarkerIds = [...oldMarkerIds].filter(id => !newMarkerIds.has(id))

      // Delete markers from backend
      deletedMarkerIds.forEach(markerId => {
        invoke('delete_marker', { markerId })
          .catch(err => console.error('Failed to delete marker:', err))
      })

      // Update positions in backend
      if (positionUpdates.length > 0) {
        invoke('update_marker_positions', { positionUpdates })
          .catch(err => console.error('Failed to update marker positions:', err))
      }

      return null
    }
  })

  // Initialize spell checker
  useEffect(() => {
    initSpellChecker()
  }, [])

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
        spellCheckPlugin,
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

        // Update word count if document changed
        if (transaction.docChanged) {
          if (onWordCountChange) {
            const text = newState.doc.textContent
            const words = text.trim().split(/\s+/).filter(w => w.length > 0)
            onWordCountChange(words.length)
          }
          // Notify parent that document changed
          if (onDocumentChange) {
            onDocumentChange()
          }
        }
      },
    })

    viewRef.current = view
    setEditorView(view)

    // Focus the editor on mount
    view.focus()

    // Initialize word count
    if (onWordCountChange) {
      const text = view.state.doc.textContent
      const words = text.trim().split(/\s+/).filter(w => w.length > 0)
      onWordCountChange(words.length)
    }

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
      <div
        ref={editorRef}
        className="editor"
        spellCheck={false}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()

          // Handle context menu here since the plugin handler isn't being called
          if (!viewRef.current) return

          const view = viewRef.current
          const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })
          if (!pos) return

          // Check if right-clicking on a marker
          const node = view.state.doc.nodeAt(pos.pos)
          let clickedMarker = null

          if (node && node.type.name === 'marker') {
            clickedMarker = {
              id: node.attrs.id,
              entity_id: node.attrs.entityId,
              position: pos.pos,
              changes: node.attrs.changes,
              visual: node.attrs.visual,
              description: node.attrs.description,
              created_at: node.attrs.createdAt,
              modified_at: node.attrs.modifiedAt
            }
          }

          // Check for misspelled word at cursor position
          let misspelledWord = null
          let wordRange = null

          // Get the word at the clicked position
          const $pos = view.state.doc.resolve(pos.pos)
          const textNode = $pos.parent.maybeChild($pos.index())

          if (textNode && textNode.isText) {
            const text = textNode.text
            const offset = pos.pos - $pos.start()

            // Find word boundaries
            let start = offset
            let end = offset

            // Move start back to word beginning
            while (start > 0 && /\w/.test(text[start - 1])) {
              start--
            }

            // Move end forward to word end
            while (end < text.length && /\w/.test(text[end])) {
              end++
            }

            if (start < end) {
              const word = text.substring(start, end)

              // Check if word is misspelled
              if (!checkWord(word)) {
                misspelledWord = word
                wordRange = {
                  from: $pos.start() + start,
                  to: $pos.start() + end
                }
              }
            }
          }

          // Build context menu items
          const menuItems = []

          // Add spelling suggestions if word is misspelled
          if (misspelledWord && wordRange) {
            const suggestions = getSuggestions(misspelledWord)

            if (suggestions.length > 0) {
              suggestions.forEach(suggestion => {
                menuItems.push({
                  icon: '✓',
                  label: suggestion,
                  action: () => {
                    // Replace the misspelled word with the suggestion
                    const tr = view.state.tr.replaceWith(
                      wordRange.from,
                      wordRange.to,
                      view.state.schema.text(suggestion)
                    )
                    view.dispatch(tr)
                    view.focus()
                  }
                })
              })

              menuItems.push({ divider: true })
            }

            // Add "Add to Dictionary" option
            menuItems.push({
              icon: '📖',
              label: `Add "${misspelledWord}" to Dictionary`,
              action: () => {
                addToCustomDictionary(misspelledWord)
                // Force a re-render to remove the red underline
                view.focus()
              }
            })

            menuItems.push({ divider: true })
          }

          if (clickedMarker) {
            // Marker-specific menu
            menuItems.push(
              { icon: '✏️', label: 'Edit Marker', action: () => window.editMarker?.(clickedMarker) },
              { icon: '🗑️', label: 'Delete Marker', action: () => {
                // Delete the marker node
                const tr = view.state.tr.delete(pos.pos, pos.pos + node.nodeSize)
                view.dispatch(tr)
              }},
              { divider: true }
            )
          }

          menuItems.push(
            { icon: '✨', label: 'Insert State Change', action: () => {
              // Move cursor to clicked position first
              const $pos = view.state.doc.resolve(pos.pos)
              const tr = view.state.tr.setSelection(view.state.selection.constructor.near($pos))
              view.dispatch(tr)
              onInsertStateChange?.()
            }},
            { divider: true },
            { icon: '📄', label: 'Insert Section Break', action: () => {
              const $pos = view.state.doc.resolve(pos.pos)
              const tr = view.state.tr.setSelection(view.state.selection.constructor.near($pos))
              view.dispatch(tr)

              // Insert section break
              const breakText = '\n* * *\n'
              const lines = breakText.split('\n')
              const nodes = lines.map(line =>
                markerSchema.nodes.paragraph.create(
                  null,
                  line ? [markerSchema.text(line)] : []
                )
              )
              const insertTr = view.state.tr.replaceWith(pos.pos, pos.pos, nodes)
              view.dispatch(insertTr)
            }},
            { icon: '📖', label: 'Insert Chapter Break', action: () => {
              const $pos = view.state.doc.resolve(pos.pos)
              const tr = view.state.tr.setSelection(view.state.selection.constructor.near($pos))
              view.dispatch(tr)

              // Insert chapter heading
              const heading = markerSchema.nodes.heading.create(
                { level: 1 },
                [markerSchema.text('Chapter X')]
              )
              const emptyPara = markerSchema.nodes.paragraph.create()
              const insertTr = view.state.tr.replaceWith(pos.pos, pos.pos, [heading, emptyPara])
              view.dispatch(insertTr)
            }},
            { divider: true },
            { icon: '📋', label: 'Copy', action: () => {
              document.execCommand('copy')
            }},
            { icon: '📄', label: 'Paste', action: async () => {
              try {
                const text = await navigator.clipboard.readText()
                if (text) {
                  const $pos = view.state.doc.resolve(pos.pos)
                  const tr = view.state.tr.setSelection(view.state.selection.constructor.near($pos))
                  view.dispatch(tr)

                  // Insert the pasted text
                  const lines = text.split('\n')
                  const nodes = lines.map(line =>
                    markerSchema.nodes.paragraph.create(
                      null,
                      line ? [markerSchema.text(line)] : []
                    )
                  )
                  const insertTr = view.state.tr.replaceWith(pos.pos, pos.pos, nodes)
                  view.dispatch(insertTr)
                }
              } catch (err) {
                console.error('Failed to read clipboard:', err)
              }
            }},
            { icon: '📝', label: 'Paste Plain Text', action: async () => {
              try {
                const text = await navigator.clipboard.readText()
                if (text) {
                  const $pos = view.state.doc.resolve(pos.pos)
                  const tr = view.state.tr.setSelection(view.state.selection.constructor.near($pos))
                  view.dispatch(tr)

                  // Strip any formatting and insert as plain text
                  const plainText = text.replace(/\r\n/g, '\n')
                  const lines = plainText.split('\n')
                  const nodes = lines.map(line =>
                    markerSchema.nodes.paragraph.create(
                      null,
                      line ? [markerSchema.text(line)] : []
                    )
                  )
                  const insertTr = view.state.tr.replaceWith(pos.pos, pos.pos, nodes)
                  view.dispatch(insertTr)
                }
              } catch (err) {
                console.error('Failed to read clipboard:', err)
              }
            }}
          )

          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            items: menuItems
          })
        }}
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
})

Editor.displayName = 'Editor'

export default Editor