use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LlmChunk {
    pub content: String,
    pub done: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LlmError {
    pub message: String,
    pub error_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LlmDone {
    pub total_content: String,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
}

pub struct LlmClient {
    client: Client,
}

impl LlmClient {
    pub fn new() -> Self {
        LlmClient {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(300))
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }

    /// Send a streaming request — emits llm_chunk events as tokens arrive
    pub async fn send_request(
        &self,
        app_handle: &AppHandle,
        api_key: &str,
        base_url: &str,
        model: &str,
        messages: Vec<serde_json::Value>,
        temperature: f64,
        max_tokens: u32,
        abort_flag: Arc<AtomicBool>,
    ) -> Result<(), String> {
        let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

        let body = serde_json::json!({
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": messages,
            "stream": true
        });

        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("User-Agent", "OpenAI/Python 1.55.3")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                let msg = format!("Network error: {}", e);
                let _ = app_handle.emit("llm_error", LlmError {
                    message: msg.clone(),
                    error_type: "network_error".to_string(),
                });
                msg
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response.text().await.unwrap_or_default();
            let msg = format!("API error {}: {}", status, error_body);
            let _ = app_handle.emit("llm_error", LlmError {
                message: msg.clone(),
                error_type: "api_error".to_string(),
            });
            return Err(msg);
        }

        // Stream SSE response
        let mut stream = response.bytes_stream();
        let mut full_content = String::new();
        let mut buffer = String::new();
        let mut prompt_tokens: i64 = 0;
        let mut completion_tokens: i64 = 0;

        while let Some(chunk_result) = stream.next().await {
            // Check abort flag
            if abort_flag.load(Ordering::Relaxed) {
                let _ = app_handle.emit("llm_done", LlmDone {
                    total_content: full_content,
                    prompt_tokens,
                    completion_tokens,
                });
                return Ok(());
            }

            let chunk = chunk_result.map_err(|e| {
                let msg = format!("Stream read error: {}", e);
                let _ = app_handle.emit("llm_error", LlmError {
                    message: msg.clone(),
                    error_type: "stream_error".to_string(),
                });
                msg
            })?;

            buffer.push_str(&String::from_utf8_lossy(&chunk));

            // Process complete SSE lines
            while let Some(line_end) = buffer.find('\n') {
                let line = buffer[..line_end].trim().to_string();
                buffer = buffer[line_end + 1..].to_string();

                if line.is_empty() || line.starts_with(':') {
                    continue;
                }

                if let Some(data) = line.strip_prefix("data: ") {
                    let data = data.trim();

                    if data == "[DONE]" {
                        continue;
                    }

                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                        // Extract delta content
                        if let Some(content) = json.get("choices")
                            .and_then(|c| c.get(0))
                            .and_then(|c| c.get("delta"))
                            .and_then(|d| d.get("content"))
                            .and_then(|c| c.as_str())
                        {
                            if !content.is_empty() {
                                full_content.push_str(content);
                                let _ = app_handle.emit("llm_chunk", LlmChunk {
                                    content: content.to_string(),
                                    done: false,
                                });
                            }
                        }

                        // Extract usage info if present (some APIs send it in the last chunk)
                        if let Some(usage) = json.get("usage") {
                            prompt_tokens = usage.get("prompt_tokens")
                                .and_then(|t| t.as_i64())
                                .unwrap_or(prompt_tokens);
                            completion_tokens = usage.get("completion_tokens")
                                .and_then(|t| t.as_i64())
                                .unwrap_or(completion_tokens);
                        }
                    }
                }
            }
        }

        // Stream complete — emit done event
        let _ = app_handle.emit("llm_done", LlmDone {
            total_content: full_content,
            prompt_tokens,
            completion_tokens,
        });

        Ok(())
    }

    /// Inline edit: returns only the replacement text (no events emitted)
    pub async fn inline_edit(
        &self,
        api_key: &str,
        base_url: &str,
        model: &str,
        messages: Vec<serde_json::Value>,
        temperature: f64,
    ) -> Result<String, String> {
        let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

        let body = serde_json::json!({
            "model": model,
            "temperature": temperature,
            "max_tokens": 4096,
            "messages": messages,
            "stream": false
        });

        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("User-Agent", "OpenAI/Python 1.55.3")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status, error_body));
        }

        let response_text = response.text().await.map_err(|e| format!("Failed to read body: {}", e))?;

        let json: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("Parse error: {}", e))?;

        let content = json.get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .unwrap_or("")
            .to_string();

        Ok(content)
    }
}
