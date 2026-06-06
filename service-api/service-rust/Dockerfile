FROM rust:latest as builder

WORKDIR /usr/src/app

COPY service-api/service-rust/Cargo.toml service-api/service-rust/Cargo.lock ./service-rust/

WORKDIR /usr/src/app/service-rust
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

COPY service-api/service-rust/src ./src
RUN touch src/main.rs
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/service-rust/target/release/rust-core .
#COPY config ./config

EXPOSE 8081

ENV RUST_LOG=info

CMD ["./rust-core"]
