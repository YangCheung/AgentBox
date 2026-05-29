use std::env;

const SECRET_ENV_NAMES: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "API_KEY",
    "OPENAI_API_KEY",
    "GITHUB_TOKEN",
    "GH_TOKEN",
];

/// 从进程环境中读取已知敏感变量的值（>=8 字符），用于日志流脱敏。
pub fn collect_secret_values() -> Vec<String> {
    let mut values: Vec<String> = SECRET_ENV_NAMES
        .iter()
        .filter_map(|name| env::var(name).ok())
        .filter(|v| v.len() >= 8)
        .collect();
    // 长串优先，避免短前缀提前匹配掉长串后缀
    values.sort_by_key(|v| std::cmp::Reverse(v.len()));
    values
}

pub fn redact(line: &str, secrets: &[String]) -> String {
    let mut out = line.to_string();
    for s in secrets {
        if !s.is_empty() && out.contains(s.as_str()) {
            out = out.replace(s.as_str(), "***REDACTED***");
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_when_present() {
        let secrets = vec!["sk-ant-supersecretvalue".to_string()];
        let line = "ANTHROPIC_API_KEY=sk-ant-supersecretvalue trailing";
        assert_eq!(
            redact(line, &secrets),
            "ANTHROPIC_API_KEY=***REDACTED*** trailing"
        );
    }

    #[test]
    fn passthrough_when_no_match() {
        let secrets = vec!["sk-ant-supersecretvalue".to_string()];
        assert_eq!(redact("nothing here", &secrets), "nothing here");
    }

    #[test]
    fn handles_multiple_secrets() {
        let secrets = vec!["aaaaaaaa".to_string(), "bbbbbbbb".to_string()];
        assert_eq!(
            redact("x aaaaaaaa y bbbbbbbb z", &secrets),
            "x ***REDACTED*** y ***REDACTED*** z"
        );
    }

    #[test]
    fn empty_secret_is_ignored() {
        let secrets = vec!["".to_string()];
        assert_eq!(redact("anything", &secrets), "anything");
    }
}
