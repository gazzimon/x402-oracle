use anyhow::Result;
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{HttpFetchMethod, Process, elog, get_unfiltered_reveals, log};

use crate::VerificationData;

// {
// 	"Quote": {
// 		"AAPL:USLF24": {
// 			"askExchangeCode": "U",
// 			"askPrice": 214.44,
// 			"askSize": 123,
// 			"askTime": 1753707742000,
// 			"bidExchangeCode": "U",
// 			"bidPrice": 214.2,
// 			"bidSize": 157,
// 			"bidTime": 1753707657000,
// 			"eventSymbol": "AAPL:USLF24",
// 			"eventTime": 0,
// 			"sequence": 0,
// 			"timeNanoPart": 0
// 		}
// 	},
// 	"status": "OK"
// }

#[derive(serde::Deserialize)]
struct EquityPriceResponse {
    #[serde(rename = "Quote")]
    quote: serde_json::value::Map<String, serde_json::value::Value>,
}

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

    let data: VerificationData = serde_json::from_slice(&reveals[0].body.reveal)?;

    let verified = data
        .response
        .proxy_verification(HttpFetchMethod::Get, None)?;

    if !verified {
        elog!("Signature verification failed for the proxy response: {verified}");
        return Err(anyhow::anyhow!("Signature verification failed"));
    }

    // Parse the API response as defined earlier.
    let response_data = serde_json::from_slice::<EquityPriceResponse>(&data.response.bytes)?;

    let price = response_data
        .quote
        .get(&format!("{}:USLF24", data.symbol))
        .and_then(|quote| quote.get("askPrice"))
        .and_then(|price| price.as_f64())
        .ok_or_else(|| anyhow::anyhow!("Price not found in response"))?;
    let price_lossless = Token::Uint(U256::from((price * 100.0) as u128));
    log!("Fetched price: {price_lossless:?}");

    // Encode the price as a EVM `uint256`.
    let result = ethabi::encode(&[price_lossless]);

    // Report the successful result in the tally phase.
    Process::success(&result);

    Ok(())
}
