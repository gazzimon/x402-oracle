use anyhow::Result;
#[cfg(any(feature = "testnet", feature = "mainnet"))]
use seda_sdk_rs::{Process, elog, http_fetch, log};

// Response:
// {
//     "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v":{
//        "usdPrice":0.996,
//        "blockId":365626874,
//        "decimals":9,
//        "priceChange24h":0.03667753493441
//     }
//  }

pub fn execution_phase() -> Result<()> {
    // Expected to be in the format "tokenContractAddressA,..." (e.g., "So11111111111111111111111111111111111111112").
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;

    // If no input is provided, log an error and return.
    if dr_inputs_raw.is_empty() {
        elog!("No input provided for the price feed request.");
        Process::error("No input provided".as_bytes());
        return Ok(());
    }

    // Log the asset pair being fetched as part of the Execution Standard Out.
    log!("Fetching price for asset: {dr_inputs_raw}");

    let url: String = ["https://lite-api.jup.ag/price/v3?ids=", &dr_inputs_raw].concat();
    let response = http_fetch(url, None);

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
    let price = if let Some(price_data) = response_data.get(&dr_inputs_raw) {
        price_data["usdPrice"].as_f64().unwrap_or_default()
    } else {
        elog!("Price not found for token: {}", dr_inputs_raw);
        Process::error("Token price not found".as_bytes());
        return Ok(());
    };

    log!("Fetched price: {price:?}");

    // Report the successful result back to the SEDA network.
    Process::success(&price.to_le_bytes());

    Ok(())
}
