use anyhow::{Context, Result, anyhow};
use serde_json::Value;
use seda_sdk_rs::{Process, elog, log};

const ALLOWED_PAIRS: [&str; 5] = ["BTC-USD", "ETH-USD", "SOL-USD", "BTC-USDT", "ETH-USDT"];

fn parse_pair_input(raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("Missing input for price pair"));
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        if let Some(pair) = value.get("pair").and_then(|v| v.as_str()) {
            return Ok(pair.to_string());
        }
        if let Some(pair) = value.as_str() {
            return Ok(pair.to_string());
        }
    }

    Ok(trimmed.to_string())
}

pub fn execution_phase() -> Result<()> {
    // Expected to be in the format "symbolA-SymbolB,..." (e.g., "BTC-USDT").
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;
    let pair = parse_pair_input(&dr_inputs_raw)?.to_uppercase();
    if !ALLOWED_PAIRS.contains(&pair.as_str()) {
        elog!("Unsupported pair: {pair}");
        Process::error("Unsupported pair".as_bytes());
        return Ok(());
    }
    log!("Fetching price for pair: {pair}");

    let dr_inputs: Vec<&str> = pair.split("-").collect();
    let symbol_a = dr_inputs
        .first()
        .context("format should be tokenA-tokenB")?
        .to_uppercase();
    let symbol_b = dr_inputs
        .get(1)
        .context("format should be tokenA-tokenB")?
        .to_uppercase();

    let mut prices = Vec::with_capacity(3);
    let decimals: f32 = 1_000_000.0;

    // Fetch prices from multiple feeds.
    // Each feed is expected to return a price in the format of f32.
    // The prices are then multiplied by `decimals` to convert them to a u128
    for response in [
        crate::feeds::binance::fetch_token_price(&symbol_a, &symbol_b),
        crate::feeds::mexc::fetch_token_price(&symbol_a, &symbol_b),
        crate::feeds::okx::fetch_token_price(&symbol_a, &symbol_b),
    ] {
        match response {
            Ok(price) => {
                log!("Got reported price: {price}");
                prices.push((price * decimals) as u128);
            }
            // If any of the responses fail, log the error and continue.
            Err(error) => {
                elog!("Response returned error: {error}");
            }
        }
    }

    let median_price = crate::median(&prices);
    log!("Median price: {median_price}");

    // Scaled 1e6 u128, serialized little-endian for tally.
    Process::success(&median_price.to_le_bytes());

    Ok(())
}
