mod health;
mod query;
mod reporter;

use std::env;

use axum::{routing::get, routing::post, Router};
use tokio::signal::unix::{signal, SignalKind};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let control_plane_url =
        env::var("CONTROL_PLANE_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let container_id = env::var("CONTAINER_ID").expect("CONTAINER_ID must be set");
    let bind_addr = env::var("SIDECAR_ADDR").unwrap_or_else(|_| "0.0.0.0:9000".to_string());

    tracing::info!("Sidecar starting for container {}", container_id);

    let reporter = reporter::StatusReporter::new(control_plane_url, container_id.clone());

    // 心跳：后台向 control-plane 上报存活
    let r = reporter.clone();
    tokio::spawn(async move {
        health::start_health_check(r).await;
    });

    // 初始上报
    if let Err(e) = reporter
        .report_status(
            "running",
            0.0,
            "ready",
            vec!["sidecar listening".to_string()],
        )
        .await
    {
        tracing::warn!("initial status report failed: {}", e);
    }

    let app = Router::new()
        .route("/health", get(health_endpoint))
        .route("/query", post(query::handle_query));

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!("Sidecar listening on {}", bind_addr);

    // Graceful shutdown on SIGTERM / SIGINT
    let shutdown = async {
        let mut sigterm = signal(SignalKind::terminate()).expect("failed to register SIGTERM handler");
        let mut sigint = signal(SignalKind::interrupt()).expect("failed to register SIGINT handler");
        tokio::select! {
            _ = sigterm.recv() => tracing::info!("Received SIGTERM, shutting down gracefully"),
            _ = sigint.recv() => tracing::info!("Received SIGINT, shutting down gracefully"),
        }
    };

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await?;

    tracing::info!("Sidecar stopped");
    Ok(())
}

async fn health_endpoint() -> &'static str {
    "ok"
}
