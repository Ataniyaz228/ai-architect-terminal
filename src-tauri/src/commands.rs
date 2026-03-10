use tauri::{AppHandle, State};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use uuid::Uuid;
use chrono::Utc;

use crate::database::{Database, Entry};
use crate::modes::ModeResolver;
use crate::llm::LlmClient;

pub struct AppState {
    pub db: Database,
    pub mode_resolver: ModeResolver,
    #[allow(dead_code)]
    pub llm_client: LlmClient,
    pub abort_flag: Arc<AtomicBool>,
}

// ── API Key Management ──

#[tauri::command]
pub async fn save_api_key(key: String) -> Result<String, String> {
    let entry = keyring::Entry::new("ai-architect-terminal", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry.set_password(&key)
        .map_err(|e| format!("Failed to save key: {}", e))?;
    Ok("saved".to_string())
}

#[tauri::command]
pub async fn save_base_url(url: String) -> Result<String, String> {
    let entry = keyring::Entry::new("ai-architect-terminal", "base-url")
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry.set_password(&url)
        .map_err(|e| format!("Failed to save URL: {}", e))?;
    Ok("saved".to_string())
}

#[tauri::command]
pub async fn get_api_key_status() -> Result<bool, String> {
    let entry = keyring::Entry::new("ai-architect-terminal", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("Keyring error: {}", e)),
    }
}

#[tauri::command]
pub async fn get_base_url() -> Result<String, String> {
    let entry = keyring::Entry::new("ai-architect-terminal", "base-url")
        .map_err(|e| format!("Keyring error: {}", e))?;
    match entry.get_password() {
        Ok(url) => Ok(url),
        Err(keyring::Error::NoEntry) => Ok("http://127.0.0.1:8045/v1".to_string()),
        Err(e) => Err(format!("Keyring error: {}", e)),
    }
}

#[tauri::command]
pub async fn delete_api_key() -> Result<String, String> {
    let entry = keyring::Entry::new("ai-architect-terminal", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry.delete_credential()
        .map_err(|e| format!("Failed to delete key: {}", e))?;
    Ok("deleted".to_string())
}

fn get_api_key() -> Result<String, String> {
    let entry = keyring::Entry::new("ai-architect-terminal", "api-key")
        .map_err(|e| format!("Keyring error: {}", e))?;
    entry.get_password()
        .map_err(|e| format!("No API key configured: {}", e))
}

fn get_stored_base_url() -> String {
    let entry = keyring::Entry::new("ai-architect-terminal", "base-url").ok();
    entry.and_then(|e| e.get_password().ok())
        .unwrap_or_else(|| "http://127.0.0.1:8045/v1".to_string())
}

// ── Modes ──

#[tauri::command]
pub async fn list_modes(state: State<'_, AppState>) -> Result<Vec<crate::modes::ModeConfig>, String> {
    Ok(state.mode_resolver.list_modes())
}

// ── LLM Request ──

#[derive(Debug, serde::Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct LlmRequestPayload {
    pub raw_input: String,
    pub mode_id: String,
    pub model: Option<String>,
    pub session_id: Option<String>,
    pub messages: Option<Vec<ChatMessage>>,
}

#[tauri::command]
pub async fn llm_request(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    payload: LlmRequestPayload,
) -> Result<String, String> {
    state.abort_flag.store(false, Ordering::Relaxed);

    let mode_config = state.mode_resolver.get_mode_config(&payload.mode_id)?;
    let system_prompt = state.mode_resolver.resolve_prompt(&payload.mode_id)?;
    let model = payload.model.unwrap_or(mode_config.default_model.clone());

    let api_key = get_api_key()?;
    let base_url = get_stored_base_url();

    let messages: Vec<serde_json::Value> = if let Some(msgs) = payload.messages {
        msgs.iter().map(|m| {
            serde_json::json!({ "role": m.role, "content": m.content })
        }).collect()
    } else {
        vec![
            serde_json::json!({ "role": "system", "content": system_prompt }),
            serde_json::json!({ "role": "user", "content": payload.raw_input }),
        ]
    };

    // Active Session Lock: reuse existing session or create a new one
    let session_id = match payload.session_id {
        Some(sid) => sid,
        None => {
            let sid = Uuid::new_v4().to_string();
            let title = if payload.raw_input.chars().count() > 60 {
                format!("{}...", payload.raw_input.chars().take(60).collect::<String>())
            } else {
                payload.raw_input.clone()
            };
            state.db.create_session(&sid, &title, &payload.mode_id, &model)
                .map_err(|e| format!("DB error: {}", e))?;
            sid
        }
    };

    // Always create a versioned entry
    let version_number = state.db.next_version_number(&session_id)
        .map_err(|e| format!("DB error: {}", e))?;
    let eid = Uuid::new_v4().to_string();
    let entry = Entry {
        id: eid.clone(),
        session_id: session_id.clone(),
        version_number,
        raw_input: payload.raw_input.clone(),
        generated_prompt: String::new(),
        token_usage_prompt: 0,
        token_usage_completion: 0,
        pinned: false,
        status: "generating".to_string(),
        created_at: Utc::now().to_rfc3339(),
    };
    state.db.add_entry(&entry)
        .map_err(|e| format!("DB error: {}", e))?;
    let entry_id = eid;

    let abort_flag = state.abort_flag.clone();
    let llm_client = LlmClient::new();
    let app = app_handle.clone();

    tauri::async_runtime::spawn(async move {
        let result = llm_client.send_request(
            &app,
            &api_key,
            &base_url,
            &model,
            messages,
            mode_config.temperature,
            mode_config.max_tokens,
            abort_flag,
        ).await;

        if let Err(e) = result {
            log::error!("LLM request failed: {}", e);
        }
    });

    Ok(serde_json::json!({
        "entry_id": entry_id,
        "session_id": session_id
    }).to_string())
}

// ── Inline Edit ──

#[derive(Debug, serde::Deserialize)]
pub struct InlineEditPayload {
    pub full_document: String,
    pub target_text: String,
    pub instruction: String,
    pub model: String,
}

#[tauri::command]
pub async fn inline_edit_request(
    app_handle: AppHandle,
    payload: InlineEditPayload,
) -> Result<String, String> {
    let api_key = get_api_key()?;
    let base_url = get_stored_base_url();

    // Fix #6: load prompt from bundled resource file instead of hardcoding in Rust
    let resource_dir = app_handle.path().resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    let prompt_path = resource_dir.join("resources").join("modes").join("inline_edit_prompt.md");
    let system_prompt = std::fs::read_to_string(&prompt_path)
        .unwrap_or_else(|_| {
            "You are a document editor. Apply the user's instruction to the highlighted fragment and return the full updated document.".to_string()
        });

    let user_message = format!(
        "ПОЛНЫЙ ДОКУМЕНТ (Markdown):\n---\n{}\n---\n\nВЫДЕЛЕННЫЙ ФРАГМЕНТ (рендеренный текст, может отличаться от Markdown):\n---\n{}\n---\n\nИНСТРУКЦИЯ: {}",
        payload.full_document,
        payload.target_text,
        payload.instruction
    );

    let messages = vec![
        serde_json::json!({ "role": "system", "content": system_prompt }),
        serde_json::json!({ "role": "user", "content": user_message }),
    ];

    let llm_client = LlmClient::new();
    llm_client.inline_edit(
        &api_key,
        &base_url,
        &payload.model,
        messages,
        0.3,
    ).await
}

#[tauri::command]
pub async fn abort_stream(state: State<'_, AppState>) -> Result<String, String> {
    state.abort_flag.store(true, Ordering::Relaxed);
    Ok("aborted".to_string())
}

// ── History ──

#[tauri::command]
pub async fn list_sessions(state: State<'_, AppState>) -> Result<Vec<crate::database::Session>, String> {
    state.db.list_sessions().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn get_session_entries(state: State<'_, AppState>, session_id: String) -> Result<Vec<Entry>, String> {
    state.db.get_session_entries(&session_id).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn delete_session(state: State<'_, AppState>, session_id: String) -> Result<String, String> {
    state.db.delete_session(&session_id).map_err(|e| format!("DB error: {}", e))?;
    Ok("deleted".to_string())
}

#[tauri::command]
pub async fn toggle_pin(state: State<'_, AppState>, entry_id: String) -> Result<bool, String> {
    state.db.toggle_pin(&entry_id).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn get_pinned_entries(state: State<'_, AppState>) -> Result<Vec<Entry>, String> {
    state.db.get_pinned_entries().map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn search_entries(state: State<'_, AppState>, query: String) -> Result<Vec<Entry>, String> {
    state.db.search_entries(&query).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn get_latest_entry(state: State<'_, AppState>, session_id: String) -> Result<Option<Entry>, String> {
    state.db.get_latest_entry(&session_id).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub async fn save_entry_result(
    state: State<'_, AppState>,
    entry_id: String,
    prompt: String,
    status: String,
    tokens_prompt: i64,
    tokens_completion: i64,
) -> Result<String, String> {
    state.db.update_entry_prompt(&entry_id, &prompt, &status, tokens_prompt, tokens_completion)
        .map_err(|e| format!("DB error: {}", e))?;
    Ok("saved".to_string())
}
