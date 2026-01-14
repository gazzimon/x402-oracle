use anyhow::Result;
use ethabi::{Token, ethereum_types::U256};
use seda_sdk_rs::{Process, elog, get_reveals, log};

pub fn tally_phase() -> Result<()> {
    let reveals = get_reveals()?;

    let mut prices: Vec<u128> = Vec::new();

    for reveal in reveals {
        let price_bytes_slice: [u8; 16] = match reveal.body.reveal.try_into() {
            Ok(value) => value,
            Err(_err) => {
                elog!("Reveal body could not be cast to u128");
                continue;
            }
        };

        let price = u128::from_le_bytes(price_bytes_slice);
        log!("Received price: {}", price);
        prices.push(price);
    }

    if prices.is_empty() {
        Process::error("No consensus among revealed results".as_bytes());
        return Ok(());
    }

    let final_price = median(prices);
    let result = ethabi::encode(&[Token::Uint(U256::from(final_price))]);
    Process::success(&result);

    Ok(())
}

fn median(mut nums: Vec<u128>) -> u128 {
    nums.sort();
    let middle = nums.len() / 2;

    if nums.len().is_multiple_of(2) {
        return (nums[middle - 1] + nums[middle]) / 2;
    }

    nums[middle]
}
