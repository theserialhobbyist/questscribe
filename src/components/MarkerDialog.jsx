import React, { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'

function MarkerDialog({ isOpen, onClose, entities, cursorPosition, onMarkerInserted }) {
  const [selectedEntity, setSelectedEntity] = useState(entities[0]?.id || '')
  const [fields, setFields] = useState([])
  const [markerIcon, setMarkerIcon] = useState('⭐')
  const [markerColor, setMarkerColor] = useState('#FFD700')

  // Update selected entity when entities change or dialog opens
  useEffect(() => {
    if (isOpen && entities.length > 0) {
      setSelectedEntity(entities[0].id)
    }
  }, [isOpen, entities])

  if (!isOpen) return null

  const handleAddField = () => {
    setFields([
      ...fields,
      { fieldName: '', changeType: 'absolute', value: '' }
    ])
  }

  const handleRemoveField = (index) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const handleFieldChange = (index, key, value) => {
    const newFields = [...fields]
    newFields[index][key] = value
    setFields(newFields)
  }

  const handleInsert = async () => {
    try {
      // Convert field names to match Rust naming (camelCase to snake_case)
      const changes = fields.map(field => ({
        field_name: field.fieldName,
        change_type: field.changeType,
        value: field.value
      }))

      const marker = await invoke('insert_marker', {
        position: cursorPosition,
        entityId: selectedEntity,
        changes: changes,
        visual: {
          icon: markerIcon,
          color: markerColor
        }
      })

      console.log('Marker inserted:', marker)

      // Notify parent to add marker to editor
      if (onMarkerInserted) {
        onMarkerInserted(marker)
      }

      // Reset form
      setFields([])
      setMarkerIcon('⭐')
      setMarkerColor('#FFD700')

      onClose()
    } catch (error) {
      console.error('Failed to insert marker:', error)
      alert('Failed to insert marker: ' + error)
    }
  }

  const commonIcons = ['⭐', '⬆️', '✨', '🎯', '💎', '⚔️', '🛡️', '📈', '🔥', '💪']
  const commonColors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#A29BFE']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Insert State Change Marker</h2>
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
          <div className="form-group">
            <label>Position in Text</label>
            <input type="text" value={cursorPosition} disabled />
          </div>

          {/* Field Editor */}
          <div className="form-group">
            <label>State Changes</label>
            <div className="fields-list">
              {fields.map((field, index) => (
                <div key={index} className="field-row">
                  <input
                    type="text"
                    placeholder="Field name (e.g. Level, HP)"
                    value={field.fieldName}
                    onChange={e => handleFieldChange(index, 'fieldName', e.target.value)}
                  />
                  <select
                    value={field.changeType}
                    onChange={e => handleFieldChange(index, 'changeType', e.target.value)}
                  >
                    <option value="absolute">Set to</option>
                    <option value="relative">Add/Subtract</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Value"
                    value={field.value}
                    onChange={e => handleFieldChange(index, 'value', e.target.value)}
                  />
                  <button
                    className="btn-remove"
                    onClick={() => handleRemoveField(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-add-field" onClick={handleAddField}>
              + Add Field
            </button>
          </div>

          {/* Visual Customization */}
          <div className="form-group">
            <label>Marker Appearance</label>
            <div className="marker-preview">
              <span style={{ color: markerColor, fontSize: '24px' }}>
                {markerIcon}
              </span>
            </div>

            <div className="icon-picker">
              <label className="sub-label">Icon</label>
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
              <input
                type="text"
                placeholder="Or enter custom emoji"
                value={markerIcon}
                onChange={e => setMarkerIcon(e.target.value)}
                className="custom-icon-input"
              />
            </div>

            <div className="color-picker">
              <label className="sub-label">Color</label>
              <div className="color-grid">
                {commonColors.map(color => (
                  <button
                    key={color}
                    className={`color-option ${markerColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setMarkerColor(color)}
                  />
                ))}
              </div>
              <input
                type="color"
                value={markerColor}
                onChange={e => setMarkerColor(e.target.value)}
                className="custom-color-input"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleInsert}
            disabled={!selectedEntity || fields.length === 0}
          >
            Insert Marker
          </button>
        </div>
      </div>
    </div>
  )
}

export default MarkerDialog
