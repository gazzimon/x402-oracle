use anyhow::{Result, anyhow};
#[cfg(any(feature = "testnet", feature = "mainnet"))]
use seda_sdk_rs::{Process, elog, log, proxy_http_fetch};

#[cfg(feature = "testnet")]
const API_URL: &str = "http://34.78.7.237:5384/proxy/usd/";
#[cfg(feature = "testnet")]
const PROXY_PUBLIC_KEY: &str = "02ee9686b002e8f57f9a2ca7089a6b587c9ef4e6c2b67159add5151a42ce5e6668";

#[cfg(feature = "mainnet")]
const API_URL: &str = "http://34.77.123.159:5384/proxy/usd/";
#[cfg(feature = "mainnet")]
const PROXY_PUBLIC_KEY: &str = "02095af5db08cef43871a4aa48a80bdddc5249e4234e7432c3d7eca14f31261b10";

const ALLOWED_SYMBOLS: [&str; 3] = ["BTC", "ETH", "SOL"];

fn parse_input_pair(input: &str) -> Result<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("No input provided"));
    }

    if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Some(pair) = value.get("pair").and_then(|v| v.as_str()) {
            return Ok(pair.to_string());
        }
        if let Some(pair) = value.as_str() {
            return Ok(pair.to_string());
        }
    }

    Ok(trimmed.to_string())
}

#[cfg(not(any(feature = "testnet", feature = "mainnet")))]
pub fn execution_phase() -> Result<()> {
    compile_error!("Either feature \"testnet\" or \"mainnet\" must be enabled");
    Ok(())
}

#[cfg(any(feature = "testnet", feature = "mainnet"))]
pub fn execution_phase() -> Result<()> {
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;
    let symbol = parse_input_pair(&dr_inputs_raw)?.to_uppercase();
    if !ALLOWED_SYMBOLS.contains(&symbol.as_str()) {
        elog!("Unsupported symbol: {symbol}");
        Process::error("Unsupported symbol".as_bytes());
        return Ok(());
    }

    log!("Fetching price for asset: {symbol}");

    let url = [API_URL, &symbol].concat();
    let response = proxy_http_fetch(url, Some(PROXY_PUBLIC_KEY.to_string()), None);

    // Handle the case where the HTTP request failed or was rejected.
    if !response.is_ok() {
        elog!(
            "HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        );
        Process::error("Error while fetching symbol prices".as_bytes());
        return Ok(());
    }

    let response_data = serde_json::from_slice::<
        serde_json::value::Map<String, serde_json::value::Value>,
    >(&response.bytes)?;

    let price = response_data
        .get(&symbol.to_lowercase())
        .and_then(|price| price.get("usd"))
        .and_then(|price| price.as_f64())
        .ok_or_else(|| anyhow::anyhow!("Price not found in response"))?;

    let price_lossless = (price * 1_000_000.0) as u128;
    log!("Fetched price: {price_lossless:?}");

    // Scaled 1e6 u128, serialized little-endian for tally.
    Process::success(&price_lossless.to_le_bytes());

    Ok(())
}
