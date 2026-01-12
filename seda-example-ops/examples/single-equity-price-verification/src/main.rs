use execution_phase::execution_phase;
use seda_sdk_rs::{HttpFetchResponse, oracle_program};
use tally_phase::tally_phase;

mod execution_phase;
mod tally_phase;

#[derive(serde::Serialize, serde::Deserialize)]
struct VerificationData {
    symbol: String,
    response: HttpFetchResponse,
}

#[oracle_program]
impl SingleEquityPriceVerification {
    fn execute() {
        execution_phase().unwrap();
    }

    fn tally() {
        tally_phase().unwrap();
    }
}
