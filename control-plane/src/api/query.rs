use axum::{
    body::Body,
    extract::{Path, State},
    response::Response,
};
use futures_util::StreamExt;

use crate::error::AppError;
use crate::models::container::QueryRequest;
use crate::AppState;

/// Proxy a query to the sidecar's /query endpoint and stream the SSE response back.
///
/// POST /api/containers/{id}/query
pub async fn proxy_query(
    State(state): State<AppState>,
    Path(id): Path<String>,
    axum::Json(payload): axum::extract::Json<QueryRequest>,
) -> Result<Response<Body>, AppError> {
    // 1. Validate prompt
    if payload.prompt.trim().is_empty() {
        return Err(AppError::BadRequest("prompt must not be empty".into()));
    }

    // 2. Look up container in DB
    let container = state.db.get_container_opt(&id).await?;
    let container = match container {
        Some(c) => c,
        None => return Err(AppError::NotFound(format!("Container {} not found", id))),
    };

    // 3. Ensure we have a docker_id
    let docker_id = match &container.docker_id {
        Some(did) => did.clone(),
        None => {
            return Err(AppError::BadRequest(
                "Container has no Docker ID".into(),
            ))
        }
    };

    // 4. Get Docker manager and container IP
    let dm = state
        .docker_manager
        .as_ref()
        .ok_or_else(|| AppError::DockerError("Docker not configured".into()))?;

    let ip = dm.get_container_ip(&docker_id).await?;

    // 5. Build sidecar URL and forward the request
    let sidecar_url = format!("http://{}:9000/query", ip);
    let json_body = serde_json::to_vec(&payload)
        .map_err(|e| AppError::BadRequest(format!("Failed to serialize request: {}", e)))?;

    let client = reqwest::Client::new();
    let upstream_response = client
        .post(&sidecar_url)
        .header("Content-Type", "application/json")
        .body(json_body)
        .send()
        .await
        .map_err(|e| {
            AppError::DockerError(format!("Failed to connect to sidecar at {}: {}", sidecar_url, e))
        })?;

    // 6. Check upstream status
    if !upstream_response.status().is_success() {
        let status = upstream_response.status();
        let body = upstream_response.text().await.unwrap_or_default();
        return Err(AppError::DockerError(format!(
            "Sidecar returned {}: {}",
            status.as_u16(),
            body
        )));
    }

    // 7. Stream the SSE response back to the client
    let byte_stream = upstream_response
        .bytes_stream()
        .map(|result| result.map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
        }));

    let body = Body::from_stream(byte_stream);

    let response = Response::builder()
        .status(200)
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("X-Accel-Buffering", "no") // disable nginx buffering
        .body(body)
        .map_err(|e| AppError::DockerError(format!("Failed to build response: {}", e)))?;

    Ok(response)
}
