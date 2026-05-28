FROM rust:1.95-slim as builder

WORKDIR /app

# 安装依赖
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

# 复制 workspace
COPY Cargo.toml ./
COPY control-plane/Cargo.toml ./control-plane/
COPY sidecar/Cargo.toml ./sidecar/

# 创建虚拟 main.rs 用于缓存依赖
RUN mkdir -p control-plane/src && echo "fn main() {}" > control-plane/src/main.rs
RUN mkdir -p sidecar/src && echo "fn main() {}" > sidecar/src/main.rs
RUN cargo build --release 2>/dev/null || true

# 复制实际源码
COPY control-plane/ ./control-plane/
COPY sidecar/ ./sidecar/

# 触发重新编译
RUN touch control-plane/src/main.rs sidecar/src/main.rs

# 构建
RUN cargo build --release --bin control-plane

# 运行时镜像
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/control-plane /usr/local/bin/control-plane

RUN mkdir -p /data

EXPOSE 8080

CMD ["control-plane"]
