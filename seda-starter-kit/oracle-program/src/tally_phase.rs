use anyhow::{Result, anyhow};
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{Process, elog, get_unfiltered_reveals, log};
use serde::Deserialize;

pub fn tally_phase() -> Result<()> {
    let reveals = get_unfiltered_reveals()?;

    if reveals.len() != 1 {
        elog!(
            "Expected exactly one reveal (replication factor 1), found {}",
            reveals.len()
        );
        return Err(anyhow!("Invalid number of reveals"));
    }

    let payload: RpcPayload = serde_json::from_slice(&reveals[0].body.reveal)?;

    let reserves_bytes = hex_to_bytes(&payload.reserves_result)
        .ok_or_else(|| anyhow!("Failed to parse reserves hex"))?;
    if reserves_bytes.len() < 64 {
        return Err(anyhow!("Reserves result too short"));
    }

    let reserve0 = u256_from_be_slice(&reserves_bytes[0..32]);
    let reserve1 = u256_from_be_slice(&reserves_bytes[32..64]);

    let token0 = payload.token0.to_lowercase();
    let wcro = WCRO_ADDRESS.to_lowercase();
    let usdc = USDC_ADDRESS.to_lowercase();

    let (wcro_reserve, usdc_reserve) = if token0 == wcro {
        (reserve0, reserve1)
    } else if token0 == usdc {
        (reserve1, reserve0)
    } else {
        return Err(anyhow!("token0 is not WCRO or USDC"));
    };

    if wcro_reserve.is_zero() {
        return Err(anyhow!("WCRO reserve is zero"));
    }

    // price_scaled = (usdc_reserve / 1e6) / (wcro_reserve / 1e18) * 1e8
    //             = usdc_reserve * 1e20 / wcro_reserve
    let scale = U256::from_dec_str("100000000000000000000")
        .expect("scale fits in U256");
    let price_scaled = usdc_reserve.saturating_mul(scale) / wcro_reserve;

    log!("Computed WCRO/USD price (scaled 1e8): {price_scaled}");

    let result = ethabi::encode(&[Token::Uint(price_scaled)]);
    Process::success(&result);

    Ok(())
}

#[derive(Deserialize)]
struct RpcPayload {
    pair_address: String,
    token0: String,
    reserves_result: String,
}

const WCRO_ADDRESS: &str = "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23";
const USDC_ADDRESS: &str = "0xc21223249CA28397B4B6541dfFaEcC539BfF0c59";

fn hex_to_bytes(value: &str) -> Option<Vec<u8>> {
    let cleaned = value.strip_prefix("0x").unwrap_or(value);
    if cleaned.len() % 2 != 0 {
        return None;
    }
    (0..cleaned.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&cleaned[i..i + 2], 16).ok())
        .collect()
}

fn u256_from_be_slice(slice: &[u8]) -> U256 {
    let mut padded = [0u8; 32];
    let start = 32usize.saturating_sub(slice.len());
    padded[start..].copy_from_slice(slice);
    U256::from_big_endian(&padded)
}
