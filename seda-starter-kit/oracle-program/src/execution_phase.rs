use anyhow::{Result, anyhow};
use seda_sdk_rs::{
    Process,
    elog,
    http_fetch,
    log,
    http::{HttpFetchMethod, HttpFetchOptions},
    bytes::ToBytes,
};
use serde::Serialize;
use serde_json::json;

const RPC_URL: &str =
    "https://mainnet-sticky.cronoslabs.com/v1/d3642384d334ff6ff1c4baebfdf3ef7d";
const FACTORY_ADDRESS: &str = "0x3b44b2a187a7b3824131f8db5a74194d0a42fc15";
const WCRO_ADDRESS: &str = "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23";
const USDC_ADDRESS: &str = "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59";

const SELECTOR_GET_PAIR: &str = "e6a43905";
const SELECTOR_GET_RESERVES: &str = "0902f1ac";
const SELECTOR_TOKEN0: &str = "0dfe1681";

#[derive(Serialize)]
struct RpcPayload {
    pair_address: String,
    token0: String,
    reserves_result: String,
}

pub fn execution_phase() -> Result<()> {
    #[cfg(not(feature = "test"))]
    if Process::replication_factor() != 1 {
        elog!("Replication factor must be 1 for this oracle program.");
        Process::error("Invalid replication factor".as_bytes());
        return Ok(());
    }

    let inputs = String::from_utf8(Process::get_inputs())?;
    let rpc_url = if inputs.trim().is_empty() {
        RPC_URL.to_string()
    } else {
        inputs.trim().to_string()
    };

    log!("Fetching VVS WCRO/USDC pool from Cronos RPC");

    let get_pair_data = encode_call_with_two_addresses(
        SELECTOR_GET_PAIR,
        WCRO_ADDRESS,
        USDC_ADDRESS,
    );
    let pair_result = rpc_call(&rpc_url, FACTORY_ADDRESS, &get_pair_data)?;
    let pair_address = parse_address_from_32byte(&pair_result)
        .ok_or_else(|| anyhow!("Failed to parse pair address"))?;

    if is_zero_address(&pair_address) {
        elog!("Pair address is zero; WCRO/USDC pool not found.");
        Process::error("WCRO/USDC pool not found".as_bytes());
        return Ok(());
    }

    let token0_result = rpc_call(&rpc_url, &pair_address, SELECTOR_TOKEN0)?;
    let token0 = parse_address_from_32byte(&token0_result)
        .ok_or_else(|| anyhow!("Failed to parse token0 address"))?;

    let reserves_result = rpc_call(&rpc_url, &pair_address, SELECTOR_GET_RESERVES)?;

    let payload = RpcPayload {
        pair_address,
        token0,
        reserves_result,
    };

    // Pass the RPC payload through to the tally phase for parsing.
    Process::success(&serde_json::to_vec(&payload)?);

    Ok(())
}

fn rpc_call(rpc_url: &str, to: &str, data: &str) -> Result<String> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [
            {
                "to": to,
                "data": format!("0x{data}"),
            },
            "latest"
        ]
    });

    let body_bytes = serde_json::to_vec(&body)?;
    let mut headers = std::collections::BTreeMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());

    let options = HttpFetchOptions {
        method: HttpFetchMethod::Post,
        headers,
        body: Some(body_bytes.to_bytes()),
        timeout_ms: Some(5_000),
    };

    let response = http_fetch(rpc_url.to_string(), Some(options));
    if !response.is_ok() {
        elog!(
            "HTTP Response was rejected: {} - {}",
            response.status,
            String::from_utf8(response.bytes)?
        );
        return Err(anyhow!("RPC call failed"));
    }

    let json_value: serde_json::Value = serde_json::from_slice(&response.bytes)?;
    let result = json_value
        .get("result")
        .and_then(|value| value.as_str())
        .ok_or_else(|| anyhow!("RPC response missing result"))?;

    Ok(result.to_string())
}

fn encode_call_with_two_addresses(selector: &str, a: &str, b: &str) -> String {
    let a = strip_0x(a);
    let b = strip_0x(b);
    format!(
        "{selector}{:0>64}{:0>64}",
        a.to_lowercase(),
        b.to_lowercase()
    )
}

fn parse_address_from_32byte(value: &str) -> Option<String> {
    let cleaned = strip_0x(value);
    if cleaned.len() != 64 {
        return None;
    }
    let address = &cleaned[24..];
    Some(format!("0x{address}"))
}

fn strip_0x(value: &str) -> &str {
    value.strip_prefix("0x").unwrap_or(value)
}

fn is_zero_address(address: &str) -> bool {
    strip_0x(address).chars().all(|c| c == '0')
}
