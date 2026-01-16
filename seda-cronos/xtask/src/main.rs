use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand, ValueEnum};
use xshell::{Cmd, Shell, cmd};

/// A command-line tool for managing  the example SEDA oracle programs.
#[derive(Parser)]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

/// The oracle programs that can be managed.
#[derive(Clone, Subcommand)]
enum OracleProgram {
    JupPriceFeed,
    BlocksizeBidask,
    BlocksizeVwap,
    CaplightEodMarketPrice {
        #[arg(long, default_value_t = false)]
        str_format: bool,
    },
    EvmPriceFeed,
    GenericDxfeed,
    MultiPriceFeed,
    SingleCommodityPrice,
    SingleEquityPrice,
    SingleEquityPriceVerification,
    SinglePriceFeed,
    SinglePriceFeedVerification,
    UsRates,
}

impl OracleProgram {
    fn as_str(&self) -> &str {
        match self {
            OracleProgram::BlocksizeBidask => "blocksize-bidask",
            OracleProgram::JupPriceFeed => "jup-price-feed",
            OracleProgram::BlocksizeVwap => "blocksize-vwap",
            OracleProgram::CaplightEodMarketPrice { str_format: _ } => "caplight-eod-market-price",
            OracleProgram::EvmPriceFeed => "evm-price-feed",
            OracleProgram::GenericDxfeed => "generic-dxfeed",
            OracleProgram::MultiPriceFeed => "multi-price-feed",
            OracleProgram::SingleCommodityPrice => "single-commodity-price",
            OracleProgram::SingleEquityPrice => "single-equity-price",
            OracleProgram::SingleEquityPriceVerification => "single-equity-price-verification",
            OracleProgram::SinglePriceFeed => "single-price-feed",
            OracleProgram::SinglePriceFeedVerification => "single-price-feed-verification",
            OracleProgram::UsRates => "us-rates",
        }
    }
}

/// The networks that can have a data request posted to them.
/// Note: Currently, only Seda networks are supported for posting data requests.
#[derive(Clone, ValueEnum)]
enum DxfeedSymbol {
    Commodity,
    Equity,
    Fx,
    FxR,
    UslfQ,
    UslfT,
}

/// The oracle programs that can have a data request posted to a network.
#[derive(Subcommand)]
enum PostableOracleProgram {
    JupPriceFeed {
        symbol: String,
    },
    BlocksizeBidask {
        symbol: String,
    },
    BlocksizeVwap {
        pair: String,
    },
    CaplightEodMarketPrice {
        #[arg(long, default_value_t = false)]
        str_result: bool,
        /// The project ID to fetch prices for.
        project_id: String,
    },
    GenericDxfeed {
        /// The asset type to fetch prices for (either "commodity", "equity", or an "fx" pair).
        asset_type: DxfeedSymbol,
        /// The symbol to fetch prices for (e.g., AAPL, XAU, etc.)
        symbol: String,
    },
    SingleCommodityPrice {
        /// A singular commodity symbol to fetch prices for (e.g., XAU, BRN, etc.)
        symbol: String,
    },
    SingleEquityPrice {
        /// A singular equity symbol to fetch prices for (e.g., AAPL/GOOGL/etc.)
        symbol: String,
    },
    SingleEquityPriceVerification {
        /// A singular equity symbol to fetch prices for (e.g., AAPL/GOOGL/etc.)
        symbol: String,
    },
    MultiPriceFeed {
        /// A price pair of symbols to fetch prices for (e.g., BTC-USDT, ETH-USD)
        symbols: String,
    },
    SinglePriceFeed {
        /// Comma-separated list of symbols to fetch prices for (e.g., BTC,ETH)
        symbols: String,
    },
    SinglePriceFeedVerification {
        /// Comma-separated list of symbols to fetch prices for (e.g., BTC,ETH)
        symbols: String,
    },
    EvmPriceFeed {
        /// A list of price pair of symbols to fetch prices for (e.g., BTC-USDT, ETH-USD)
        symbols: String,
    },
    UsRates {
        /// A list of US interest rate symbols to fetch prices for (e.g., Crypto:ALL:BTC/USDT, Rates:US:US10Y)
        symbols: String,
    },
}

/// The networks that the oracle programs can be compiled and deployed to.
#[derive(Clone, ValueEnum)]
enum SedaNetwork {
    Testnet,
    Mainnet,
    Test,
}

impl SedaNetwork {
    fn as_str(&self) -> &str {
        match self {
            SedaNetwork::Testnet => "env-testnet",
            SedaNetwork::Mainnet => "env-mainnet",
            SedaNetwork::Test => "test",
        }
    }
}

/// The networks that can have a data request posted to them.
/// Note: Currently, only Seda networks are supported for posting data requests.
#[derive(Clone, ValueEnum)]
enum PostableNetwork {
    // Ethereum,
    // EthereumTestnet,
    SedaTestnet,
    Seda,
}

#[derive(clap::Args)]
struct PostDataRequest {
    /// The ID of the oracle program to post the data request for.
    /// This is required and should be the program ID as a string.
    #[clap(global = true, short, long)]
    id: Option<String>,
    /// The replication factor for the data request.
    /// This is optional and defaults to 1 if not provided.
    #[clap(global = true, short, long)]
    replication_factor: Option<u8>,
    /// The gas price to use for the data request.
    /// This is optional and can be specified to control the gas price for the transaction.
    /// If not provided, the default gas price will be used.
    #[clap(global = true, short, long)]
    gas_price: Option<u64>,
    /// The execution gas limit for the data request.
    /// This is optional and can be specified to control the gas limit for the execution phase.
    /// If not provided, the default execution gas limit will be used.
    #[arg(global = true, short, long)]
    exec_gas_limit: Option<u128>,
    /// The tally gas limit for the data request.
    /// This is optional and can be specified to control the gas limit for the tally phase.
    /// If not provided, the default tally gas limit will be used.
    #[arg(global = true, short, long)]
    tally_gas_limit: Option<u128>,
    /// The network to post the data request to.
    #[arg(global = true, short, long, value_enum, default_value_t = PostableNetwork::SedaTestnet)]
    network: PostableNetwork,
    /// The oracle program to post the data request for.
    #[command(subcommand)]
    oracle_program: PostableOracleProgram,
}

#[derive(Subcommand)]
enum Commands {
    /// Compile an oracle program for a specific Seda network.
    Compile {
        /// The oracle program to compile.
        #[command(subcommand)]
        oracle_program: OracleProgram,
        /// The Seda network to compile the oracle program for.
        #[arg(value_enum, default_value_t = SedaNetwork::Testnet)]
        network: SedaNetwork,
    },
    /// Deploy an oracle program to a specific Seda network.
    Deploy {
        /// The oracle program to deploy.
        #[command(subcommand)]
        oracle_program: OracleProgram,
        /// The Seda network to deploy the oracle program to.
        #[arg(global = true, short, long, value_enum, default_value_t = SedaNetwork::Testnet)]
        network: SedaNetwork,
    },
    /// Install necessary tools for working with SEDA oracle programs.
    InstallTools,
    /// Post a data request for a specified oracle program on a network.
    #[clap(alias = "post-dr")]
    PostDataRequest(PostDataRequest),
    /// Test an oracle program.
    #[clap(alias = "test-op")]
    TestOracleProgram {
        /// The oracle program to test.
        #[command(subcommand)]
        oracle_program: OracleProgram,
        /// The test name pattern to use.
        test_name_pattern: Option<String>,
    },
    /// Test all oracle programs.
    #[clap(alias = "test-all-ops")]
    TestAllOraclePrograms {
        /// The test name pattern to use.
        test_name_pattern: Option<String>,
    },
}

/// The main entry point where we exit with an error if any operation fails.
fn main() {
    if let Err(e) = try_main() {
        eprintln!("{e}");
        std::process::exit(1);
    }
}

/// The main function that executes the command-line interface for managing SEDA oracle programs.
fn try_main() -> Result<()> {
    // Ensure our working directory is the SEDA workspace root.
    {
        let manifest_dir =
            std::env::var("CARGO_MANIFEST_DIR").with_context(|| "Reading CARGO_MANIFEST_DIR")?;
        let workspace_dir = Path::new(&manifest_dir)
            .parent()
            .with_context(|| "Locating workspace directory")?;

        let git_root = Command::new("git")
            .args(["rev-parse", "--show-toplevel"])
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    String::from_utf8(output.stdout)
                        .ok()
                        .map(|path| PathBuf::from(path.trim()))
                } else {
                    None
                }
            });

        let target_dir = git_root
            .filter(|root| root.join("Cargo.toml").exists())
            .unwrap_or_else(|| workspace_dir.to_path_buf());

        std::env::set_current_dir(&target_dir)
            .with_context(|| format!("Changing to {}", target_dir.display()))?;
    }

    dotenvy::dotenv().ok();

    let sh = Shell::new()?;
    let cli = Cli::parse();
    match cli.command {
        Commands::Compile {
            oracle_program,
            network,
        } => compile_op(&sh, &oracle_program, &network),
        Commands::Deploy {
            oracle_program,
            network,
        } => deploy_op(&sh, &network, &oracle_program),
        Commands::InstallTools => install_tools(&sh),
        Commands::PostDataRequest(args) => args.post_dr(&sh),
        Commands::TestOracleProgram {
            oracle_program,
            test_name_pattern,
        } => test_op(&sh, &oracle_program, test_name_pattern.as_deref()),
        Commands::TestAllOraclePrograms { test_name_pattern } => {
            let programs = [
                OracleProgram::BlocksizeBidask,
                OracleProgram::BlocksizeVwap,
                OracleProgram::CaplightEodMarketPrice { str_format: false },
                OracleProgram::GenericDxfeed,
                OracleProgram::EvmPriceFeed,
                OracleProgram::MultiPriceFeed,
                OracleProgram::SingleCommodityPrice,
                OracleProgram::SingleEquityPrice,
                OracleProgram::SingleEquityPriceVerification,
                OracleProgram::SinglePriceFeed,
                OracleProgram::SinglePriceFeedVerification,
                OracleProgram::UsRates,
            ];
            for program in programs {
                // ignore errors so we run tests for all programs
                test_op(&sh, &program, test_name_pattern.as_deref()).ok();
            }
            Ok(())
        }
    }
}

/// Compile a specified oracle program for a specific Seda network.
fn compile_op(
    sh: &Shell,
    oracle_program: &OracleProgram,
    seda_network: &SedaNetwork,
) -> Result<()> {
    let program_name = oracle_program.as_str();
    let seda_network = seda_network.as_str();

    if let OracleProgram::CaplightEodMarketPrice { str_format } = oracle_program {
        if *str_format {
            cmd!(
                sh,
                "cargo build --target wasm32-wasip1 --release -p {program_name} --no-default-features --features {seda_network},str-result"
            )
            .run()?;
        } else {
            cmd!(
                sh,
                "cargo build --target wasm32-wasip1 --release -p {program_name} --no-default-features --features {seda_network},eth-result"
            )
            .run()?;
        }
    } else {
        cmd!(
            sh,
            "cargo build --target wasm32-wasip1 --release -p {program_name} --no-default-features --features {seda_network}"
        )
        .run()?;
    };
    let wasm_strip_cmd = std::env::var("WASM_STRIP").unwrap_or_else(|_| "wasm-strip".to_string());
    let wasm_opt_cmd = std::env::var("WASM_OPT").unwrap_or_else(|_| "wasm-opt".to_string());

    cmd!(
        sh,
        "{wasm_strip_cmd} target/wasm32-wasip1/release/{program_name}.wasm"
    )
    .run()?;

    cmd!(sh, "{wasm_opt_cmd}")
        .arg("-Oz")
        .arg("--enable-bulk-memory")
        .arg("--enable-sign-ext")
        .arg(format!(
            "target/wasm32-wasip1/release/{program_name}.wasm"
        ))
        .arg("-o")
        .arg(format!(
            "target/wasm32-wasip1/release/{program_name}.wasm"
        ))
        .run()?;
    Ok(())
}

/// Deploy a specified oracle program to a Seda network.
fn deploy_op(sh: &Shell, seda_network: &SedaNetwork, oracle_program: &OracleProgram) -> Result<()> {
    // These env vars are used by the `seda-sdk` CLI tool to connect to the Seda network.
    let (rpc, explorer, mnemonic) = match seda_network {
        SedaNetwork::Testnet => (
            "https://rpc.testnet.seda.xyz",
            "https://testnet.explorer.seda.xyz",
            std::env::var("SEDA_MNEMONIC_TESTNET")?,
        ),
        SedaNetwork::Mainnet => (
            "https://rpc.seda.xyz",
            "https://explorer.seda.xyz",
            std::env::var("SEDA_MNEMONIC_MAINNET")?,
        ),
        SedaNetwork::Test => unreachable!(),
    };

    compile_op(sh, oracle_program, seda_network)?;

    let program_name = oracle_program.as_str();
    cmd!(
        sh,
        "bunx seda-sdk oracle-program upload ./target/wasm32-wasip1/release/{program_name}.wasm"
    )
    .env("SEDA_RPC_ENDPOINT", rpc)
    .env("SEDA_EXPLORER_URL", explorer)
    .env("SEDA_MNEMONIC", mnemonic)
    .run()?;
    Ok(())
}

/// Install necessary tools for working with SEDA oracle programs.
fn install_tools(sh: &Shell) -> Result<()> {
    // check if bun is installed
    if Command::new("bun").arg("--version").output().is_err() {
        bail!("Bun is not installed. Please install Bun to continue.");
    }

    cmd!(sh, "bun install").run()?;
    Ok(())
}

impl PostDataRequest {
    /// Post a data request for a specified oracle program on a network.
    /// With the specified ID and replication factor.
    fn post_dr(self, sh: &Shell) -> Result<()> {
        let id = self
            .id
            .ok_or_else(|| anyhow::anyhow!("Oracle program ID is required"))?;

        let (rpc, explorer, mnemonic) = match self.network {
            PostableNetwork::SedaTestnet => (
                "https://rpc.testnet.seda.xyz",
                "https://testnet.explorer.seda.xyz",
                std::env::var("SEDA_MNEMONIC_TESTNET")?,
            ),
            PostableNetwork::Seda => (
                "https://rpc.seda.xyz",
                "https://explorer.seda.xyz",
                std::env::var("SEDA_MNEMONIC_MAINNET")?,
            ),
        };

        let cmd = sh
            .cmd("bun")
            .env("SEDA_RPC_ENDPOINT", rpc)
            .env("SEDA_EXPLORER_URL", explorer)
            .env("SEDA_MNEMONIC", mnemonic)
            .arg("run")
            .arg("./scripts/post-dr.ts")
            .arg("--oracle-program-id")
            .arg(id)
            .arg("--replication-factor")
            .arg(self.replication_factor.unwrap_or(1).to_string());

        let cmd = if let Some(gas_price) = self.gas_price {
            cmd.arg("--gas-price").arg(gas_price.to_string())
        } else {
            cmd
        };

        let cmd = if let Some(exec_gas_limit) = self.exec_gas_limit {
            cmd.arg("--exec-gas-limit").arg(exec_gas_limit.to_string())
        } else {
            cmd
        };

        let cmd = if let Some(tally_gas_limit) = self.tally_gas_limit {
            cmd.arg("--tally-gas-limit")
                .arg(tally_gas_limit.to_string())
        } else {
            cmd
        };

        match self.oracle_program {
            PostableOracleProgram::JupPriceFeed { symbol } => post_jup_price_feed(cmd, &symbol),
            PostableOracleProgram::BlocksizeBidask { symbol } => {
                post_blocksize_bidask(cmd, &symbol)
            }
            PostableOracleProgram::BlocksizeVwap { pair } => post_blocksize_vwap(cmd, &pair),
            PostableOracleProgram::CaplightEodMarketPrice {
                str_result,
                project_id,
            } => post_caplight_eod_market_price(cmd, &project_id, str_result),
            PostableOracleProgram::GenericDxfeed { asset_type, symbol } => {
                post_equity_or_commodity_price(cmd, asset_type, &symbol)
            }
            PostableOracleProgram::SingleCommodityPrice { symbol } => {
                post_single_commodity_price(cmd, &symbol)
            }
            PostableOracleProgram::SingleEquityPrice { symbol }
            | PostableOracleProgram::SingleEquityPriceVerification { symbol } => {
                post_single_equity_price(cmd, &symbol)
            }
            PostableOracleProgram::MultiPriceFeed { symbols } => {
                post_multi_price_feed(cmd, &symbols)
            }
            PostableOracleProgram::SinglePriceFeed { symbols }
            | PostableOracleProgram::SinglePriceFeedVerification { symbols } => {
                post_single_price_feed(cmd, &symbols)
            }
            PostableOracleProgram::EvmPriceFeed { symbols } => post_evm_price_feed(cmd, &symbols),
            PostableOracleProgram::UsRates { symbols } => us_rates(cmd, &symbols),
        }
    }
}

fn post_blocksize_bidask(cmd: Cmd<'_>, symbol: &str) -> std::result::Result<(), anyhow::Error> {
    cmd.arg("--exec-inputs")
        .arg(symbol)
        .arg("--decode-abi")
        .arg("uint256[]")
        .run()?;
    Ok(())
}

fn post_jup_price_feed(cmd: Cmd<'_>, id: &str) -> std::result::Result<(), anyhow::Error> {
    cmd.arg("--exec-inputs").arg(id).run()?;
    Ok(())
}

fn post_blocksize_vwap(cmd: Cmd<'_>, pair: &str) -> std::result::Result<(), anyhow::Error> {
    cmd.arg("--exec-inputs")
        .arg(pair)
        .arg("--decode-abi")
        .arg("uint256[]")
        .run()?;
    Ok(())
}

fn post_caplight_eod_market_price(
    cmd: Cmd<'_>,
    symbol: &str,
    str_result: bool,
) -> std::result::Result<(), anyhow::Error> {
    let cmd = cmd.arg("--exec-inputs").arg(symbol);

    let cmd = if !str_result {
        cmd.arg("--decode-abi").arg("uint256")
    } else {
        cmd
    };
    cmd.run()?;

    Ok(())
}

fn post_equity_or_commodity_price(
    cmd: Cmd<'_>,
    asset_type: DxfeedSymbol,
    symbol: &str,
) -> std::result::Result<(), anyhow::Error> {
    let asset_type = match asset_type {
        DxfeedSymbol::Commodity => "cfd",
        DxfeedSymbol::Equity => "equity",
        DxfeedSymbol::Fx => "fx",
        DxfeedSymbol::FxR => "fx_r",
        DxfeedSymbol::UslfQ => "uslf_q",
        DxfeedSymbol::UslfT => "uslf_t",
    };
    let exec_input = format!("{asset_type}/{symbol}");
    cmd.arg("--exec-inputs")
        .arg(exec_input)
        .arg("--decode-abi")
        .arg("uint256")
        .run()?;
    Ok(())
}

fn post_single_commodity_price(
    cmd: Cmd<'_>,
    symbol: &str,
) -> std::result::Result<(), anyhow::Error> {
    cmd.arg("--exec-inputs")
        .arg(symbol)
        .arg("--decode-abi")
        .arg("uint256")
        .run()?;
    Ok(())
}

fn post_single_equity_price(cmd: Cmd<'_>, symbol: &str) -> std::result::Result<(), anyhow::Error> {
    cmd.arg("--exec-inputs")
        .arg(symbol)
        .arg("--decode-abi")
        .arg("uint256")
        .run()?;
    Ok(())
}

/// Post a single price feed data request with the specified symbols.
fn post_single_price_feed(cmd: Cmd<'_>, symbols: &str) -> std::result::Result<(), anyhow::Error> {
    cmd.arg("--exec-inputs")
        .arg(symbols)
        .arg("--decode-abi")
        .arg("uint256[]")
        .run()?;
    Ok(())
}

/// Post a multi price feed data request with the specified symbols.
fn post_multi_price_feed(cmd: Cmd<'_>, symbols: &str) -> std::result::Result<(), anyhow::Error> {
    cmd.arg("--exec-inputs")
        .arg(symbols)
        .arg("--decode-abi")
        .arg("uint256")
        .run()?;
    Ok(())
}

/// Post a evm price feed data request with the specified symbols.
fn post_evm_price_feed(cmd: Cmd<'_>, symbols: &str) -> std::result::Result<(), anyhow::Error> {
    cmd.arg("--exec-inputs")
        .arg(symbols)
        .arg("--decode-abi")
        .arg("int256[]")
        .arg("--encode-exec-inputs")
        .arg("string[]")
        .run()?;
    Ok(())
}

/// Post a us rates data request with the specified symbols.
fn us_rates(cmd: Cmd<'_>, symbols: &str) -> std::result::Result<(), anyhow::Error> {
    cmd.arg("--exec-inputs")
        .arg(symbols)
        .arg("--decode-abi")
        .arg("uint256[]")
        .run()?;
    Ok(())
}

/// Test an oracle program, optionally filtering tests by a name pattern.
fn test_op(
    sh: &Shell,
    oracle_program: &OracleProgram,
    test_name_pattern: Option<&str>,
) -> Result<()> {
    let program_name = oracle_program.as_str();

    // We always test against the test feature flag- it doesn't matter which network we compiled for.
    // Since the tests are run against the compiled program and mocking when necessary.
    // Test feature also disables the sdk hide panic feature so we can better understand panics while testing.
    compile_op(sh, oracle_program, &SedaNetwork::Test)?;

    let test_path = format!("examples/tests/{program_name}.test.ts");
    match test_name_pattern {
        Some(pattern) => cmd!(sh, "bun test {test_path} -t {pattern}").run()?,
        None => cmd!(sh, "bun test {test_path}").run()?,
    }

    Ok(())
}
