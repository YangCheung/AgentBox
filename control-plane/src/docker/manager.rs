use bollard::Docker;
use bollard::query_parameters::{CreateContainerOptions, RemoveContainerOptions, StopContainerOptions};
use bollard::models::{ContainerCreateBody, HostConfig};

use crate::error::AppError;

pub struct DockerManager {
    docker: Docker,
}

impl DockerManager {
    pub async fn new() -> Result<Self, AppError> {
        let docker = Docker::connect_with_local_defaults()
            .map_err(|e| AppError::DockerError(e.to_string()))?;
        Ok(Self { docker })
    }

    pub async fn create_container(
        &self,
        name: &str,
        image: &str,
        env_vars: Vec<String>,
        cpu_limit: &str,
        memory_limit: &str,
    ) -> Result<String, AppError> {
        if self.docker.inspect_image(image).await.is_err() {
            return Err(AppError::BadRequest(format!(
                "Image '{}' not found locally. Run: docker build -t {} -f agent-image/Dockerfile .",
                image, image
            )));
        }

        let config = ContainerCreateBody {
            image: Some(image.to_string()),
            env: Some(env_vars),
            host_config: Some(HostConfig {
                memory: Some(parse_memory(memory_limit)),
                cpu_quota: Some(parse_cpu(cpu_limit)),
                ..Default::default()
            }),
            ..Default::default()
        };

        let options = CreateContainerOptions {
            name: Some(name.to_string()),
            ..Default::default()
        };

        self.docker
            .create_container(Some(options), config)
            .await
            .map_err(|e| AppError::DockerError(e.to_string()))?;

        self.docker
            .start_container(name, None)
            .await
            .map_err(|e| AppError::DockerError(e.to_string()))?;

        Ok(name.to_string())
    }

    pub async fn stop_container(&self, name: &str) -> Result<(), AppError> {
        let options = StopContainerOptions { t: Some(2), signal: None };
        self.docker
            .stop_container(name, Some(options))
            .await
            .map_err(|e| AppError::DockerError(e.to_string()))?;
        Ok(())
    }

    pub async fn remove_container(&self, name: &str) -> Result<(), AppError> {
        let options = RemoveContainerOptions { force: true, ..Default::default() };
        self.docker
            .remove_container(name, Some(options))
            .await
            .map_err(|e| AppError::DockerError(e.to_string()))?;
        Ok(())
    }

    pub fn client(&self) -> &Docker {
        &self.docker
    }

    pub async fn ping(&self) -> bool {
        self.docker.ping().await.is_ok()
    }

    pub async fn image_exists(&self, image: &str) -> bool {
        self.docker.inspect_image(image).await.is_ok()
    }

    pub async fn container_exists(&self, name: &str) -> bool {
        self.docker.inspect_container(name, None).await.is_ok()
    }

    pub async fn is_container_running(&self, name: &str) -> bool {
        match self.docker.inspect_container(name, None).await {
            Ok(info) => info
                .state
                .and_then(|s| s.running)
                .unwrap_or(false),
            Err(_) => false,
        }
    }

    /// Copy a local directory into a running container at the specified path.
    /// Builds a tar archive and pipes it into the container via `tar -xf -`.
    pub async fn copy_to_container(
        &self,
        container_name: &str,
        src_dir: &str,
        dest_path: &str,
    ) -> Result<(), AppError> {
        use bollard::exec::{CreateExecOptions, StartExecOptions};
        use futures_util::StreamExt;
        use tokio::io::AsyncWriteExt;

        let src_dir = src_dir.to_string();
        let dest_path = dest_path.to_string();

        // Build tar archive in a blocking task
        let tar_bytes = tokio::task::spawn_blocking(move || -> Result<Vec<u8>, AppError> {
            let mut buf = Vec::new();
            {
                let mut builder = tar::Builder::new(&mut buf);
                builder
                    .append_dir_all(".", &src_dir)
                    .map_err(|e| AppError::DockerError(format!("tar build error: {}", e)))?;
                builder
                    .finish()
                    .map_err(|e| AppError::DockerError(format!("tar finish error: {}", e)))?;
            }
            Ok(buf)
        })
        .await
        .map_err(|e| AppError::DockerError(format!("task join error: {}", e)))?
        .map_err(|e| AppError::DockerError(format!("tar error: {}", e)))?;

        // Create exec with stdin attached: mkdir -p + tar extraction
        let tar_cmd = format!("mkdir -p '{}' && tar -xf - -C '{}'", dest_path, dest_path);
        let cmd = vec!["sh", "-c", &tar_cmd];

        let exec = self
            .docker
            .create_exec(
                container_name,
                CreateExecOptions {
                    cmd: Some(cmd),
                    attach_stdin: Some(true),
                    attach_stdout: Some(true),
                    attach_stderr: Some(true),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| AppError::DockerError(format!("create exec error: {}", e)))?;

        match self
            .docker
            .start_exec(&exec.id, Some(StartExecOptions { detach: false, tty: false, ..Default::default() }))
            .await
            .map_err(|e| AppError::DockerError(format!("start exec error: {}", e)))?
        {
            bollard::exec::StartExecResults::Attached {
                mut output,
                mut input,
            } => {
                // Write tar bytes to stdin
                input
                    .write_all(&tar_bytes)
                    .await
                    .map_err(|e| AppError::DockerError(format!("write tar to exec error: {}", e)))?;
                // Close stdin to signal EOF
                input
                    .shutdown()
                    .await
                    .map_err(|e| AppError::DockerError(format!("close stdin error: {}", e)))?;

                // Drain output to wait for completion
                while let Some(chunk) = output.next().await {
                    if let Err(e) = chunk {
                        tracing::warn!("exec output error: {}", e);
                    }
                }
            }
            bollard::exec::StartExecResults::Detached => {
                return Err(AppError::DockerError("exec unexpectedly detached".to_string()));
            }
        }

        Ok(())
    }

    /// Get the IP address of a running container on the Docker network.
    /// Returns an error if the container is not running or the IP cannot be determined.
    pub async fn get_container_ip(&self, name: &str) -> Result<String, AppError> {
        let info = self
            .docker
            .inspect_container(name, None)
            .await
            .map_err(|e| AppError::DockerError(format!("Failed to inspect container {}: {}", name, e)))?;

        let running = info
            .state
            .as_ref()
            .and_then(|s| s.running)
            .unwrap_or(false);
        if !running {
            return Err(AppError::BadRequest(format!(
                "Container {} is not running",
                name
            )));
        }

        // Iterate networks to find the container IP
        if let Some(networks) = info
            .network_settings
            .as_ref()
            .and_then(|ns| ns.networks.as_ref())
        {
            for (_name, net) in networks {
                if let Some(ip) = &net.ip_address {
                    if !ip.is_empty() {
                        return Ok(ip.clone());
                    }
                }
            }
        }

        Err(AppError::DockerError(format!(
            "Could not determine IP address for container {}",
            name
        )))
    }
}

fn parse_memory(s: &str) -> i64 {
    let s = s.trim();
    if let Some(val) = s.strip_suffix("Gi") {
        val.parse::<i64>().unwrap_or(4) * 1024 * 1024 * 1024
    } else if let Some(val) = s.strip_suffix("Mi") {
        val.parse::<i64>().unwrap_or(4096) * 1024 * 1024
    } else {
        s.parse::<i64>().unwrap_or(4294967296)
    }
}

fn parse_cpu(s: &str) -> i64 {
    s.parse::<i64>().unwrap_or(2) * 100000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_memory() {
        assert_eq!(parse_memory("4Gi"), 4 * 1024 * 1024 * 1024);
        assert_eq!(parse_memory("512Mi"), 512 * 1024 * 1024);
        assert_eq!(parse_memory("1024"), 1024);
        assert_eq!(parse_memory(" 2Gi "), 2 * 1024 * 1024 * 1024);
    }

    #[test]
    fn test_parse_cpu() {
        assert_eq!(parse_cpu("1"), 100000);
        assert_eq!(parse_cpu("4"), 400000);
        assert_eq!(parse_cpu("2"), 200000);
    }
}
