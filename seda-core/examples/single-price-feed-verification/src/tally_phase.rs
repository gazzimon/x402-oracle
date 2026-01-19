use anyhow::Result;
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{HttpFetchMethod, HttpFetchResponse, Process, elog, get_unfiltered_reveals, log};

pub fn tally_phase() -> Result<()> {
    // Retrieve consensus reveals from the tally phase.
    let reveals = get_unfiltered_reveals()?;

    if reveals.len() != 1 {
        elog!(
            "Expected exactly one reveal(replication factor 1), found {}",
            reveals.len()
        );
        return Err(anyhow::anyhow!("Invalid number of reveals"));
    }

    let http_response: HttpFetchResponse = serde_json::from_slice(&reveals[0].body.reveal)?;

    let verified = http_response.proxy_verification(HttpFetchMethod::Get, None)?;

    if !verified {
        elog!("Signature verification failed for the proxy response: {verified}");
        return Err(anyhow::anyhow!("Signature verification failed"));
    }

    // Parse the API response as defined earlier.
    let response_data = serde_json::from_slice::<
        serde_json::value::Map<String, serde_json::value::Value>,
    >(&http_response.bytes)?;

    // Extract the prices for each symbol from the response data.
    let prices = response_data
        .values()
        .map(|price| (price["usd"].as_f64().unwrap_or_default() * 1_000_000f64) as u128)
        .map(U256::from)
        .map(Token::Uint)
        .collect::<Vec<Token>>();
    log!("Fetched prices: {prices:?}");

    // Encode the final median price as a EVM `uint256[]`.
    let result = ethabi::encode(&[Token::Array(prices)]);
    // Report the successful result in the tally phase.
    Process::success(&result);

    Ok(())
}
