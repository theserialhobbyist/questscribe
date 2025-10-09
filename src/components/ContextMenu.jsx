import React, { useEffect } from 'react'

function ContextMenu({ x, y, items, onClose }) {
  useEffect(() => {
    const handleClick = () => onClose()
    const handleContextMenu = (e) => {
      e.preventDefault()
      onClose()
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [onClose])

  if (!items || items.length === 0) return null

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={index} className="context-menu-divider" />
        }
        return (
          <div
            key={index}
            className={`context-menu-item ${item.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (!item.disabled && item.action) {
                item.action()
                onClose()
              }
            }}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span className="context-menu-label">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default ContextMenu
