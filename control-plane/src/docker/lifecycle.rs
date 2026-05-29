use std::sync::Arc;
use tokio::time::{interval, Duration};

use crate::db::sqlite::Database;
use crate::docker::manager::DockerManager;
use crate::models::container::ContainerStatus;

pub struct LifecycleManager {
    db: Database,
    docker_manager: Option<Arc<DockerManager>>,
}

impl LifecycleManager {
    pub fn new(db: Database, docker_manager: Option<Arc<DockerManager>>) -> Self {
        Self {
            db,
            docker_manager,
        }
    }

    pub async fn start(&self) {
        let mut ticker = interval(Duration::from_secs(30));

        loop {
            ticker.tick().await;
            if let Err(e) = self.check_containers().await {
                tracing::error!("Lifecycle check failed: {}", e);
            }
        }
    }

    async fn check_containers(&self) -> Result<(), crate::error::AppError> {
        let containers = self.db.list_active_containers().await?;
        let now = chrono::Utc::now();

        for container in containers {
            let created_at = match chrono::DateTime::parse_from_rfc3339(&container.created_at) {
                Ok(dt) => dt.with_timezone(&chrono::Utc),
                Err(e) => {
                    tracing::error!(
                        "Container {} has invalid created_at '{}': {} — skipping lifecycle check",
                        container.id,
                        container.created_at,
                        e
                    );
                    continue;
                }
            };
            let last_activity = match chrono::DateTime::parse_from_rfc3339(&container.last_activity)
            {
                Ok(dt) => dt.with_timezone(&chrono::Utc),
                Err(e) => {
                    tracing::error!(
                        "Container {} has invalid last_activity '{}': {} — skipping lifecycle check",
                        container.id,
                        container.last_activity,
                        e
                    );
                    continue;
                }
            };

            let idle_duration = now.signed_duration_since(last_activity).num_seconds();
            let lifetime_duration = now.signed_duration_since(created_at).num_seconds();

            // 检查空闲超时
            if idle_duration > container.idle_timeout {
                tracing::info!(
                    "Container {} idle for {}s (limit: {}s), stopping",
                    container.id,
                    idle_duration,
                    container.idle_timeout
                );
                if let Some(docker_id) = &container.docker_id {
                    if let Some(dm) = &self.docker_manager {
                        if let Err(e) = dm.stop_container(docker_id).await {
                            tracing::warn!(
                                "Failed to stop idle container {} ({}): {}",
                                container.id,
                                docker_id,
                                e
                            );
                        }
                    }
                }
                self.db
                    .update_status(&container.id, ContainerStatus::Stopped.to_string().as_str())
                    .await?;
                continue;
            }

            // 检查最大生命周期
            if lifetime_duration > container.max_lifetime {
                tracing::info!(
                    "Container {} alive for {}s (limit: {}s), destroying",
                    container.id,
                    lifetime_duration,
                    container.max_lifetime
                );
                if let Some(docker_id) = &container.docker_id {
                    if let Some(dm) = &self.docker_manager {
                        if let Err(e) = dm.remove_container(docker_id).await {
                            tracing::warn!(
                                "Failed to remove expired container {} ({}): {}",
                                container.id,
                                docker_id,
                                e
                            );
                        }
                    }
                }
                self.db
                    .update_status(&container.id, ContainerStatus::Stopped.to_string().as_str())
                    .await?;
            }
        }

        Ok(())
    }
}
