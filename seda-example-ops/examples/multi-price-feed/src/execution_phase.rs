use anyhow::{Context, Result};
use seda_sdk_rs::{Process, elog, log};

pub fn execution_phase() -> Result<()> {
    // Expected to be in the format "symbolA-SymbolB,..." (e.g., "BTC-USDT").
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;
    log!("Fetching price for pair: {dr_inputs_raw}");

    let dr_inputs: Vec<&str> = dr_inputs_raw.split("-").collect();
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

    // Report the successful result back to the SEDA network.
    Process::success(&median_price.to_le_bytes());

    Ok(())
}
