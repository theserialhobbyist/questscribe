use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub fields: Vec<String>, // List of field paths (e.g., "stats.HP", "spells.fire.Firebolt")
    #[serde(default = "default_entity_color")]
    pub color: String, // Hex color for this entity's markers
}

fn default_entity_color() -> String {
    "#FFD700".to_string() // Gold as default
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Marker {
    pub id: String,
    pub position: usize,
    pub entity_id: String,
    pub changes: Vec<FieldChange>,
    pub visual: MarkerVisual,
    #[serde(default)]
    pub description: String,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChangeType {
    Absolute,
    Relative,
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