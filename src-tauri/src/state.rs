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
    pub field_path: Vec<String>,
    #[serde(flatten)]
    pub change_type: ChangeType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum ChangeType {
    Absolute(StateValue),
    Relative(i64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum StateValue {
    Number(f64),
    Text(String),
    Boolean(bool),
}

impl StateValue {
    pub fn as_number(&self) -> Option<f64> {
        match self {
            StateValue::Number(n) => Some(*n),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkerVisual {
    pub icon: MarkerIcon,
    pub color: MarkerColor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MarkerIcon {
    LevelUp,
    Star,
    Sword,
    Book,
    Shield,
    Gem,
    Scroll,
    Crown,
    Potion,
    Lightning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MarkerColor {
    Red,
    Blue,
    Green,
    Yellow,
    Purple,
    Orange,
    Pink,
    Teal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextAnchor {
    pub position: usize,
    pub before_context: String,
    pub after_context: String,
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