// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod state;

use state::{Entity, Marker, FieldChange, MarkerVisual, AppState};
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

    // Verify entity exists
    if !entities.contains_key(&entity_id) {
        return Err("Entity not found".to_string());
    }

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
            let value = if change.change_type == "absolute" {
                // Try to parse as number, otherwise treat as string
                if let Ok(num) = change.value.parse::<f64>() {
                    serde_json::json!(num)
                } else if change.value == "true" || change.value == "false" {
                    serde_json::json!(change.value.parse::<bool>().unwrap())
                } else {
                    serde_json::json!(change.value)
                }
            } else {
                // Relative change - add to existing value
                if let Ok(delta) = change.value.parse::<f64>() {
                    let current_val = current_state
                        .get(&change.field_name)
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0);
                    serde_json::json!(current_val + delta)
                } else {
                    serde_json::json!(change.value)
                }
            };
            current_state.insert(change.field_name.clone(), value);
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

// Tauri command to insert a marker
#[tauri::command]
fn insert_marker(
    position: usize,
    entity_id: String,
    changes: Vec<FieldChange>,
    visual: MarkerVisual,
    state: tauri::State<AppState>,
) -> Result<Marker, String> {
    let mut markers = state.markers.lock().unwrap();

    let marker = Marker {
        id: uuid::Uuid::new_v4().to_string(),
        position,
        entity_id,
        changes,
        visual,
    };

    markers.insert(marker.id.clone(), marker.clone());

    Ok(marker)
}

// Tauri command to get all markers
#[tauri::command]
fn get_all_markers(state: tauri::State<AppState>) -> Vec<Marker> {
    let markers = state.markers.lock().unwrap();
    markers.values().cloned().collect()
}

// Tauri command to get markers at a specific position
#[tauri::command]
fn get_markers_at_position(
    position: usize,
    state: tauri::State<AppState>,
) -> Vec<Marker> {
    let markers = state.markers.lock().unwrap();
    markers
        .values()
        .filter(|m| m.position == position)
        .cloned()
        .collect()
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
            insert_marker,
            get_all_markers,
            get_markers_at_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}