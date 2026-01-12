use anyhow::Result;
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

#[cfg(not(any(feature = "testnet", feature = "mainnet")))]
pub fn execution_phase() -> Result<()> {
    compile_error!("Either feature \"testnet\" or \"mainnet\" must be enabled");
    Ok(())
}

#[cfg(any(feature = "testnet", feature = "mainnet"))]
pub fn execution_phase() -> Result<()> {
    // Expected to be in the format "symbolA,SymbolB,..." (e.g., "BTC,ETH").
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;

    // If no input is provided, log an error and return.
    if dr_inputs_raw.is_empty() {
        elog!("No input provided for the price feed request.");
        Process::error("No input provided".as_bytes());
        return Ok(());
    }

    // Log the asset pair being fetched as part of the Execution Standard Out.
    log!("Fetching price for asset(s): {dr_inputs_raw}");

    let url = [API_URL, &dr_inputs_raw].concat();
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

    // Parse the API response as defined earlier.
    let response_data = serde_json::from_slice::<
        serde_json::value::Map<String, serde_json::value::Value>,
    >(&response.bytes)?;

    // Extract the prices for each symbol from the response data.
    let mut prices = Vec::with_capacity(response_data.len());
    response_data.values().for_each(|price| {
        prices.push((price["usd"].as_f64().unwrap_or_default() * 1_000_000f64) as u128)
    });
    log!("Fetched prices: {prices:?}");

    // Report the successful result back to the SEDA network.
    let result = serde_json::to_vec(&prices)?;
    Process::success(&result);

    Ok(())
}
