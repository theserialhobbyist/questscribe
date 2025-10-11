import React from 'react'
import { open } from '@tauri-apps/api/shell'

function StatusBar({ wordCount, onPreviousChapter, onNextChapter, onPreviousMarker, onNextMarker, updateInfo, onIgnoreUpdate }) {
  const handleUpdateClick = () => {
    if (updateInfo) {
      open(updateInfo.url)
    }
  }

  return (
    <div className="status-bar">
      <div className="status-bar-section">
        <span className="word-count">Words: {wordCount.toLocaleString()}</span>
      </div>

      <div className="status-bar-section">
        <div className="nav-group">
          <span className="nav-label">Chapters:</span>
          <button
            className="nav-button"
            onClick={onPreviousChapter}
            title="Previous Chapter (Ctrl+Shift+Up)"
          >
            ◀
          </button>
          <button
            className="nav-button"
            onClick={onNextChapter}
            title="Next Chapter (Ctrl+Shift+Down)"
          >
            ▶
          </button>
        </div>

        <div className="nav-group">
          <span className="nav-label">Markers:</span>
          <button
            className="nav-button"
            onClick={onPreviousMarker}
            title="Previous Marker (Ctrl+Alt+Up)"
          >
            ◀
          </button>
          <button
            className="nav-button"
            onClick={onNextMarker}
            title="Next Marker (Ctrl+Alt+Down)"
          >
            ▶
          </button>
        </div>
      </div>

      {updateInfo && (
        <div className="status-bar-section update-notification">
          <button
            className="update-button"
            onClick={handleUpdateClick}
            title={`Update available: ${updateInfo.version}`}
          >
            🔄 Update
          </button>
          <button
            className="ignore-update-button"
            onClick={onIgnoreUpdate}
            title="Ignore this update"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default StatusBar
