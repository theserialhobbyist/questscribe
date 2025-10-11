//! QuestScribe - Tauri Backend
//!
//! This is the Rust backend for QuestScribe, providing:
//! - State computation engine for character progression tracking
//! - Document serialization/deserialization (save/load)
//! - Export functionality (TXT, RTF, DOCX)
//! - Entity and marker management
//!
//! All Tauri commands are exposed to the frontend JavaScript via the invoke API.

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod state;

use serde::Serialize;
use state::{Entity, Marker, FieldChange, MarkerVisual, Document, AppState, ChangeType};
use std::fs;
use std::path::PathBuf;
use std::io::Cursor;
use docx_rs::*;

// Helper function to set a nested value in a JSON object using a path like "stats.HP"
fn set_nested_value(
    state: &mut serde_json::Map<String, serde_json::Value>,
    path: &str,
    value: serde_json::Value,
) {
    let parts: Vec<&str> = path.split('.').collect();

    if parts.len() == 1 {
        // Simple field, no nesting
        state.insert(path.to_string(), value);
        return;
    }

    // Build the path recursively
    fn insert_at_path(
        obj: &mut serde_json::Map<String, serde_json::Value>,
        parts: &[&str],
        value: serde_json::Value,
    ) {
        if parts.len() == 1 {
            obj.insert(parts[0].to_string(), value);
        } else {
            let entry = obj
                .entry(parts[0].to_string())
                .or_insert_with(|| serde_json::json!({}));

            if let Some(nested_obj) = entry.as_object_mut() {
                insert_at_path(nested_obj, &parts[1..], value);
            }
        }
    }

    insert_at_path(state, &parts, value);
}

// Helper function to get a nested value from a JSON object using a path
fn get_nested_value<'a>(
    state: &'a serde_json::Map<String, serde_json::Value>,
    path: &str,
) -> Option<&'a serde_json::Value> {
    let parts: Vec<&str> = path.split('.').collect();

    if parts.len() == 1 {
        return state.get(path);
    }

    let mut current = state;
    for (i, part) in parts.iter().enumerate() {
        if i == parts.len() - 1 {
            return current.get(*part);
        } else {
            current = current.get(*part)?.as_object()?;
        }
    }

    None
}

// Helper function to remove a nested value from a JSON object using a path
fn remove_nested_value(
    state: &mut serde_json::Map<String, serde_json::Value>,
    path: &str,
) {
    let parts: Vec<&str> = path.split('.').collect();

    if parts.len() == 1 {
        // Simple field, remove directly
        state.remove(path);
        return;
    }

    // Navigate to parent and remove the field
    fn remove_at_path(
        obj: &mut serde_json::Map<String, serde_json::Value>,
        parts: &[&str],
    ) {
        if parts.len() == 1 {
            obj.remove(parts[0]);
        } else if let Some(nested) = obj.get_mut(parts[0]) {
            if let Some(nested_obj) = nested.as_object_mut() {
                remove_at_path(nested_obj, &parts[1..]);
            }
        }
    }

    remove_at_path(state, &parts);
}

// Helper function to flatten a state object into field changes
fn flatten_state_to_changes(
    state: &serde_json::Map<String, serde_json::Value>,
    prefix: String,
    changes: &mut Vec<FieldChange>,
) {
    for (key, value) in state.iter() {
        let field_name = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{}.{}", prefix, key)
        };

        if let Some(obj) = value.as_object() {
            // Nested object - recurse
            flatten_state_to_changes(obj, field_name, changes);
        } else {
            // Leaf value - create a field change
            let value_str = match value {
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::String(s) => s.clone(),
                _ => value.to_string(),
            };

            changes.push(FieldChange {
                field_name,
                value: value_str,
                change_type: ChangeType::Absolute,
            });
        }
    }
}

// Tauri command to get all entities
#[tauri::command]
fn get_all_entities(state: tauri::State<AppState>) -> Vec<Entity> {
    let entities = state.entities.lock().unwrap();
    entities.values().cloned().collect()
}

// Helper function to format a state object as a character sheet string
fn format_state_as_sheet(state: &serde_json::Map<String, serde_json::Value>, indent: usize) -> String {
    let mut lines = Vec::new();
    let indent_str = "  ".repeat(indent);

    for (key, value) in state.iter() {
        if let Some(obj) = value.as_object() {
            // Nested category
            lines.push(format!("{}{}", indent_str, key));
            lines.push(format_state_as_sheet(obj, indent + 1));
        } else {
            // Value
            lines.push(format!("{}{}: {}", indent_str, key, value));
        }
    }

    lines.join("\n")
}

// Tauri command to get entity state formatted as a character sheet
#[tauri::command]
fn format_character_sheet(
    entity_id: String,
    position: usize,
    state: tauri::State<AppState>,
) -> Result<String, String> {
    let entities = state.entities.lock().unwrap();
    let markers = state.markers.lock().unwrap();

    // Get entity
    let entity = entities
        .get(&entity_id)
        .ok_or("Entity not found")?;

    // Get all markers for this entity up to the position
    let mut relevant_markers: Vec<&Marker> = markers
        .values()
        .filter(|m| m.entity_id == entity_id && m.position <= position)
        .collect();

    // Sort by position
    relevant_markers.sort_by_key(|m| m.position);

    // Start with empty state (use Map for nested structure support)
    let mut current_state = serde_json::Map::new();

    // Apply each marker's changes
    for marker in relevant_markers {
        for change in &marker.changes {
            match &change.change_type {
                ChangeType::Remove => {
                    remove_nested_value(&mut current_state, &change.field_name);
                }
                ChangeType::Absolute => {
                    let value = if let Ok(num) = change.value.parse::<f64>() {
                        serde_json::json!(num)
                    } else if change.value == "true" || change.value == "false" {
                        serde_json::json!(change.value.parse::<bool>().unwrap())
                    } else {
                        serde_json::json!(change.value)
                    };
                    set_nested_value(&mut current_state, &change.field_name, value);
                }
                ChangeType::Relative => {
                    let value = if let Ok(delta) = change.value.parse::<f64>() {
                        let current_val = get_nested_value(&current_state, &change.field_name)
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);
                        serde_json::json!(current_val + delta)
                    } else {
                        serde_json::json!(change.value)
                    };
                    set_nested_value(&mut current_state, &change.field_name, value);
                }
            }
        }
    }

    // Format as character sheet
    let mut sheet = format!("=== {} ===\n", entity.name);
    sheet.push_str(&format_state_as_sheet(&current_state, 0));

    Ok(sheet)
}

// Tauri command to get entity state at a position
#[tauri::command]
fn get_entity_state(
    entity_id: String,
    position: usize,
    state: tauri::State<AppState>,
) -> Result<serde_json::Value, String> {
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

    // Start with empty state (use Map for nested structure support)
    let mut current_state = serde_json::Map::new();

    // Apply each marker's changes
    for marker in relevant_markers {
        for change in &marker.changes {
            match &change.change_type {
                ChangeType::Remove => {
                    // Remove the field from the state
                    remove_nested_value(&mut current_state, &change.field_name);
                }
                ChangeType::Absolute => {
                    // Try to parse as number, otherwise treat as string
                    let value = if let Ok(num) = change.value.parse::<f64>() {
                        serde_json::json!(num)
                    } else if change.value == "true" || change.value == "false" {
                        serde_json::json!(change.value.parse::<bool>().unwrap())
                    } else {
                        serde_json::json!(change.value)
                    };
                    set_nested_value(&mut current_state, &change.field_name, value);
                }
                ChangeType::Relative => {
                    // Relative change - add to existing value
                    let value = if let Ok(delta) = change.value.parse::<f64>() {
                        let current_val = get_nested_value(&current_state, &change.field_name)
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);
                        serde_json::json!(current_val + delta)
                    } else {
                        serde_json::json!(change.value)
                    };
                    set_nested_value(&mut current_state, &change.field_name, value);
                }
            }
        }
    }

    Ok(serde_json::Value::Object(current_state))
}

// Tauri command to create a new entity
#[tauri::command]
fn create_entity(
    name: String,
    color: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Entity, String> {
    let mut entities = state.entities.lock().unwrap();

    let entity = Entity {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        fields: Vec::new(),
        color: color.unwrap_or_else(|| "#FFD700".to_string()),
        field_metadata: std::collections::HashMap::new(),
    };

    entities.insert(entity.id.clone(), entity.clone());

    Ok(entity)
}

// Tauri command to update an entity's name and/or color
#[tauri::command]
fn update_entity(
    entity_id: String,
    name: Option<String>,
    color: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Entity, String> {
    let mut entities = state.entities.lock().unwrap();
    let mut markers = state.markers.lock().unwrap();

    let entity = entities
        .get_mut(&entity_id)
        .ok_or("Entity not found")?;

    if let Some(n) = name {
        entity.name = n;
    }
    if let Some(new_color) = color {
        entity.color = new_color.clone();

        // Update all markers for this entity to use the new color
        for marker in markers.values_mut() {
            if marker.entity_id == entity_id {
                marker.visual.color = new_color.clone();
            }
        }
    }

    Ok(entity.clone())
}

// Tauri command to delete an entity
#[tauri::command]
fn delete_entity(
    entity_id: String,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut entities = state.entities.lock().unwrap();
    let mut markers = state.markers.lock().unwrap();

    // Check if entity exists
    if !entities.contains_key(&entity_id) {
        return Err("Entity not found".to_string());
    }

    // Delete all markers associated with this entity
    markers.retain(|_, marker| marker.entity_id != entity_id);

    // Delete the entity
    entities.remove(&entity_id);

    Ok(())
}

// Return type for duplicate_entity command
#[derive(Serialize)]
struct DuplicateEntityResult {
    entity: Entity,
    marker: Option<Marker>,
}

// Tauri command to duplicate an entity
// Creates a copy with a new ID and name, preserving fields and metadata
#[tauri::command]
fn duplicate_entity(
    entity_id: String,
    new_name: String,
    cursor_position: usize,
    state: tauri::State<AppState>,
) -> Result<DuplicateEntityResult, String> {
    let mut entities = state.entities.lock().unwrap();
    let mut markers = state.markers.lock().unwrap();

    // Get the source entity
    let source_entity = entities
        .get(&entity_id)
        .ok_or("Entity not found")?
        .clone();

    // Create a new entity with copied fields and metadata
    let new_entity = Entity {
        id: uuid::Uuid::new_v4().to_string(),
        name: new_name,
        fields: source_entity.fields.clone(),
        color: source_entity.color.clone(),
        field_metadata: source_entity.field_metadata.clone(),
    };

    let new_entity_id = new_entity.id.clone();
    entities.insert(new_entity_id.clone(), new_entity.clone());

    // Get the current state of the source entity at cursor position
    let relevant_markers: Vec<_> = markers
        .values()
        .filter(|m| m.entity_id == entity_id && m.position <= cursor_position)
        .collect();

    if !relevant_markers.is_empty() {
        // Compute the current state by applying all markers
        let mut current_state = serde_json::Map::new();
        let mut sorted_markers = relevant_markers.clone();
        sorted_markers.sort_by_key(|m| m.position);

        for marker in sorted_markers {
            for change in &marker.changes {
                match &change.change_type {
                    ChangeType::Remove => {
                        remove_nested_value(&mut current_state, &change.field_name);
                    }
                    ChangeType::Absolute => {
                        let value = if let Ok(num) = change.value.parse::<f64>() {
                            serde_json::json!(num)
                        } else if change.value == "true" || change.value == "false" {
                            serde_json::json!(change.value.parse::<bool>().unwrap())
                        } else {
                            serde_json::json!(change.value)
                        };
                        set_nested_value(&mut current_state, &change.field_name, value);
                    }
                    ChangeType::Relative => {
                        let value = if let Ok(delta) = change.value.parse::<f64>() {
                            let current_val = get_nested_value(&current_state, &change.field_name)
                                .and_then(|v| v.as_f64())
                                .unwrap_or(0.0);
                            serde_json::json!(current_val + delta)
                        } else {
                            serde_json::json!(change.value)
                        };
                        set_nested_value(&mut current_state, &change.field_name, value);
                    }
                }
            }
        }

        // Convert the computed state into field changes (all absolute values)
        let mut changes = Vec::new();
        flatten_state_to_changes(&current_state, String::new(), &mut changes);

        // Create an initial marker for the new entity at cursor position
        if !changes.is_empty() {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64;

            let marker = Marker {
                id: uuid::Uuid::new_v4().to_string(),
                position: cursor_position,
                entity_id: new_entity_id.clone(),
                changes,
                visual: MarkerVisual {
                    icon: "📋".to_string(),
                    color: source_entity.color.clone(),
                },
                description: format!("Duplicated from {}", source_entity.name),
                created_at: now,
                modified_at: now,
            };

            let marker_clone = marker.clone();
            markers.insert(marker.id.clone(), marker);

            return Ok(DuplicateEntityResult {
                entity: new_entity,
                marker: Some(marker_clone),
            });
        }
    }

    Ok(DuplicateEntityResult {
        entity: new_entity,
        marker: None,
    })
}

// Tauri command to completely delete a field from an entity and all its markers
// This removes the field from ALL markers (including remove markers) and the entity's field list
#[tauri::command]
fn delete_field_completely(
    entity_id: String,
    field_name: String,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut entities = state.entities.lock().unwrap();
    let mut markers = state.markers.lock().unwrap();

    // Check if entity exists
    let entity = entities
        .get_mut(&entity_id)
        .ok_or("Entity not found")?;

    // Remove field from entity's fields list
    entity.fields.retain(|f| f != &field_name);

    // Remove ALL changes for this field from all markers belonging to this entity
    // This includes absolute, relative, AND remove markers
    for marker in markers.values_mut() {
        if marker.entity_id == entity_id {
            marker.changes.retain(|change| change.field_name != field_name);
        }
    }

    Ok(())
}

// Tauri command to insert a marker
#[tauri::command]
fn insert_marker(
    position: usize,
    entity_id: String,
    changes: Vec<FieldChange>,
    visual: MarkerVisual,
    description: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Marker, String> {
    let mut markers = state.markers.lock().unwrap();
    let mut entities = state.entities.lock().unwrap();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let marker = Marker {
        id: uuid::Uuid::new_v4().to_string(),
        position,
        entity_id: entity_id.clone(),
        changes: changes.clone(),
        visual,
        description: description.unwrap_or_default(),
        created_at: now,
        modified_at: now,
    };

    markers.insert(marker.id.clone(), marker.clone());

    // Update entity's field list and metadata with any new fields from this marker
    if let Some(entity) = entities.get_mut(&entity_id) {
        for change in &changes {
            // Add to fields list if not present
            if !entity.fields.contains(&change.field_name) {
                entity.fields.push(change.field_name.clone());
            }

            // Update metadata - create if new, or update last_modified if existing
            entity.field_metadata.entry(change.field_name.clone())
                .and_modify(|meta| meta.last_modified = now)
                .or_insert(state::FieldMetadata {
                    created_at: now,
                    last_modified: now,
                });
        }
    }

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

// Tauri command to update an existing marker
#[tauri::command]
fn update_marker(
    marker_id: String,
    position: Option<usize>,
    entity_id: Option<String>,
    changes: Option<Vec<FieldChange>>,
    visual: Option<MarkerVisual>,
    description: Option<String>,
    state: tauri::State<AppState>,
) -> Result<Marker, String> {
    let mut markers = state.markers.lock().unwrap();
    let mut entities = state.entities.lock().unwrap();

    let marker = markers
        .get_mut(&marker_id)
        .ok_or("Marker not found")?;

    // Update fields if provided
    if let Some(pos) = position {
        marker.position = pos;
    }
    if let Some(ent_id) = entity_id {
        marker.entity_id = ent_id;
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    if let Some(chgs) = &changes {
        marker.changes = chgs.clone();

        // Update entity's field list and metadata with any new fields
        if let Some(entity) = entities.get_mut(&marker.entity_id) {
            for change in chgs {
                // Add to fields list if not present
                if !entity.fields.contains(&change.field_name) {
                    entity.fields.push(change.field_name.clone());
                }

                // Update metadata
                entity.field_metadata.entry(change.field_name.clone())
                    .and_modify(|meta| meta.last_modified = now)
                    .or_insert(state::FieldMetadata {
                        created_at: now,
                        last_modified: now,
                    });
            }
        }
    }
    if let Some(vis) = visual {
        marker.visual = vis;
    }
    if let Some(desc) = description {
        marker.description = desc;
    }

    // Update modified timestamp
    marker.modified_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    Ok(marker.clone())
}

// Tauri command to delete a marker
#[tauri::command]
fn delete_marker(
    marker_id: String,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut markers = state.markers.lock().unwrap();

    markers
        .remove(&marker_id)
        .ok_or("Marker not found")?;

    Ok(())
}

// Tauri command to update marker positions (for text changes)
#[tauri::command]
fn update_marker_positions(
    position_updates: Vec<(String, usize)>, // (marker_id, new_position)
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut markers = state.markers.lock().unwrap();

    for (marker_id, new_position) in position_updates {
        if let Some(marker) = markers.get_mut(&marker_id) {
            marker.position = new_position;
        }
    }

    Ok(())
}

// Tauri command to save document
#[tauri::command]
fn save_document(
    file_path: String,
    content: String,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let entities = state.entities.lock().unwrap();
    let markers = state.markers.lock().unwrap();

    let document = Document {
        content,
        entities: entities.values().cloned().collect(),
        markers: markers.values().cloned().collect(),
    };

    let json = serde_json::to_string_pretty(&document)
        .map_err(|e| format!("Failed to serialize document: {}", e))?;

    fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

// Tauri command to load document
#[tauri::command]
fn load_document(
    file_path: String,
    state: tauri::State<AppState>,
) -> Result<Document, String> {
    let json = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let document: Document = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse document: {}", e))?;

    // Clear and load entities
    let mut entities = state.entities.lock().unwrap();
    entities.clear();
    for entity in &document.entities {
        entities.insert(entity.id.clone(), entity.clone());
    }

    // Clear and load markers
    let mut markers = state.markers.lock().unwrap();
    markers.clear();
    for marker in &document.markers {
        markers.insert(marker.id.clone(), marker.clone());
    }

    Ok(document)
}

// Tauri command to create new document (clear everything)
#[tauri::command]
fn new_document(state: tauri::State<AppState>) -> Result<(), String> {
    let mut entities = state.entities.lock().unwrap();
    let mut markers = state.markers.lock().unwrap();

    entities.clear();
    markers.clear();

    Ok(())
}

// Represents a text run with formatting
#[derive(Clone)]
struct TextRun {
    text: String,
    bold: bool,
    italic: bool,
}

// Represents a paragraph with its type and runs
struct FormattedParagraph {
    node_type: String, // "paragraph" or "heading"
    level: Option<u32>, // heading level (1-6)
    runs: Vec<TextRun>,
}

// Helper function to convert ProseMirror JSON to structured format
fn prosemirror_to_structured(doc_json: &serde_json::Value) -> (String, Vec<FormattedParagraph>) {
    let mut paragraphs = Vec::new();
    let mut plain_text_parts = Vec::new();

    if let Some(content) = doc_json.get("content").and_then(|c| c.as_array()) {
        for node in content {
            let node_type = node.get("type").and_then(|t| t.as_str()).unwrap_or("");

            match node_type {
                "paragraph" | "heading" => {
                    let runs = extract_runs_from_node(node);
                    let level = if node_type == "heading" {
                        node.get("attrs")
                            .and_then(|a| a.get("level"))
                            .and_then(|l| l.as_u64())
                            .map(|l| l as u32)
                    } else {
                        None
                    };

                    // Build plain text
                    let para_text: String = runs.iter().map(|r| r.text.as_str()).collect();
                    plain_text_parts.push(para_text);

                    paragraphs.push(FormattedParagraph {
                        node_type: node_type.to_string(),
                        level,
                        runs,
                    });
                }
                _ => {}
            }
        }
    }

    let plain_text = plain_text_parts.join("\n\n");
    (plain_text, paragraphs)
}

fn extract_runs_from_node(node: &serde_json::Value) -> Vec<TextRun> {
    let mut runs = Vec::new();

    if let Some(content) = node.get("content").and_then(|c| c.as_array()) {
        for item in content {
            if let Some(text_content) = item.get("text").and_then(|t| t.as_str()) {
                let mut bold = false;
                let mut italic = false;

                if let Some(marks) = item.get("marks").and_then(|m| m.as_array()) {
                    for mark in marks {
                        if let Some(mark_type) = mark.get("type").and_then(|t| t.as_str()) {
                            match mark_type {
                                "strong" => bold = true,
                                "em" => italic = true,
                                _ => {}
                            }
                        }
                    }
                }

                runs.push(TextRun {
                    text: text_content.to_string(),
                    bold,
                    italic,
                });
            }
        }
    }

    // If no runs, add an empty one
    if runs.is_empty() {
        runs.push(TextRun {
            text: String::new(),
            bold: false,
            italic: false,
        });
    }

    runs
}

// Tauri command to export document to various formats
#[tauri::command]
fn export_document(
    file_path: String,
    content: String,
) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    let extension = path.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("txt");

    // Parse ProseMirror JSON
    let doc_json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse document JSON: {}", e))?;

    let (plain_text, paragraphs) = prosemirror_to_structured(&doc_json);

    match extension {
        "txt" => {
            fs::write(&file_path, plain_text)
                .map_err(|e| format!("Failed to write file: {}", e))?;
        }
        "rtf" => {
            let mut rtf_content = String::from("{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0 Times New Roman;}}\n\\f0\\fs24\n");

            for para in paragraphs {
                // Handle headings with larger font size
                if para.node_type == "heading" {
                    let font_size = match para.level {
                        Some(1) => 32,
                        Some(2) => 28,
                        Some(3) => 24,
                        _ => 20,
                    };
                    rtf_content.push_str(&format!("\\fs{} \\b ", font_size));
                }

                // Process each text run with its own formatting
                for run in &para.runs {
                    if run.bold {
                        rtf_content.push_str("\\b ");
                    }
                    if run.italic {
                        rtf_content.push_str("\\i ");
                    }
                    rtf_content.push_str(&run.text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}"));
                    if run.italic {
                        rtf_content.push_str("\\i0 ");
                    }
                    if run.bold {
                        rtf_content.push_str("\\b0 ");
                    }
                }

                // Reset heading formatting
                if para.node_type == "heading" {
                    rtf_content.push_str("\\b0 \\fs24 ");
                }

                rtf_content.push_str("\\par\n\\par\n");
            }

            rtf_content.push('}');

            fs::write(&file_path, rtf_content)
                .map_err(|e| format!("Failed to write file: {}", e))?;
        }
        "docx" => {
            let mut docx = Docx::new();

            for para in paragraphs {
                let mut paragraph = Paragraph::new();

                // Determine font size for headings
                let is_heading = para.node_type == "heading";
                let font_size = if is_heading {
                    match para.level {
                        Some(1) => 32,
                        Some(2) => 28,
                        Some(3) => 24,
                        _ => 20,
                    }
                } else {
                    24 // Default body text size (12pt * 2 = 24 half-points)
                };

                // Add each text run with its own formatting
                for run in &para.runs {
                    let mut text_run = Run::new()
                        .add_text(&run.text)
                        .size(font_size);

                    // For headings, make all text bold
                    if is_heading || run.bold {
                        text_run = text_run.bold();
                    }
                    if run.italic {
                        text_run = text_run.italic();
                    }

                    paragraph = paragraph.add_run(text_run);
                }

                docx = docx.add_paragraph(paragraph);
            }

            // Write to a buffer using Cursor for Seek trait
            let mut buf = Cursor::new(Vec::new());
            docx.build()
                .pack(&mut buf)
                .map_err(|e| format!("Failed to pack DOCX: {}", e))?;

            fs::write(&file_path, buf.into_inner())
                .map_err(|e| format!("Failed to write file: {}", e))?;
        }
        _ => {
            return Err(format!("Unsupported file format: {}", extension));
        }
    }

    Ok(())
}

// Tauri command to import document from RTF or DOCX
#[tauri::command]
fn import_document(file_path: String) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    let extension = path.extension()
        .and_then(|s| s.to_str())
        .unwrap_or("txt");

    match extension {
        "txt" => {
            // Plain text - just read and convert to ProseMirror JSON
            let content = fs::read_to_string(&file_path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            Ok(text_to_prosemirror(&content))
        }
        "rtf" => {
            // Basic RTF text extraction (formatting will be lost)
            let content = fs::read_to_string(&file_path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            let text = extract_text_from_rtf(&content);
            Ok(text_to_prosemirror(&text))
        }
        "docx" | "doc" => {
            // DOCX/DOC files are binary and cannot be imported without a parsing library
            // Due to compatibility issues with available Rust libraries, DOCX import is not currently supported
            Err("DOCX/DOC import is not currently supported. Please export your document as plain text (.txt) or RTF (.rtf) first, then import it.".to_string())
        }
        _ => {
            Err(format!("Unsupported file format: {}", extension))
        }
    }
}

// Basic RTF text extraction - strips RTF control codes
fn extract_text_from_rtf(rtf: &str) -> String {
    let mut result = String::new();
    let mut in_group: i32 = 0;
    let mut chars = rtf.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '{' => {
                in_group += 1;
            }
            '}' => {
                in_group = in_group.saturating_sub(1);
            }
            '\\' => {
                // Skip control word
                while let Some(&next_ch) = chars.peek() {
                    if next_ch.is_alphabetic() || next_ch == '-' || next_ch.is_numeric() {
                        chars.next();
                    } else {
                        if next_ch == ' ' {
                            chars.next(); // consume delimiter space
                        }
                        break;
                    }
                }

                // Handle special RTF escapes
                if let Some(&('\\' | '{' | '}')) = chars.peek() {
                    result.push(chars.next().unwrap());
                }
            }
            _ if in_group <= 2 => {
                // Only include text in main content (group level 1-2)
                result.push(ch);
            }
            _ => {}
        }
    }

    result.trim().to_string()
}

// Helper to convert plain text to ProseMirror JSON
fn text_to_prosemirror(text: &str) -> String {
    let mut paragraphs = Vec::new();

    for line in text.split("\n\n") {
        if line.trim().is_empty() {
            continue;
        }

        paragraphs.push(serde_json::json!({
            "type": "paragraph",
            "content": [{
                "type": "text",
                "text": line.trim()
            }]
        }));
    }

    let doc = serde_json::json!({
        "type": "doc",
        "content": paragraphs
    });

    serde_json::to_string(&doc).unwrap()
}

fn main() {
    // Initialize app state
    let app_state = AppState::new();

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_all_entities,
            get_entity_state,
            format_character_sheet,
            create_entity,
            update_entity,
            delete_entity,
            duplicate_entity,
            delete_field_completely,
            insert_marker,
            update_marker,
            delete_marker,
            update_marker_positions,
            get_all_markers,
            get_markers_at_position,
            save_document,
            load_document,
            new_document,
            export_document,
            import_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}