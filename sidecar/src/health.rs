use tokio::time::{interval, Duration};

use crate::reporter::StatusReporter;

pub async fn start_health_check(reporter: StatusReporter) {
    let mut ticker = interval(Duration::from_secs(30));

    loop {
        ticker.tick().await;
        let _ = reporter.report_status("running", 0.0, "heartbeat", vec![]).await;
    }
}
