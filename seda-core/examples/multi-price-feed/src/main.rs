use execution_phase::execution_phase;
use seda_sdk_rs::oracle_program;
use tally_phase::tally_phase;

mod execution_phase;
mod feeds;
mod tally_phase;

#[oracle_program]
impl MultiPriceFeed {
    fn execute() {
        execution_phase().unwrap();
    }

    fn tally() {
        tally_phase().unwrap();
    }
}

/// Finds the median of a list of prices per price report.
pub fn median(data: &[u128]) -> u128 {
    let m = data.len();

    if m == 0 {
        seda_sdk_rs::Process::error("No valid data available for median calculation".as_bytes());
    }

    let mut sorted_data = data.to_vec();
    sorted_data.sort_unstable();

    if m % 2 == 0 {
        // safe average of two u128s without overflow
        let a = sorted_data[m / 2 - 1];
        let b = sorted_data[m / 2];
        a.midpoint(b)
    } else {
        sorted_data[m / 2]
    }
}
