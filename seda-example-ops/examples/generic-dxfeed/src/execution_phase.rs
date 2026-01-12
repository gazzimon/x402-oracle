use anyhow::Result;
#[cfg(any(feature = "testnet", feature = "mainnet"))]
use seda_sdk_rs::{Process, elog, log, proxy_http_fetch};

#[cfg(feature = "testnet")]
const API_URL: &str = "http://98.84.79.123:5384/proxy/";
#[cfg(feature = "testnet")]
const PROXY_PUBLIC_KEY: &str = "0375038bc3e61dc2a52e24ff207a5753e38d020a06fff9efc8ec96875f72f4d081";

#[cfg(feature = "mainnet")]
const API_URL: &str = "http://seda-proxy.dxfeed.com:5384/proxy/";
#[cfg(feature = "mainnet")]
const PROXY_PUBLIC_KEY: &str = "021dd035f760061e2833581d4ab50440a355db0ac98e489bf63a5dbc0e89e4af79";

#[cfg(not(any(feature = "testnet", feature = "mainnet")))]
pub fn execution_phase() -> Result<()> {
    compile_error!("Either feature \"testnet\" or \"mainnet\" must be enabled");
    Ok(())
}

// Quote endpoints /cfd/ /uslf_q/ /fx/ /fx_r/
// {
//   "Quote": {
//     "XAU/USD:BFX": {
//       "askExchangeCode": "",
//       "askPrice": 3313.99,
//       "askSize": 100,
//       "askTime": 1753710744000,
//       "bidExchangeCode": "",
//       "bidPrice": 3313.83,
//       "bidSize": 100,
//       "bidTime": 1753710744000,
//       "eventSymbol": "XAU/USD:BFX",
//       "eventTime": 0,
//       "sequence": 0,
//       "timeNanoPart": 0
//     }
//   },
//   "status": "OK"
// }

// Equity /equity/ /uslf_t/
// {
// 	"Trade": {
// 		"AAPL:USLF24": {
// 			"change": 0,
// 			"dayId": 20297,
// 			"dayTurnover": 12405806.53,
// 			"dayVolume": 57773,
// 			"eventSymbol": "AAPL:USLF24",
// 			"eventTime": 0,
// 			"exchangeCode": "V",
// 			"extendedTradingHours": true,
// 			"price": 213.89,
// 			"sequence": 1071,
// 			"size": 100,
// 			"tickDirection": "ZERO_DOWN",
// 			"time": 1753473599903,
// 			"timeNanoPart": 0
// 		}
// 	},
// 	"status": "OK"
// }

const ASSET_TYPES: [&str; 6] = ["cfd", "equity", "fx", "fx_r", "uslf_q", "uslf_t"];

#[derive(serde::Deserialize)]
struct QuoteResponse {
    #[serde(rename = "Quote")]
    quote: serde_json::value::Map<String, serde_json::value::Value>,
}

#[derive(serde::Deserialize)]
struct TradeResponse {
    #[serde(rename = "Trade")]
    trade: serde_json::value::Map<String, serde_json::value::Value>,
}

#[cfg(any(feature = "testnet", feature = "mainnet"))]
pub fn execution_phase() -> Result<()> {
    // Expected to be in the format "symbol,..." (e.g., "cfd/XAU/USD", "equity/AAPL")
    use seda_sdk_rs::HttpFetchOptions;
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;

    // If no input is provided, log an error and return.
    if dr_inputs_raw.is_empty() {
        elog!("No input provided for the commodity price request.");
        Process::error("No input provided".as_bytes());
    }

    // If the input is not in the expected format, log an error and return.
    // split at the first /
    let (asset_type, symbol) = dr_inputs_raw.split_once('/').ok_or_else(|| {
        elog!("Invalid input format. Expected format: 'fx/SYMBOL/CURRENCY' or 'equity/SYMBOL'");
        Process::error("Invalid input format".as_bytes());
        anyhow::anyhow!("Invalid input format")
    })?;

    if !ASSET_TYPES.contains(&asset_type) {
        elog!("Invalid asset type. Expected one of: {:?}", ASSET_TYPES);
        Process::error("Invalid asset type".as_bytes());
        return Ok(());
    }
    log!("Fetching price for asset type: {asset_type}, symbol: {symbol}");

    let url = [API_URL, asset_type, "/", symbol].concat();
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
            "HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        );
        Process::error("Error while fetching commodity price".as_bytes());
        return Ok(());
    }

    let path = match asset_type {
        "cfd" => format!("{symbol}:BFX"),
        "equity" => symbol.to_string(),
        "fx" => format!("{symbol}/USD"),
        "fx_r" => format!("USD/{symbol}"),
        "uslf_q" | "uslf_t" => format!("{symbol}:USLF24"),
        _ => unreachable!(),
    };

    // Parse the API response as defined earlier.
    let price = match asset_type {
        "cfd" | "fx" | "fx_r" | "uslf_q" => {
            serde_json::from_slice::<QuoteResponse>(&response.bytes)?
                .quote
                .get(&path)
                .and_then(|quote| quote.get("askPrice"))
                .and_then(|price| price.as_f64())
        }
        "equity" | "uslf_t" => serde_json::from_slice::<TradeResponse>(&response.bytes)?
            .trade
            .get(&path)
            .and_then(|quote| quote.get("price"))
            .and_then(|price| price.as_f64()),
        _ => unreachable!(),
    }
    .ok_or_else(|| anyhow::anyhow!("Price not found in response"))?;

    let price_lossless = (price * 100.0) as u128;
    log!("Fetched price: {price_lossless:?}");

    // Report the successful result back to the SEDA network.
    Process::success(&price_lossless.to_le_bytes());

    Ok(())
}
