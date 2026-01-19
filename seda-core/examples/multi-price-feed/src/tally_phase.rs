use anyhow::Result;
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{Process, elog, get_reveals, log};

pub fn tally_phase() -> Result<()> {
    // Retrieve consensus reveals from the tally phase.
    let reveals = get_reveals()?;
    let mut revealed_prices: Vec<u128> = Vec::with_capacity(reveals.len());

    // Iterate over each reveal, parse its content as an unsigned integer (u128), and store it in the prices array.
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

    // If no valid prices were revealed, report an error indicating no consensus.
    if revealed_prices.is_empty() {
        Process::error("No consensus among revealed results".as_bytes());
        return Ok(());
    }

    // If there are valid prices revealed, calculate the median price from price reports.
    let final_prices = Token::Uint(U256::from(crate::median(&revealed_prices)));
    log!("Final median prices: {final_prices:?}");

    // Encode the final median price as a EVM `uint256`.
    let result = ethabi::encode(&[final_prices]);
    // Report the successful result in the tally phase.
    Process::success(&result);

    Ok(())
}
