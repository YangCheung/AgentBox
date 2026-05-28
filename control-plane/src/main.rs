mod api;
mod config;
mod db;
mod docker;
mod error;
mod models;

use std::sync::Arc;

use axum::{routing::get, routing::post, routing::delete, Router};
use tower_http::cors::{Any, CorsLayer};

use config::Config;
use db::sqlite::Database;
use docker::lifecycle::LifecycleManager;
use docker::manager::DockerManager;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub docker_manager: Arc<DockerManager>,
    pub config: Config,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let config = Config::from_env();
    tracing::info!("Starting Control Plane on {}", config.server_addr);

    let db = Database::new(&config.database_url)
        .await
        .expect("Failed to connect to database");

    let docker_manager = Arc::new(
        DockerManager::new()
            .await
            .expect("Failed to connect to Docker"),
    );

    let app_state = AppState {
        db: db.clone(),
        docker_manager: docker_manager.clone(),
        config: config.clone(),
    };

    // 启动生命周期管理器
    let lifecycle_manager = LifecycleManager::new(db.clone(), docker_manager.clone());
    tokio::spawn(async move {
        lifecycle_manager.start().await;
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(api::health::health_check))
        .route("/api/containers", post(api::containers::create_container))
        .route(
            "/api/containers/{id}",
            get(api::containers::get_container),
        )
        .route(
            "/api/containers/{id}",
            delete(api::containers::delete_container),
        )
        .route(
            "/api/containers/{id}/status",
            post(api::containers::report_status),
        )
        .route(
            "/api/containers/{id}/logs",
            get(api::ws::container_logs_ws),
        )
        .layer(cors)
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind(&config.server_addr)
        .await
        .expect("Failed to bind");

    tracing::info!("Listening on {}", config.server_addr);
    axum::serve(listener, app)
        .await
        .expect("Server failed");
}
