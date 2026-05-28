use chrono::Utc;
use reqwest::Client;
use serde_json::json;

#[derive(Clone)]
pub struct StatusReporter {
    client: Client,
    control_plane_url: String,
    container_id: String,
}

impl StatusReporter {
    pub fn new(control_plane_url: String, container_id: String) -> Self {
        Self {
            client: Client::new(),
            control_plane_url,
            container_id,
        }
    }

    pub async fn report_status(
        &self,
        status: &str,
        progress: f32,
        current_step: &str,
        logs: Vec<String>,
    ) -> Result<(), reqwest::Error> {
        let url = format!(
            "{}/api/containers/{}/status",
            self.control_plane_url, self.container_id
        );

        let payload = json!({
            "status": status,
            "progress": progress,
            "current_step": current_step,
            "logs": logs,
            "timestamp": Utc::now().to_rfc3339(),
        });

        self.client.post(&url).json(&payload).send().await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_reporter_creation() {
        let reporter = StatusReporter::new(
            "http://localhost:8080".to_string(),
            "test-container".to_string(),
        );
        assert_eq!(reporter.control_plane_url, "http://localhost:8080");
        assert_eq!(reporter.container_id, "test-container");
    }
}
