use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileMeta {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub extension: String,
    pub is_dir: bool,
    pub modified_days_ago: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileClassification {
    pub path: String,
    pub classification: String, // "junk", "important", "unknown"
    pub confidence: f32,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
    format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    keep_alive: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    response: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaModelsResponse {
    models: Vec<OllamaModel>,
}

fn format_size(bytes: u64) -> String {
    if bytes >= 1_073_741_824 {
        format!("{:.1} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1_024 {
        format!("{:.1} KB", bytes as f64 / 1_024.0)
    } else {
        format!("{} B", bytes)
    }
}

fn build_prompt(files: &[FileMeta]) -> String {
    let mut file_list = String::new();
    for f in files {
        let kind = if f.is_dir { "directory" } else { "file" };
        let modified = if f.modified_days_ago == 0 {
            "today".to_string()
        } else if f.modified_days_ago == 1 {
            "1 day ago".to_string()
        } else if f.modified_days_ago < 30 {
            format!("{} days ago", f.modified_days_ago)
        } else if f.modified_days_ago < 365 {
            format!("{} months ago", f.modified_days_ago / 30)
        } else {
            format!("{} years ago", f.modified_days_ago / 365)
        };

        file_list.push_str(&format!(
            "- name: {:?}, type: {}, size: {}, path: {:?}, extension: {:?}, last_modified: {}\n",
            f.name,
            kind,
            format_size(f.size_bytes),
            f.path,
            f.extension,
            modified
        ));
    }

    format!(
        r#"You are a disk cleanup assistant. Analyze each file/folder based only on its metadata (name, type, size, path, extension, and last modified date). Never read file content - this is metadata only.

For each item, determine if it is:
- "junk": Safe to delete (temp files, build artifacts, caches, old downloads, system metadata, empty files, log files, etc.)  
- "important": Keep this (source code, documents, media the user created, config files, etc.)
- "unknown": Cannot determine from metadata alone

Respond with ONLY a valid JSON array, no other text:
[
  {{"path": "/example/path", "classification": "junk", "confidence": 0.9, "reason": "npm dependency directory, regeneratable"}},
  ...
]

Files to analyze:
{}
Return JSON array only."#,
        file_list
    )
}

/// Call Ollama to classify a batch of files by metadata only.
pub async fn classify_files(
    files: Vec<FileMeta>,
    model: String,
    ollama_url: String,
) -> Vec<FileClassification> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .unwrap_or_default();

    let prompt = build_prompt(&files);

    let request = OllamaRequest {
        model: model.clone(),
        prompt,
        stream: false,
        format: "json".to_string(),
        keep_alive: None,
    };

    let url = format!("{}/api/generate", ollama_url);

    match client.post(&url).json(&request).send().await {
        Ok(response) => {
            match response.json::<OllamaResponse>().await {
                Ok(ollama_resp) => {
                    // Try to parse the JSON response
                    let text = ollama_resp.response.trim().to_string();

                    // Extract JSON array if wrapped in markdown code blocks
                    let json_text = if let Some(start) = text.find('[') {
                        if let Some(end) = text.rfind(']') {
                            text[start..=end].to_string()
                        } else {
                            text
                        }
                    } else {
                        text
                    };

                    match serde_json::from_str::<Vec<FileClassification>>(&json_text) {
                        Ok(classifications) => classifications,
                        Err(_) => {
                            // Fallback: mark all as unknown
                            files
                                .iter()
                                .map(|f| FileClassification {
                                    path: f.path.clone(),
                                    classification: "unknown".to_string(),
                                    confidence: 0.0,
                                    reason: "Could not parse LLM response".to_string(),
                                })
                                .collect()
                        }
                    }
                }
                Err(e) => files
                    .iter()
                    .map(|f| FileClassification {
                        path: f.path.clone(),
                        classification: "unknown".to_string(),
                        confidence: 0.0,
                        reason: format!("LLM response error: {}", e),
                    })
                    .collect(),
            }
        }
        Err(e) => files
            .iter()
            .map(|f| FileClassification {
                path: f.path.clone(),
                classification: "unknown".to_string(),
                confidence: 0.0,
                reason: format!("Ollama connection failed: {}", e),
            })
            .collect(),
    }
}

/// Fetch available models from Ollama.
pub async fn list_ollama_models(ollama_url: &str) -> Vec<String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let url = format!("{}/api/tags", ollama_url);

    match client.get(&url).send().await {
        Ok(response) => match response.json::<OllamaModelsResponse>().await {
            Ok(models_resp) => models_resp.models.into_iter().map(|m| m.name).collect(),
            Err(_) => vec![],
        },
        Err(_) => vec![],
    }
}

/// Check if Ollama is running.
pub async fn check_ollama_health(ollama_url: &str) -> bool {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    let url = format!("{}/api/tags", ollama_url);
    client.get(&url).send().await.is_ok()
}

/// Unload a model from Ollama memory.
pub async fn unload_model(model: String, ollama_url: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let request = OllamaRequest {
        model,
        prompt: "".to_string(),
        stream: false,
        format: "json".to_string(),
        keep_alive: Some(0), // 0 means unload immediately
    };

    let url = format!("{}/api/generate", ollama_url);

    match client.post(&url).json(&request).send().await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to unload model: {}", e)),
    }
}
