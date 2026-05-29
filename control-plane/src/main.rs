mod api;
mod auth;
mod config;
mod db;
mod docker;
mod error;
mod models;

use std::sync::Arc;

use axum::{middleware, routing::get, routing::post, routing::delete, Router};
use axum::http::HeaderValue;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

use config::Config;
use db::sqlite::Database;
use docker::lifecycle::LifecycleManager;
use docker::manager::DockerManager;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub docker_manager: Option<Arc<DockerManager>>,
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
        docker_manager: Some(docker_manager.clone()),
        config: config.clone(),
    };

    let lifecycle_manager = LifecycleManager::new(db.clone(), Some(docker_manager.clone()));
    tokio::spawn(async move {
        lifecycle_manager.start().await;
    });

    let cors = if let Some(ref origin) = config.cors_origin {
        CorsLayer::new()
            .allow_origin(
                origin
                    .parse::<HeaderValue>()
                    .map(AllowOrigin::exact)
                    .unwrap_or(AllowOrigin::any()),
            )
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    };

    let app = Router::new()
        .route("/health", get(api::health::health_check))
        .route(
            "/api/containers",
            get(api::containers::list_containers).post(api::containers::create_container),
        )
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
        .route("/api/stats", get(api::containers::get_stats))
        .route(
            "/api/containers/{id}/logs",
            get(api::ws::container_logs_ws),
        )
        .layer(middleware::from_fn_with_state(
            app_state.clone(),
            auth::api_key_auth,
        ))
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
