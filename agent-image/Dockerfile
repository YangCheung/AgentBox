FROM rust:1.95-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock ./
COPY control-plane/Cargo.toml ./control-plane/
COPY sidecar/Cargo.toml ./sidecar/
COPY cc-sdk-local/ ./cc-sdk-local/

RUN mkdir -p control-plane/src && echo "fn main() {}" > control-plane/src/main.rs
RUN mkdir -p sidecar/src && echo "fn main() {}" > sidecar/src/main.rs
RUN cargo build --release -p sidecar 2>/dev/null || true

COPY sidecar/ ./sidecar/
RUN touch sidecar/src/main.rs
RUN cargo build --release -p sidecar

FROM ubuntu:24.04

# Base OS packages (stable, cached)
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    gnupg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 LTS (stable, cached)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
RUN mkdir -p /workspace/skills

# Sidecar binary (changes with code)
COPY --from=builder /app/target/release/sidecar /usr/local/bin/sidecar

COPY agent-image/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Claude Code (changes frequently, placed last to maximize cache)
ENV NODE_ENV=production
RUN npm install -g @anthropic-ai/claude-code \
    && ARCH=$(uname -m) \
    && if [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; elif [ "$ARCH" = "x86_64" ]; then ARCH="x64"; fi \
    && npm install -g @anthropic-ai/claude-code-linux-${ARCH} \
    && npm cache clean --force

EXPOSE 9000

ENTRYPOINT ["/entrypoint.sh"]
