import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'

function Sidebar({ entities, currentEntity, cursorPosition, onEntityChange, onEntitiesRefresh }) {
  const [entityState, setEntityState] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newCharacterName, setNewCharacterName] = useState('')

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
      const newEntity = await invoke('create_entity', { name: newCharacterName.trim() })
      console.log('Created new character:', newEntity)
      
      setShowCreateDialog(false)
      setNewCharacterName('')
      
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
                }
              }}
              autoFocus
            />
            <div className="dialog-buttons">
              <button onClick={handleCreateCharacter} className="btn-primary">
                Create
              </button>
              <button 
                onClick={() => {
                  setShowCreateDialog(false)
                  setNewCharacterName('')
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