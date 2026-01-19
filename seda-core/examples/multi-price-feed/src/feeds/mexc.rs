use anyhow::Result;

const API_URL: &str = "https://www.mexc.com/open/api/v2/market/ticker?symbol=";

pub fn fetch_token_price(symbol_a: &str, symbol_b: &str) -> Result<f32> {
    let url = format!("{API_URL}{symbol_a}_{symbol_b}");
    crate::feeds::make_request_last_prices("Mexc", url)
}
