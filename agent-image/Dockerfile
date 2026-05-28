FROM rust:1.95-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml ./
COPY control-plane/Cargo.toml ./control-plane/
COPY sidecar/Cargo.toml ./sidecar/

RUN mkdir -p control-plane/src && echo "fn main() {}" > control-plane/src/main.rs
RUN mkdir -p sidecar/src && echo "fn main() {}" > sidecar/src/main.rs
RUN cargo build --release -p sidecar 2>/dev/null || true

COPY sidecar/ ./sidecar/
RUN touch sidecar/src/main.rs
RUN cargo build --release -p sidecar

FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
RUN npm install -g @anthropic-ai/claude-code \
    && npm cache clean --force

WORKDIR /workspace

COPY --from=builder /app/target/release/sidecar /usr/local/bin/sidecar

COPY agent-image/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
