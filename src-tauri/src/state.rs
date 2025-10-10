//! QuestScribe - Core State Management
//!
//! This module defines the core data structures used throughout the application
//! for tracking entities (characters), markers (state changes), and documents.
//!
//! # Key Concepts
//!
//! - **Entity**: A character or object being tracked (e.g., "Hero", "Villain")
//! - **Marker**: A point in the text where state changes occur (e.g., level up, item gained)
//! - **FieldChange**: A single state modification (e.g., HP +10, Level = 5)
//! - **Document**: The complete saved state including text content, entities, and markers

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

/// Represents a character or object being tracked in the story
///
/// Entities have a unique ID, name, color for visual identification,
/// and a list of fields that track their state (e.g., "stats.HP", "Level")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub fields: Vec<String>, // List of field paths (e.g., "stats.HP", "spells.fire.Firebolt")
    #[serde(default = "default_entity_color")]
    pub color: String, // Hex color for this entity's markers
    #[serde(default)]
    pub field_metadata: HashMap<String, FieldMetadata>, // Track creation/modification times
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMetadata {
    pub created_at: i64,
    pub last_modified: i64,
}

fn default_entity_color() -> String {
    "#FFD700".to_string() // Gold as default
}

/// Represents a state change marker in the document
///
/// Markers are placed at specific positions in the text and contain
/// one or more field changes for a particular entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Marker {
    pub id: String,
    pub position: usize, // Character position in the document
    pub entity_id: String,
    pub changes: Vec<FieldChange>,
    pub visual: MarkerVisual,
    #[serde(default)]
    pub description: String, // Optional description (e.g., "Leveled up after boss fight")
    #[serde(default = "default_timestamp")]
    pub created_at: i64,
    #[serde(default = "default_timestamp")]
    pub modified_at: i64,
}

fn default_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldChange {
    pub field_name: String,
    pub change_type: ChangeType,
    pub value: String,
}

/// Types of state changes that can be applied
///
/// - **Absolute**: Set field to exact value (e.g., "Level = 5")
/// - **Relative**: Add/subtract from current value (e.g., "HP +10")
/// - **Remove**: Delete field from state entirely
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChangeType {
    Absolute,
    Relative,
    Remove,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkerVisual {
    pub icon: String,  // Emoji string like "⭐"
    pub color: String, // Hex color like "#FFD700"
}

// Document structure for saving/loading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub content: String,  // The text content
    pub entities: Vec<Entity>,
    pub markers: Vec<Marker>,
}

// Application state
pub struct AppState {
    pub entities: Mutex<HashMap<String, Entity>>,
    pub markers: Mutex<HashMap<String, Marker>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            entities: Mutex::new(HashMap::new()),
            markers: Mutex::new(HashMap::new()),
        }
    }
}