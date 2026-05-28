mod health;
mod reporter;
mod runner;

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
    let container_id = env::var("CONTAINER_ID").expect("CONTAINER_ID must be set");

    tracing::info!("Sidecar starting for container {}", container_id);

    let reporter = reporter::StatusReporter::new(control_plane_url, container_id);

    // 启动健康检查（后台心跳）
    let r = reporter.clone();
    tokio::spawn(async move {
        health::start_health_check(r).await;
    });

    // 发送初始状态
    reporter
        .report_status("running", 0.0, "initializing", vec!["Starting sidecar...".to_string()])
        .await?;

    // 确定要执行的命令
    let command = resolve_command();
    tracing::info!("Running command: {}", command);

    // 执行任务
    let result = runner::run_command(&command, reporter.clone()).await?;

    if result.success {
        reporter
            .report_status(
                "completed",
                1.0,
                "done",
                vec![format!("Exit code: {}", result.exit_code)],
            )
            .await?;
        tracing::info!("Task completed with exit code {}", result.exit_code);
    } else {
        reporter
            .report_status(
                "failed",
                1.0,
                "failed",
                vec![format!("Exit code: {}", result.exit_code)],
            )
            .await?;
        tracing::error!("Task failed with exit code {}", result.exit_code);
    }

    Ok(())
}

fn resolve_command() -> String {
    if let Ok(cmd) = env::var("AGENT_COMMAND") {
        return cmd;
    }
    let task = env::var("TASK").unwrap_or_else(|_| "default task".to_string());
    format!("claude-code --dangerously-skip-permissions -p \"{}\"", task)
}
