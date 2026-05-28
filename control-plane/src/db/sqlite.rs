use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};

use crate::error::AppError;
use crate::models::container::Container;

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self, AppError> {
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS containers (
                id TEXT PRIMARY KEY,
                task TEXT NOT NULL,
                status TEXT NOT NULL,
                docker_id TEXT,
                skill_repos TEXT NOT NULL DEFAULT '[]',
                cpu_limit TEXT NOT NULL DEFAULT '2',
                memory_limit TEXT NOT NULL DEFAULT '4Gi',
                idle_timeout INTEGER NOT NULL DEFAULT 300,
                max_lifetime INTEGER NOT NULL DEFAULT 3600,
                created_at TEXT NOT NULL,
                last_activity TEXT NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(Self { pool })
    }

    pub async fn create_container(&self, container: &Container) -> Result<(), AppError> {
        sqlx::query(
            r#"
            INSERT INTO containers (id, task, status, docker_id, skill_repos, cpu_limit, memory_limit, idle_timeout, max_lifetime, created_at, last_activity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&container.id)
        .bind(&container.task)
        .bind(&container.status)
        .bind(&container.docker_id)
        .bind(&container.skill_repos)
        .bind(&container.cpu_limit)
        .bind(&container.memory_limit)
        .bind(container.idle_timeout)
        .bind(container.max_lifetime)
        .bind(&container.created_at)
        .bind(&container.last_activity)
        .execute(&self.pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    pub async fn get_container(&self, id: &str) -> Result<Container, AppError> {
        sqlx::query_as::<_, Container>(
            "SELECT id, task, status, docker_id, skill_repos, cpu_limit, memory_limit, idle_timeout, max_lifetime, created_at, last_activity FROM containers WHERE id = ?"
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))
    }

    pub async fn update_status(&self, id: &str, status: &str) -> Result<(), AppError> {
        sqlx::query("UPDATE containers SET status = ? WHERE id = ?")
            .bind(status)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    pub async fn update_last_activity(&self, id: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("UPDATE containers SET last_activity = ? WHERE id = ?")
            .bind(now)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }

    pub async fn list_active_containers(&self) -> Result<Vec<Container>, AppError> {
        sqlx::query_as::<_, Container>(
            "SELECT id, task, status, docker_id, skill_repos, cpu_limit, memory_limit, idle_timeout, max_lifetime, created_at, last_activity FROM containers WHERE status IN ('Running', 'Idle')"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| AppError::DatabaseError(e.to_string()))
    }

    pub async fn delete_container(&self, id: &str) -> Result<(), AppError> {
        sqlx::query("DELETE FROM containers WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| AppError::DatabaseError(e.to_string()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn test_db() -> Database {
        Database::new("sqlite::memory:").await.unwrap()
    }

    fn test_container(id: &str) -> Container {
        let now = chrono::Utc::now().to_rfc3339();
        Container {
            id: id.to_string(),
            task: "test task".to_string(),
            status: "Running".to_string(),
            docker_id: Some("test-docker-id".to_string()),
            skill_repos: "[]".to_string(),
            cpu_limit: "1".to_string(),
            memory_limit: "1Gi".to_string(),
            idle_timeout: 300,
            max_lifetime: 3600,
            created_at: now.clone(),
            last_activity: now,
        }
    }

    #[tokio::test]
    async fn test_create_and_get_container() {
        let db = test_db().await;
        let container = test_container("test-1");

        db.create_container(&container).await.unwrap();
        let fetched = db.get_container("test-1").await.unwrap();

        assert_eq!(fetched.id, "test-1");
        assert_eq!(fetched.task, "test task");
        assert_eq!(fetched.status, "Running");
    }

    #[tokio::test]
    async fn test_update_status() {
        let db = test_db().await;
        let container = test_container("test-2");

        db.create_container(&container).await.unwrap();
        db.update_status("test-2", "Stopped").await.unwrap();

        let fetched = db.get_container("test-2").await.unwrap();
        assert_eq!(fetched.status, "Stopped");
    }

    #[tokio::test]
    async fn test_list_active_containers() {
        let db = test_db().await;
        let now = chrono::Utc::now().to_rfc3339();

        let c1 = Container {
            id: "test-3".to_string(),
            task: "task".to_string(),
            status: "Running".to_string(),
            docker_id: None,
            skill_repos: "[]".to_string(),
            cpu_limit: "1".to_string(),
            memory_limit: "1Gi".to_string(),
            idle_timeout: 300,
            max_lifetime: 3600,
            created_at: now.clone(),
            last_activity: now.clone(),
        };
        db.create_container(&c1).await.unwrap();

        let c2 = Container {
            id: "test-4".to_string(),
            task: "task".to_string(),
            status: "Stopped".to_string(),
            docker_id: None,
            skill_repos: "[]".to_string(),
            cpu_limit: "1".to_string(),
            memory_limit: "1Gi".to_string(),
            idle_timeout: 300,
            max_lifetime: 3600,
            created_at: now.clone(),
            last_activity: now,
        };
        db.create_container(&c2).await.unwrap();

        let active = db.list_active_containers().await.unwrap();
        assert_eq!(active.len(), 1);
        assert_eq!(active[0].id, "test-3");
    }

    #[tokio::test]
    async fn test_delete_container() {
        let db = test_db().await;
        let container = test_container("test-5");

        db.create_container(&container).await.unwrap();
        db.delete_container("test-5").await.unwrap();

        let result = db.get_container("test-5").await;
        assert!(result.is_err());
    }
}
