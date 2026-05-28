# AgentBox

AgentBox - 基于 Rust + Docker 的 AI Agent 运行沙箱平台。为 Claude Agent SDK 等 AI Agent 提供隔离、安全、可管理的容器化运行环境。

## 用途

- **代码审查**：为每个 PR 创建独立容器，运行 Claude Agent 进行自动化代码审查
- **代码生成**：隔离执行 AI 生成的代码，防止对主环境造成影响
- **多租户 Agent 服务**：不同业务团队使用各自的 Skill 和配置，互不干扰
- **CI/CD 集成**：在流水线中动态创建 Agent 容器执行任务

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                   Control Plane (主服务)                 │
│  REST API ─ Docker Manager ─ Lifecycle Manager ─ SQLite │
└──────────────────────────┬──────────────────────────────┘
                           │ Docker Socket
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Agent Container                         │
│  ┌─────────────┐  ┌──────────────────────────────────┐ │
│  │ Sidecar     │  │ Claude Agent SDK                  │ │
│  │ (状态回传)   │──│ (执行任务)                         │ │
│  └─────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 语言 | 职责 |
|------|------|------|
| **Control Plane** | Rust | 容器生命周期管理、REST API、空闲检测、自动销毁 |
| **Sidecar** | Rust | 容器内服务，负责状态回传、日志收集、健康检查 |
| **Agent Image** | Docker | 包含 Sidecar + Claude Agent SDK 的容器镜像 |

### 技术栈

- **Web 框架**：Axum 0.8
- **Docker 客户端**：Bollard 0.21
- **数据库**：SQLite (sqlx 0.8)
- **异步运行时**：Tokio 1.x
- **日志**：Tracing

## 快速开始

### 前置要求

- Rust 1.70+
- Docker Desktop / OrbStack

### 本地运行

```bash
# 克隆项目
git clone <repo-url>
cd agentbox

# 编译
cargo build --release

# 启动 Control Plane
DATABASE_URL="sqlite:./data/agent_sandbox.db?mode=rwc" \
RUST_LOG=info \
cargo run -p control-plane
```

### Docker 运行

```bash
# 构建镜像
cargo build --release
docker build -t agent-sandbox:latest -f agent-image/Dockerfile .

# 启动
docker compose up -d
```

## API 文档

### 健康检查

```http
GET /health
```

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2026-05-28T10:23:49.544829+00:00"
}
```

### 创建容器

```http
POST /api/containers
Content-Type: application/json
```

**请求体**:
```json
{
  "task": "Review code PR #42",
  "skill_repos": ["https://github.com/company/skills.git"],
  "skill_branch": "main",
  "cpu_limit": "2",
  "memory_limit": "4Gi",
  "idle_timeout": 300,
  "max_lifetime": 3600,
  "env": {
    "ANTHROPIC_API_KEY": "your-key"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `task` | string | ✅ | Agent 执行的任务描述 |
| `skill_repos` | string[] | ✅ | Skill 仓库地址列表 |
| `skill_branch` | string | ❌ | Skill 仓库分支，默认 `main` |
| `cpu_limit` | string | ❌ | CPU 限制，默认 `2` (核) |
| `memory_limit` | string | ❌ | 内存限制，默认 `4Gi` |
| `idle_timeout` | integer | ❌ | 空闲超时(秒)，默认 300 |
| `max_lifetime` | integer | ❌ | 最大生命周期(秒)，默认 3600 |
| `env` | object | ❌ | 额外环境变量 |

**响应** (201 Created):
```json
{
  "id": "9c52cbc6-20a4-48a9-a7fb-cc8e8d64319b",
  "status": "Running",
  "created_at": "2026-05-28T10:23:51.155912+00:00",
  "docker_id": "agent-9c52cbc6-20a4-48a9-a7fb-cc8e8d64319b"
}
```

### 查询容器状态

```http
GET /api/containers/{id}
```

**响应** (200 OK):
```json
{
  "id": "9c52cbc6-20a4-48a9-a7fb-cc8e8d64319b",
  "task": "Review code PR #42",
  "status": "Running",
  "docker_id": "agent-9c52cbc6-20a4-48a9-a7fb-cc8e8d64319b",
  "skill_repos": "[\"https://github.com/company/skills.git\"]",
  "cpu_limit": "2",
  "memory_limit": "4Gi",
  "idle_timeout": 300,
  "max_lifetime": 3600,
  "created_at": "2026-05-28T10:23:51.155912+00:00",
  "last_activity": "2026-05-28T10:23:53.459101+00:00"
}
```

### 删除容器

```http
DELETE /api/containers/{id}
```

**响应** (204 No Content)

### 状态回传 (Sidecar → Control Plane)

```http
POST /api/containers/{id}/status
Content-Type: application/json
```

**请求体**:
```json
{
  "status": "running",
  "progress": 0.5,
  "current_step": "analyzing code",
  "logs": ["Reading src/main.rs", "Checking imports"],
  "timestamp": "2026-05-28T10:24:00Z"
}
```

## 容器状态

| 状态 | 说明 |
|------|------|
| `Creating` | 正在创建 |
| `Running` | 运行中 |
| `Idle` | 空闲 |
| `Stopping` | 正在停止 |
| `Stopped` | 已停止 |
| `Failed` | 失败 |

## 配置

### 环境变量 (Control Plane)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:agent_sandbox.db?mode=rwc` | SQLite 数据库路径 |
| `SERVER_ADDR` | `0.0.0.0:8080` | 监听地址 |
| `AGENT_IMAGE` | `agent-sandbox:latest` | Agent 容器镜像 |
| `RUST_LOG` | `info` | 日志级别 |

### 环境变量 (Sidecar 容器)

| 变量 | 说明 |
|------|------|
| `CONTAINER_ID` | 容器 ID (由 Control Plane 注入) |
| `TASK` | 任务描述 |
| `CONTROL_PLANE_URL` | Control Plane 地址 |
| `SKILL_REPOS` | Skill 仓库地址 (逗号分隔) |
| `ANTHROPIC_API_KEY` | Anthropic API Key |

## Skill 加载

Skill 文件从 Git 仓库自动克隆到容器内 `/workspace/skills/` 目录。

**仓库结构**:
```
skills-repo/
├── code-review/
│   └── SKILL.md
├── test-generator/
│   └── SKILL.md
└── custom-tool/
    └── SKILL.md
```

**SKILL.md 示例**:
```markdown
---
name: code-review
description: 自动化代码审查工具
---

# Code Review Skill

你是一个代码审查专家，负责审查 Pull Request。

## 审查要点
- 代码风格一致性
- 潜在 bug 和安全问题
- 性能优化建议
```

## 开发指南

### 项目结构

```
agent-sandbox/
├── Cargo.toml                          # Workspace 配置
├── Dockerfile                          # Control Plane 镜像
├── docker-compose.yml                  # Docker 编排
├── control-plane/                      # 主服务
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                     # 入口 + 路由
│       ├── config.rs                   # 配置管理
│       ├── error.rs                    # 错误类型
│       ├── models/container.rs         # 数据模型
│       ├── docker/
│       │   ├── manager.rs              # Docker 操作
│       │   └── lifecycle.rs            # 生命周期管理
│       ├── db/sqlite.rs                # 数据库操作
│       └── api/
│           ├── containers.rs           # 容器 API
│           └── health.rs              # 健康检查
├── sidecar/                            # 容器内服务
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                     # 入口
│       ├── reporter.rs                 # 状态上报
│       └── health.rs                   # 健康检查
└── agent-image/                        # Agent 镜像
    ├── Dockerfile
    └── entrypoint.sh
```

### 运行测试

```bash
# 单元测试
cargo test

# 指定包测试
cargo test -p control-plane
cargo test -p sidecar
```

### 构建镜像

```bash
# 编译 release
cargo build --release

# 构建 Agent 镜像
docker build -t agent-sandbox:latest -f agent-image/Dockerfile .
```

## 扩展方向

- [ ] WebSocket 实时日志流
- [ ] 容器池/预热机制
- [ ] Kubernetes 部署支持
- [ ] API 认证鉴权 (JWT/API Key)
- [ ] Prometheus 监控指标
- [ ] 容器快照与恢复
- [ ] 多节点调度

## License

MIT
