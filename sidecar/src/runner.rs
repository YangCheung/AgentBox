use std::process::Stdio;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::reporter::StatusReporter;

#[derive(Debug)]
pub struct RunResult {
    pub success: bool,
    pub exit_code: i32,
}

pub async fn run_command(
    command: &str,
    reporter: StatusReporter,
) -> Result<RunResult, Box<dyn std::error::Error>> {
    let mut child = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", command])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()?
    } else {
        Command::new("sh")
            .args(["-c", command])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()?
    };

    let stdout = child
        .stdout
        .take()
        .ok_or("failed to capture stdout")?;
    let stderr = child
        .stderr
        .take()
        .ok_or("failed to capture stderr")?;

    let reporter_clone = reporter.clone();
    let stdout_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let mut batch: Vec<String> = Vec::new();
        let mut last_report = tokio::time::Instant::now();

        while let Ok(Some(line)) = lines.next_line().await {
            tracing::info!("[stdout] {}", line);
            batch.push(line);

            // 每 10 行或 5 秒上报一次
            let elapsed = last_report.elapsed();
            if batch.len() >= 10 || elapsed >= Duration::from_secs(5) {
                let logs = batch.drain(..).collect();
                let _ = reporter_clone
                    .report_status("running", 0.0, "executing", logs)
                    .await;
                last_report = tokio::time::Instant::now();
            }
        }
        // 上报剩余行
        if !batch.is_empty() {
            let _ = reporter_clone
                .report_status("running", 0.0, "executing", batch)
                .await;
        }
    });

    let stderr_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        let mut batch: Vec<String> = Vec::new();

        while let Ok(Some(line)) = lines.next_line().await {
            tracing::error!("[stderr] {}", line);
            batch.push(format!("[ERROR] {}", line));
        }
        if !batch.is_empty() {
            let _ = reporter
                .report_status("running", 0.0, "executing", batch)
                .await;
        }
    });

    let status = child.wait().await?;
    let exit_code = status.code().unwrap_or(-1);

    stdout_handle.await?;
    stderr_handle.await?;

    Ok(RunResult {
        success: status.success(),
        exit_code,
    })
}
