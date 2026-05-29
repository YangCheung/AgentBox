use std::convert::Infallible;
use std::time::Duration;

use axum::{
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    Json,
};
use cc_sdk::{query, ClaudeCodeOptions, Message};
use futures::stream::{Stream, StreamExt};
use serde::Deserialize;
use serde_json::json;

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct QueryOptions {
    pub model: Option<String>,
    pub fallback_model: Option<String>,
    pub system_prompt: Option<String>,
    pub append_system_prompt: Option<String>,
    pub max_turns: Option<i32>,
    pub max_output_tokens: Option<u32>,
    pub max_thinking_tokens: Option<i32>,
    pub allowed_tools: Option<Vec<String>>,
    pub disallowed_tools: Option<Vec<String>>,
    pub cwd: Option<String>,
    pub session_id: Option<String>,
    pub resume: Option<String>,
    pub continue_conversation: Option<bool>,
    pub include_partial_messages: Option<bool>,
    pub max_budget_usd: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct QueryRequest {
    pub prompt: String,
    #[serde(default)]
    pub options: Option<QueryOptions>,
}

fn build_options(opts: QueryOptions) -> ClaudeCodeOptions {
    let mut b = ClaudeCodeOptions::builder();
    if let Some(v) = opts.model {
        b = b.model(v);
    }
    if let Some(v) = opts.fallback_model {
        b = b.fallback_model(v);
    }
    if let Some(v) = opts.system_prompt {
        b = b.system_prompt(v);
    }
    if let Some(v) = opts.append_system_prompt {
        b = b.append_system_prompt(v);
    }
    if let Some(v) = opts.max_turns {
        b = b.max_turns(v);
    }
    if let Some(v) = opts.max_output_tokens {
        b = b.max_output_tokens(v);
    }
    if let Some(v) = opts.max_thinking_tokens {
        b = b.max_thinking_tokens(v);
    }
    if let Some(v) = opts.allowed_tools {
        b = b.allowed_tools(v);
    }
    if let Some(v) = opts.disallowed_tools {
        b = b.disallowed_tools(v);
    }
    if let Some(v) = opts.cwd {
        b = b.cwd(std::path::PathBuf::from(v));
    }
    if let Some(v) = opts.session_id {
        b = b.session_id(v);
    }
    if let Some(v) = opts.resume {
        b = b.resume(v);
    }
    if let Some(v) = opts.continue_conversation {
        b = b.continue_conversation(v);
    }
    if let Some(v) = opts.include_partial_messages {
        b = b.include_partial_messages(v);
    }
    if let Some(v) = opts.max_budget_usd {
        b = b.max_budget_usd(v);
    }
    b.build()
}

fn msg_event_name(msg: &Message) -> &'static str {
    match msg {
        Message::User { .. } => "user",
        Message::Assistant { .. } => "assistant",
        Message::System { .. } => "system",
        Message::Result { .. } => "result",
        Message::StreamEvent { .. } => "stream_event",
        Message::RateLimit { .. } => "rate_limit",
        _ => "unknown",
    }
}

pub async fn handle_query(
    Json(req): Json<QueryRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, String)> {
    if req.prompt.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "prompt must not be empty".into()));
    }

    let options = req.options.map(build_options);

    let prompt = req.prompt;
    let upstream = query(prompt, options).await.map_err(|e| {
        tracing::error!("cc_sdk::query init failed: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("query init failed: {}", e),
        )
    })?;

    let event_stream = upstream.map(|item| -> Result<Event, Infallible> {
        match item {
            Ok(msg) => {
                let event_name = msg_event_name(&msg);
                let data = serde_json::to_string(&msg).unwrap_or_else(|e| {
                    json!({ "error": format!("serialize: {}", e) }).to_string()
                });
                Ok(Event::default().event(event_name).data(data))
            }
            Err(e) => {
                tracing::warn!("cc_sdk stream error: {}", e);
                Ok(Event::default()
                    .event("error")
                    .data(json!({ "message": e.to_string() }).to_string()))
            }
        }
    });

    Ok(Sse::new(event_stream).keep_alive(KeepAlive::new().interval(Duration::from_secs(15))))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_minimal_request() {
        let req: QueryRequest = serde_json::from_str(r#"{"prompt":"hi"}"#).unwrap();
        assert_eq!(req.prompt, "hi");
        assert!(req.options.is_none());
    }

    #[test]
    fn deserialize_with_options() {
        let req: QueryRequest = serde_json::from_str(
            r#"{"prompt":"hi","options":{"model":"claude-opus-4-7","max_turns":3}}"#,
        )
        .unwrap();
        assert_eq!(req.prompt, "hi");
        let opts = req.options.unwrap();
        assert_eq!(opts.model.as_deref(), Some("claude-opus-4-7"));
        assert_eq!(opts.max_turns, Some(3));
    }

    #[test]
    fn deserialize_ignores_unknown_options_fields() {
        let req: QueryRequest =
            serde_json::from_str(r#"{"prompt":"hi","options":{"model":"x","weird_unknown":42}}"#)
                .unwrap();
        assert_eq!(req.options.as_ref().unwrap().model.as_deref(), Some("x"));
    }
}
