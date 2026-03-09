mod database;
mod modes;
mod llm;
mod commands;

use commands::AppState;
use database::Database;
use modes::ModeResolver;
use llm::LlmClient;
use tauri::Manager;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Set up logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize database
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data dir");
            let db = Database::new(&app_data_dir)
                .expect("Failed to initialize database");

            // Initialize mode resolver
            let resource_dir = app.path().resource_dir()
                .expect("Failed to get resource dir");
            let mode_resolver = ModeResolver::new(resource_dir, app_data_dir);

            // Initialize LLM client
            let llm_client = LlmClient::new();

            // Create app state
            let state = AppState {
                db,
                mode_resolver,
                llm_client,
                abort_flag: Arc::new(AtomicBool::new(false)),
            };

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_api_key,
            commands::save_base_url,
            commands::get_api_key_status,
            commands::get_base_url,
            commands::delete_api_key,
            commands::list_modes,
            commands::llm_request,
            commands::abort_stream,
            commands::list_sessions,
            commands::get_session_entries,
            commands::delete_session,
            commands::toggle_pin,
            commands::get_pinned_entries,
            commands::search_entries,
            commands::save_entry_result,
            commands::inline_edit_request,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
