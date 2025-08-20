FROM rust:latest as builder

WORKDIR /usr/src/app

COPY rust-core/Cargo.toml rust-core/Cargo.lock ./rust-core/

WORKDIR /usr/src/app/rust-core
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

COPY rust-core/src ./src
RUN touch src/main.rs
RUN cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/rust-core/target/release/rust-core .
#COPY config ./config

EXPOSE 8081

ENV RUST_LOG=info

CMD ["./rust-core"]