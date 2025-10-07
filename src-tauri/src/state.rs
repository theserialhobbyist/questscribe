use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Marker {
    pub id: String,
    pub position: usize,
    pub entity_id: String,
    pub changes: Vec<FieldChange>,
    pub visual: MarkerVisual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldChange {
    pub field_name: String,
    pub change_type: String, // "absolute" or "relative"
    pub value: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkerVisual {
    pub icon: String,  // Emoji string like "⭐"
    pub color: String, // Hex color like "#FFD700"
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