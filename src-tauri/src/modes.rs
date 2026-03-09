use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModeConfig {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub description: String,
    pub prompt_file: String,
    pub default_model: String,
    pub temperature: f64,
    pub max_tokens: u32,
}

pub struct ModeResolver {
    builtin_dir: PathBuf,
    custom_dir: PathBuf,
}

impl ModeResolver {
    pub fn new(resource_dir: PathBuf, app_data_dir: PathBuf) -> Self {
        let builtin_dir = resource_dir.join("resources").join("modes");
        let custom_dir = app_data_dir.join("custom_modes");
        std::fs::create_dir_all(&custom_dir).ok();
        ModeResolver { builtin_dir, custom_dir }
    }

    pub fn list_modes(&self) -> Vec<ModeConfig> {
        let mut modes = Vec::new();

        // Load built-in modes
        let builtin_registry = self.builtin_dir.join("registry.json");
        if let Ok(content) = std::fs::read_to_string(&builtin_registry) {
            if let Ok(builtin_modes) = serde_json::from_str::<Vec<ModeConfig>>(&content) {
                modes.extend(builtin_modes);
            }
        }

        // Load custom modes
        let custom_registry = self.custom_dir.join("registry.json");
        if let Ok(content) = std::fs::read_to_string(&custom_registry) {
            if let Ok(custom_modes) = serde_json::from_str::<Vec<ModeConfig>>(&content) {
                modes.extend(custom_modes);
            }
        }

        modes
    }

    pub fn resolve_prompt(&self, mode_id: &str) -> Result<String, String> {
        let modes = self.list_modes();
        let mode = modes.iter().find(|m| m.id == mode_id)
            .ok_or_else(|| format!("Mode not found: {}", mode_id))?;

        // Load base system prompt
        let base_prompt = std::fs::read_to_string(self.builtin_dir.join("_base_system_prompt.md"))
            .unwrap_or_default();

        // Load mode-specific prompt — check custom dir first, then builtin
        let mode_prompt = std::fs::read_to_string(self.custom_dir.join(&mode.prompt_file))
            .or_else(|_| std::fs::read_to_string(self.builtin_dir.join(&mode.prompt_file)))
            .map_err(|e| format!("Failed to load prompt file {}: {}", mode.prompt_file, e))?;

        Ok(format!("{}\n\n---\n\n{}", base_prompt, mode_prompt))
    }

    pub fn get_mode_config(&self, mode_id: &str) -> Result<ModeConfig, String> {
        let modes = self.list_modes();
        modes.into_iter().find(|m| m.id == mode_id)
            .ok_or_else(|| format!("Mode not found: {}", mode_id))
    }
}
