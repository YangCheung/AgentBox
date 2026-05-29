use std::sync::Arc;

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use bollard::container::LogOutput;
use bollard::query_parameters::LogsOptions;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;

use crate::docker::manager::DockerManager;
use crate::AppState;

#[derive(Deserialize)]
pub struct LogsQuery {
    pub token: Option<String>,
}

pub async fn container_logs_ws(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<LogsQuery>,
) -> impl IntoResponse {
    if let Some(expected) = &state.config.api_key {
        match &query.token {
            Some(t) if t == expected => {}
            _ => {
                return axum::response::Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .body(axum::body::Body::from("Unauthorized"))
                    .unwrap()
                    .into_response();
            }
        }
    }

    let dm = state.docker_manager.clone().unwrap();
    ws.on_upgrade(move |socket| handle_socket(socket, dm, id))
}

async fn handle_socket(socket: WebSocket, docker_manager: Arc<DockerManager>, container_id: String) {
    let docker_name = format!("agent-{}", container_id);

    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::channel::<String>(256);

    let docker = docker_manager.client().clone();
    let options = LogsOptions {
        follow: true,
        stdout: true,
        stderr: true,
        tail: "all".to_string(),
        timestamps: false,
        ..Default::default()
    };

    let log_tx = tx.clone();
    let log_fut = tokio::spawn(async move {
        let mut stream = docker.logs(&docker_name, Some(options));
        while let Some(log_result) = stream.next().await {
            match log_result {
                Ok(LogOutput::StdOut { message }) => {
                    let _ = log_tx
                        .send(String::from_utf8_lossy(&message).to_string())
                        .await;
                }
                Ok(LogOutput::StdErr { message }) => {
                    let _ = log_tx
                        .send(String::from_utf8_lossy(&message).to_string())
                        .await;
                }
                _ => {}
            }
        }
    });

    let send_fut = tokio::spawn(async move {
        while let Some(line) = rx.recv().await {
            if sender
                .send(Message::Text(line.into()))
                .await
                .is_err()
            {
                break;
            }
        }
    });

    let recv_fut = tokio::spawn(async move {
        while let Some(Ok(_)) = receiver.next().await {}
    });

    tokio::select! {
        _ = log_fut => {}
        _ = send_fut => {}
        _ = recv_fut => {}
    }
}
