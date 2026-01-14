.PHONY: build check clean fmt

clean:
	cargo clean

fmt:
	cargo +nightly fmt --all

fmt-check:
	cargo +nightly fmt --all -- --check

check:
	cargo clippy --all-features --locked -- -D warnings

build:
	cargo build --manifest-path oracle-program/Cargo.toml --target wasm32-wasip1 --profile release-wasm
	wasm-strip oracle-program/target/wasm32-wasip1/release-wasm/vvs-wcro-usdc-oracle.wasm;
	wasm-opt -Oz --enable-bulk-memory oracle-program/target/wasm32-wasip1/release-wasm/vvs-wcro-usdc-oracle.wasm -o oracle-program/target/wasm32-wasip1/release-wasm/vvs-wcro-usdc-oracle.wasm;

install-tools:
	bun install
