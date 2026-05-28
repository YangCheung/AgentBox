mod health;
mod reporter;

use std::env;

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
    let container_id =
        env::var("CONTAINER_ID").expect("CONTAINER_ID must be set");

    tracing::info!("Sidecar starting for container {}", container_id);

    let reporter = reporter::StatusReporter::new(control_plane_url, container_id);

    // 启动健康检查
    let reporter_clone = reporter.clone();
    tokio::spawn(async move {
        health::start_health_check(reporter_clone).await;
    });

    // 发送初始状态
    reporter
        .report_status("running", 0.0, "initializing", vec!["Starting sidecar...".to_string()])
        .await?;

    let task = env::var("TASK").unwrap_or_else(|_| "default task".to_string());
    tracing::info!("Executing task: {}", task);

    // 模拟任务执行
    for i in 1..=5 {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        reporter
            .report_status(
                "running",
                i as f32 / 5.0,
                &format!("step {}", i),
                vec![format!("Progress: {}/5", i)],
            )
            .await?;
    }

    // 发送完成状态
    reporter
        .report_status(
            "completed",
            1.0,
            "done",
            vec!["Task completed successfully".to_string()],
        )
        .await?;

    tracing::info!("Task completed");
    Ok(())
}
