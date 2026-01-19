use anyhow::Result;
#[cfg(any(feature = "testnet", feature = "mainnet"))]
use seda_sdk_rs::{Process, elog, log, proxy_http_fetch};

// Version 3.0 - Dynamic symbol support for any Nobi Labs endpoint
const ORACLE_VERSION: &str = "3.0";

#[cfg(feature = "testnet")]
const API_URL: &str = "http://43.157.108.162:5384/proxy/price?code=";
#[cfg(feature = "testnet")]
const PROXY_PUBLIC_KEY: &str = "0268da5dbf3c31908884c0c95096ad50c5d1a98fd3846529f9513ddcc08d37e06c";

#[cfg(feature = "mainnet")]
const API_URL: &str = "http://seda.labs.usenobi.com:5384/proxy/price?code=";
#[cfg(feature = "mainnet")]
const PROXY_PUBLIC_KEY: &str = "03aa3acda2feea7f55c7cfdfc1b906c741cb98d1ad80653b0a199555021134ee22";

#[cfg(not(any(feature = "testnet", feature = "mainnet")))]
pub fn execution_phase() -> Result<()> {
    compile_error!("Either feature \"testnet\" or \"mainnet\" must be enabled");
    Ok(())
}

#[cfg(any(feature = "testnet", feature = "mainnet"))]
pub fn execution_phase() -> Result<()> {
    // Expected to be in the format "symbolA,SymbolB,..." (e.g., "Crypto:ALL:BTC/USDT,Rates:US:US10Y").
    // Supports any Nobi Labs symbol format.
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;

    if dr_inputs_raw.is_empty() {
        // If no input is provided, log an error and return.
        elog!("No input provided for the price feed request.");
        Process::error("No input provided".as_bytes());
        return Ok(());
    }

    // Log the asset pair being fetched as part of the Execution Standard Out.
    log!("Oracle Version: {ORACLE_VERSION} - Fetching price for asset(s): {dr_inputs_raw}");

    // Split the input by comma to handle multiple symbols
    let symbols: Vec<&str> = dr_inputs_raw.split(',').collect();
    let mut prices = Vec::with_capacity(symbols.len());

    for symbol in symbols {
        use seda_sdk_rs::HttpFetchOptions;

        let trimmed_symbol = symbol.trim();
        let url = [API_URL, trimmed_symbol].concat();
        let response = proxy_http_fetch(
            url,
            Some(PROXY_PUBLIC_KEY.to_string()),
            Some(HttpFetchOptions {
                method: seda_sdk_rs::HttpFetchMethod::Get,
                headers: Default::default(),
                body: None,
                timeout_ms: Some(20_000),
            }),
        );

        // Handle the case where the HTTP request failed or was rejected.
        if !response.is_ok() {
            elog!(
                "HTTP Response was rejected for symbol {trimmed_symbol}: {} - {} ProxyPubKey {PROXY_PUBLIC_KEY}",
                response.status,
                String::from_utf8(response.bytes)?
            );
            Process::error("Error while fetching symbol prices".as_bytes());
            return Ok(());
        }

        // Parse the Nobi Labs API response format
        let response_data = serde_json::from_slice::<
            serde_json::value::Map<String, serde_json::value::Value>,
        >(&response.bytes)?;

        // Check if the response contains an error
        if let Some(message) = response_data.get("message")
            && message != "null"
        {
            elog!(
                "API Error for symbol {trimmed_symbol}: {}",
                message.as_str().unwrap_or("Unknown error")
            );
            Process::error("API error while fetching symbol prices".as_bytes());
            return Ok(());
        }

        // Extract the price from the Nobi Labs response format
        // The price is in the data.price field
        let price = response_data
            .get("data")
            .and_then(|data| data.get("price"))
            .and_then(|price| price.as_str())
            .and_then(|price_str| price_str.parse::<f64>().ok())
            .ok_or_else(|| {
                anyhow::anyhow!("Price not found in response for symbol {trimmed_symbol}")
            })?;
        let price_micro = (price * 1_000_000.0) as u128;
        prices.push(price_micro);
    }

    log!("Fetched prices: {prices:?}");

    let result = serde_json::to_vec(&prices)?;

    // Report the successful result back to the SEDA network.
    Process::success(&result);

    Ok(())
}
