import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'

function MarkerDialog({ isOpen, onClose, entities, cursorPosition, onMarkerInserted, editingMarker }) {
  const [selectedEntity, setSelectedEntity] = useState(entities[0]?.id || '')
  const [fields, setFields] = useState([])
  const [markerIcon, setMarkerIcon] = useState('✨')
  const [description, setDescription] = useState('')
  const isEditing = !!editingMarker

  // Update form when editing marker or dialog opens
  useEffect(() => {
    if (isOpen) {
      if (editingMarker) {
        // Load marker data for editing
        setSelectedEntity(editingMarker.entity_id)

        // Check which fields are in the entity's known fields list
        const entity = entities.find(e => e.id === editingMarker.entity_id)
        const knownFields = entity?.fields || []

        setFields(editingMarker.changes.map(c => ({
          fieldName: c.field_name,
          changeType: typeof c.change_type === 'string'
            ? c.change_type
            : c.change_type.toLowerCase?.() || 'absolute',
          value: c.value,
          isCustom: false // Fields from existing markers are now known fields
        })))
        setMarkerIcon(editingMarker.visual.icon)
        setDescription(editingMarker.description || '')
      } else {
        // Reset for new marker
        setSelectedEntity(entities[0]?.id || '')
        setFields([])
        setMarkerIcon('✨')
        setDescription('')
      }
    }
  }, [isOpen, editingMarker, entities])

  if (!isOpen) return null

  const handleAddField = () => {
    setFields([
      ...fields,
      { fieldName: '', changeType: 'relative', value: '', isCustom: false }
    ])
  }

  const handleAddCustomField = () => {
    setFields([
      ...fields,
      { fieldName: '', changeType: 'relative', value: '', isCustom: true }
    ])
  }

  const handleRemoveField = (index) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  // Build a tree structure from flat field paths
  const buildFieldTree = (fieldPaths) => {
    const tree = {}

    for (const path of fieldPaths) {
      const parts = path.split('.')
      let current = tree

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isLast = i === parts.length - 1

        if (isLast) {
          // It's a field
          if (!current._fields) current._fields = []
          current._fields.push(path)
        } else {
          // It's a category
          if (!current[part]) current[part] = {}
          current = current[part]
        }
      }
    }

    return tree
  }

  // Render field tree as nested optgroups
  const renderFieldOptions = (tree, prefix = '') => {
    const options = []

    // Add categories
    for (const [key, value] of Object.entries(tree)) {
      if (key === '_fields') continue

      const categoryPath = prefix ? `${prefix}.${key}` : key
      options.push(
        <optgroup key={categoryPath} label={`📁 ${key}`}>
          {renderFieldOptions(value, categoryPath)}
        </optgroup>
      )
    }

    // Add fields at this level
    if (tree._fields) {
      for (const fieldPath of tree._fields) {
        const fieldName = fieldPath.split('.').pop()
        options.push(
          <option key={fieldPath} value={fieldPath}>
            {fieldName}
          </option>
        )
      }
    }

    return options
  }

  const handleFieldChange = (index, key, value) => {
    const newFields = [...fields]
    newFields[index][key] = value
    setFields(newFields)
  }

  const handleInsert = async () => {
    try {
      // Get the entity's color
      const entity = entities.find(e => e.id === selectedEntity)
      const entityColor = entity?.color || '#FFD700'

      // Convert field names to match Rust naming (camelCase to snake_case)
      const changes = fields.map(field => ({
        field_name: field.fieldName,
        change_type: field.changeType,
        value: field.value
      }))

      let marker
      if (isEditing) {
        // Update existing marker
        marker = await invoke('update_marker', {
          markerId: editingMarker.id,
          entityId: selectedEntity !== editingMarker.entity_id ? selectedEntity : null,
          changes: changes,
          visual: {
            icon: markerIcon,
            color: entityColor
          },
          description: description
        })
      } else {
        // Insert new marker
        marker = await invoke('insert_marker', {
          position: cursorPosition,
          entityId: selectedEntity,
          changes: changes,
          visual: {
            icon: markerIcon,
            color: entityColor
          },
          description: description || null
        })
      }

      // Notify parent to add/update marker in editor
      if (onMarkerInserted) {
        onMarkerInserted(marker, isEditing)
      }

      onClose()
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'insert'} marker:`, error)
      alert(`Failed to ${isEditing ? 'update' : 'insert'} marker: ` + error)
    }
  }

  const handleDelete = async () => {
    if (!isEditing) return

    if (confirm('Are you sure you want to delete this marker?')) {
      try {
        await invoke('delete_marker', { markerId: editingMarker.id })

        // Notify parent to remove marker from editor
        if (onMarkerInserted) {
          onMarkerInserted(editingMarker, isEditing, true) // true = deleted
        }

        onClose()
      } catch (error) {
        console.error('Failed to delete marker:', error)
        alert('Failed to delete marker: ' + error)
      }
    }
  }

  const commonIcons = ['✨', '⬆️', '⬇️', '💗', '🛡️', '⚔️', '🪄', '🎲', '🍗', '💰']

  // Get current entity color for preview
  const currentEntity = entities.find(e => e.id === selectedEntity)
  const markerColor = currentEntity?.color || '#FFD700'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit' : 'Insert'} State Change Marker</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Entity Selector */}
          <div className="form-group">
            <label>Character/Entity</label>
            <select
              value={selectedEntity}
              onChange={e => setSelectedEntity(e.target.value)}
            >
              {entities.map(entity => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </div>

          {/* Position Display */}
          {!isEditing && (
            <div className="form-group">
              <label>Position in Text</label>
              <input type="text" value={cursorPosition} disabled />
            </div>
          )}

          {/* Description Field */}
          <div className="form-group">
            <label>Description (optional)</label>
            <input
              type="text"
              placeholder="e.g., 'Leveled up after boss fight'"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Field Editor */}
          <div className="form-group">
            <label>State Changes</label>
            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 12px 0' }}>
              Select an existing field or create a new one. You can nest fields under a category like this: Stats.Strength or Inventory.Weapons.HammerOfSmighting
            </p>
            <div className="fields-list">
              {fields.map((field, index) => {
                const currentEntity = entities.find(e => e.id === selectedEntity)
                const availableFields = currentEntity?.fields || []
                const fieldTree = buildFieldTree(availableFields)

                return (
                  <div key={index} className="field-row">
                    {field.isCustom || availableFields.length === 0 ? (
                      <input
                        type="text"
                        placeholder="Field path"
                        value={field.fieldName}
                        onChange={e => handleFieldChange(index, 'fieldName', e.target.value)}
                        style={{ flex: '1.5' }}
                      />
                    ) : (
                      <select
                        value={field.fieldName}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            handleFieldChange(index, 'isCustom', true)
                            handleFieldChange(index, 'fieldName', '')
                          } else {
                            handleFieldChange(index, 'fieldName', e.target.value)
                          }
                        }}
                        style={{ flex: '1.5' }}
                      >
                        <option value="">Select field...</option>
                        {renderFieldOptions(fieldTree)}
                        <option value="__custom__">+ New field...</option>
                      </select>
                    )}
                    <select
                      value={field.changeType}
                      onChange={e => handleFieldChange(index, 'changeType', e.target.value)}
                      style={{ flex: '1' }}
                    >
                      <option value="absolute">Set to</option>
                      <option value="relative">Add/Subtract</option>
                      <option value="remove">Remove</option>
                    </select>
                    {field.changeType !== 'remove' && (
                      <input
                        type="text"
                        placeholder="Value"
                        value={field.value}
                        onChange={e => handleFieldChange(index, 'value', e.target.value)}
                        style={{ flex: '1' }}
                      />
                    )}
                    <button
                      className="btn-remove"
                      onClick={() => handleRemoveField(index)}
                      title="Remove from list"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-add-field" onClick={handleAddField}>
                + Add Field
              </button>
            </div>
          </div>

          {/* Icon Selection */}
          <div className="form-group">
            <label>Icon</label>
            <div className="icon-grid">
              {commonIcons.map(icon => (
                <button
                  key={icon}
                  className={`icon-option ${markerIcon === icon ? 'selected' : ''}`}
                  onClick={() => setMarkerIcon(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '13px', color: '#666', margin: '12px 0 6px 0' }}>
              or enter your own unicode emoji:
            </p>
            <input
              type="text"
              placeholder="emoji"
              value={markerIcon}
              onChange={e => setMarkerIcon(e.target.value)}
              className="custom-icon-input"
              style={{ width: '60px', textAlign: 'center' }}
            />
          </div>
        </div>

        <div className="modal-footer">
          {isEditing && (
            <button className="btn-danger" onClick={handleDelete} style={{ marginRight: 'auto' }}>
              Delete Marker
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleInsert}
            disabled={!selectedEntity || fields.length === 0}
          >
            {isEditing ? 'Update' : 'Insert'} Marker
          </button>
        </div>
      </div>
    </div>
  )
}

export default MarkerDialog
