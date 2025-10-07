// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod state;

use state::{Entity, AppState};
use std::collections::HashMap;

// Tauri command to get all entities
#[tauri::command]
fn get_all_entities(state: tauri::State<AppState>) -> Vec<Entity> {
    let entities = state.entities.lock().unwrap();
    entities.values().cloned().collect()
}

// Tauri command to get entity state at a position
#[tauri::command]
fn get_entity_state(
    entity_id: String,
    position: usize,
    state: tauri::State<AppState>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let entities = state.entities.lock().unwrap();
    let markers = state.markers.lock().unwrap();

    // Find the entity
    let entity = entities
        .get(&entity_id)
        .ok_or_else(|| "Entity not found".to_string())?;

    // Get all markers for this entity before the position
    let mut relevant_markers: Vec<_> = markers
        .values()
        .filter(|m| m.entity_id == entity_id && m.position <= position)
        .collect();

    // Sort by position
    relevant_markers.sort_by_key(|m| m.position);

    // Start with empty state
    let mut current_state: HashMap<String, serde_json::Value> = HashMap::new();

    // Apply each marker's changes
    for marker in relevant_markers {
        for change in &marker.changes {
            // For now, just set the values directly
            // TODO: Implement proper tree merging and relative changes
            let value = match &change.change_type {
                state::ChangeType::Absolute(val) => {
                    match val {
                        state::StateValue::Number(n) => serde_json::json!(n),
                        state::StateValue::Text(s) => serde_json::json!(s),
                        state::StateValue::Boolean(b) => serde_json::json!(b),
                    }
                }
                state::ChangeType::Relative(delta) => {
                    // For now, just store the delta as a number
                    // TODO: Implement proper relative value computation
                    serde_json::json!(delta)
                }
            };
            current_state.insert(change.field_path.join("."), value);
        }
    }

    Ok(current_state)
}

// Tauri command to create a new entity
#[tauri::command]
fn create_entity(
    name: String,
    state: tauri::State<AppState>,
) -> Result<Entity, String> {
    let mut entities = state.entities.lock().unwrap();
    
    let entity = Entity {
        id: uuid::Uuid::new_v4().to_string(),
        name,
    };
    
    entities.insert(entity.id.clone(), entity.clone());
    
    Ok(entity)
}

fn main() {
    // Initialize app state
    let app_state = AppState::new();
    
    // Add a reference character for demonstration
    let reference_entity = Entity {
        id: "reference".to_string(),
        name: "Example Hero (Reference)".to_string(),
    };
    
    app_state.entities.lock().unwrap().insert(
        reference_entity.id.clone(),
        reference_entity,
    );

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_all_entities,
            get_entity_state,
            create_entity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}