use anyhow::Result;
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{Process, elog, get_reveals, log};

pub fn tally_phase() -> Result<()> {
    let reveals = get_reveals()?;
    let mut revealed_prices = Vec::with_capacity(reveals.len());

    for reveal in reveals {
        let price = match reveal.body.reveal.as_slice().try_into() {
            Ok(price) => u128::from_le_bytes(price),
            Err(err) => {
                elog!("Failed to parse revealed prices: {err}");
                continue;
            }
        };

        revealed_prices.push(price);
    }

    if revealed_prices.is_empty() {
        Process::error("No consensus among revealed results".as_bytes());
        return Ok(());
    }

    let final_price = median(&revealed_prices);
    let final_prices = Token::Array(vec![Token::Int(U256::from(final_price))]);
    log!("Final median prices: {final_prices:?}");

    // Output is int256[] with length 1; array is extensible.
    let result = ethabi::encode(&[final_prices]);
    Process::success(&result);

    Ok(())
}

fn median(data: &[u128]) -> u128 {
    let m = data.len();
    if m == 0 {
        Process::error("No valid data available for median calculation".as_bytes());
    }

    let mut sorted_data = data.to_vec();
    sorted_data.sort_unstable();

    if m % 2 == 0 {
        let a = sorted_data[m / 2 - 1];
        let b = sorted_data[m / 2];
        a.midpoint(b)
    } else {
        sorted_data[m / 2]
    }
}
