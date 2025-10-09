import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { ask } from '@tauri-apps/api/dialog'

function Sidebar({ entities, currentEntity, cursorPosition, onEntityChange, onEntitiesRefresh }) {
  const [entityState, setEntityState] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newCharacterName, setNewCharacterName] = useState('')
  const [newCharacterColor, setNewCharacterColor] = useState('#FFD700')
  const [editingEntity, setEditingEntity] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#FFD700')

  const commonColors = [
    '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DFE6E9', '#A29BFE', '#FF7675', '#74B9FF',
    '#55EFC4', '#FDCB6E', '#E17055', '#6C5CE7', '#00B894',
    '#FD79A8', '#A29BFE', '#00CEC9', '#FFBE76', '#FF6348'
  ]

  // Fetch entity state when entity or cursor position changes
  useEffect(() => {
    if (!currentEntity) return

    const fetchState = async () => {
      setLoading(true)
      try {
        const state = await invoke('get_entity_state', {
          entityId: currentEntity,
          position: cursorPosition,
        })
        setEntityState(state)
      } catch (error) {
        console.error('Failed to fetch entity state:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchState()
  }, [currentEntity, cursorPosition])

  const handleCreateCharacter = async () => {
    if (!newCharacterName.trim()) {
      alert('Please enter a character name')
      return
    }

    try {
      const newEntity = await invoke('create_entity', {
        name: newCharacterName.trim(),
        color: newCharacterColor
      })
      console.log('Created new character:', newEntity)

      setShowCreateDialog(false)
      setNewCharacterName('')
      setNewCharacterColor('#FFD700')

      // Refresh the entities list
      if (onEntitiesRefresh) {
        await onEntitiesRefresh()
      }

      // Select the newly created character
      onEntityChange(newEntity.id)
    } catch (error) {
      console.error('Failed to create character:', error)
      alert('Failed to create character: ' + error)
    }
  }

  const handleStartEdit = (entity) => {
    setEditingEntity(entity.id)
    setEditName(entity.name)
    setEditColor(entity.color || '#FFD700')
  }

  const handleUpdateEntity = async () => {
    if (!editName.trim()) {
      alert('Please enter a character name')
      return
    }

    try {
      await invoke('update_entity', {
        entityId: editingEntity,
        name: editName.trim(),
        color: editColor
      })

      setEditingEntity(null)
      setEditName('')
      setEditColor('#FFD700')

      // Refresh the entities list
      if (onEntitiesRefresh) {
        await onEntitiesRefresh()
      }
    } catch (error) {
      console.error('Failed to update character:', error)
      alert('Failed to update character: ' + error)
    }
  }

  const handleDeleteEntity = async (entityId, entityName) => {
    const confirmed = await ask(
      `Delete character "${entityName}"?\n\nThis will also delete all their markers.`,
      {
        title: 'Delete Character',
        type: 'warning'
      }
    )

    if (!confirmed) {
      return
    }

    try {
      await invoke('delete_entity', { entityId })

      // If we're deleting the currently selected entity, select another one
      if (currentEntity === entityId) {
        const remainingEntities = entities.filter(e => e.id !== entityId)
        if (remainingEntities.length > 0) {
          onEntityChange(remainingEntities[0].id)
        } else {
          onEntityChange(null)
        }
      }

      // Refresh the entities list
      if (onEntitiesRefresh) {
        await onEntitiesRefresh()
      }
    } catch (error) {
      console.error('Failed to delete character:', error)
      alert('Failed to delete character: ' + error)
    }
  }

  const renderStateTree = (node, path = []) => {
    if (!node) return null

    return Object.entries(node).map(([key, value]) => {
      const currentPath = [...path, key]
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // It's a nested category
        return (
          <div key={currentPath.join('.')} className="state-category">
            <div className="category-name">▼ {key}</div>
            <div className="category-children">
              {renderStateTree(value, currentPath)}
            </div>
          </div>
        )
      } else {
        // It's a value
        return (
          <div key={currentPath.join('.')} className="state-value">
            <span className="value-key">{key}:</span>
            <span className="value-content">{String(value)}</span>
          </div>
        )
      }
    })
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Character State</h2>
        {editingEntity ? (
          <div className="edit-entity-form">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateEntity()
                if (e.key === 'Escape') {
                  setEditingEntity(null)
                  setEditName('')
                  setEditColor('#FFD700')
                }
              }}
              autoFocus
            />
            <div className="color-selector-inline">
              {commonColors.map(color => (
                <button
                  key={color}
                  className={`color-option-tiny ${editColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setEditColor(color)}
                  title={color}
                />
              ))}
            </div>
            <button onClick={handleUpdateEntity} className="btn-icon" title="Save">
              ✓
            </button>
            <button
              onClick={() => {
                setEditingEntity(null)
                setEditName('')
                setEditColor('#FFD700')
              }}
              className="btn-icon"
              title="Cancel"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <select
              value={currentEntity || ''}
              onChange={(e) => onEntityChange(e.target.value)}
              disabled={entities.length === 0}
            >
              {entities.length === 0 && (
                <option value="">No characters yet</option>
              )}
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
            {currentEntity && (
              <div className="entity-actions">
                <button
                  onClick={() => {
                    const entity = entities.find(e => e.id === currentEntity)
                    if (entity) handleStartEdit(entity)
                  }}
                  className="btn-icon"
                  title="Rename character"
                >
                  ✏️
                </button>
                <button
                  onClick={() => {
                    const entity = entities.find(e => e.id === currentEntity)
                    if (entity) handleDeleteEntity(entity.id, entity.name)
                  }}
                  className="btn-icon"
                  title="Delete character"
                >
                  🗑️
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="sidebar-position">
        Position: Character {cursorPosition}
      </div>

      <div className="sidebar-content">
        {loading && <div className="loading">Loading state...</div>}
        {!loading && entityState && (
          <div className="state-tree">
            {renderStateTree(entityState)}
          </div>
        )}
        {!loading && !entityState && currentEntity && (
          <div className="no-state">No state defined yet</div>
        )}
        {!currentEntity && (
          <div className="no-entity">
            Create a character to get started
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        {!showCreateDialog ? (
          <button onClick={() => setShowCreateDialog(true)}>
            Create New Character
          </button>
        ) : (
          <div className="create-character-dialog">
            <input
              type="text"
              placeholder="Character name"
              value={newCharacterName}
              onChange={(e) => setNewCharacterName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCharacter()
                if (e.key === 'Escape') {
                  setShowCreateDialog(false)
                  setNewCharacterName('')
                  setNewCharacterColor('#FFD700')
                }
              }}
              autoFocus
            />
            <div className="color-selector">
              <label>Color:</label>
              <div className="color-grid-small">
                {commonColors.map(color => (
                  <button
                    key={color}
                    className={`color-option-small ${newCharacterColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCharacterColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
            <div className="dialog-buttons">
              <button onClick={handleCreateCharacter} className="btn-primary">
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateDialog(false)
                  setNewCharacterName('')
                  setNewCharacterColor('#FFD700')
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Sidebar