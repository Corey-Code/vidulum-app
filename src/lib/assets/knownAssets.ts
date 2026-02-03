/**
 * Known Assets Registry
 *
 * Pre-defined ERC20 and SPL token definitions.
 * These are popular tokens that can be displayed in the wallet UI.
 *
 * Token denom format:
 * - ERC20: "erc20:0x{contractAddress}"
 * - SPL: "spl20:{mintAddress}"
 *
 * Supported chains:
 * - Ethereum Mainnet (1)
 * - Ethereum Sepolia (11155111)
 * - OP Mainnet (10)
 * - BNB Smart Chain (56)
 * - Gnosis (100)
 * - Polygon (137)
 * - Manta Pacific (169)
 * - Fantom (250)
 * - zkSync (324)
 * - Cronos (25)
 * - Metis (1088)
 * - Polygon zkEVM (1101)
 * - Moonbeam (1284)
 * - Moonriver (1285)
 * - Mantle (5000)
 * - Base (8453)
 * - Mode (34443)
 * - Arbitrum One (42161)
 * - Celo (42220)
 * - Avalanche C-Chain (43114)
 * - Linea (59144)
 * - Blast (81457)
 * - Base Sepolia (84532)
 * - Scroll (534352)
 * - Zora (7777777)
 */

export interface KnownToken {
  denom: string;
  symbol: string;
  name: string;
  decimals: number;
  contractAddress: string;
  chainId?: number; // For ERC20 tokens
  cluster?: string; // For SPL tokens
  logoUrl?: string;
}

// ============================================================================
// ERC20 Tokens (Ethereum Mainnet - chainId: 1)
// ============================================================================

export const ETH_MAINNET_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    chainId: 1,
  },
  {
    denom: 'erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: 1,
  },
  {
    denom: 'erc20:0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    chainId: 1,
  },
  {
    denom: 'erc20:0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    chainId: 1,
  },
  {
    denom: 'erc20:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    chainId: 1,
  },
  {
    denom: 'erc20:0x514910771AF9Ca656af840dff83E8264EcF986CA',
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    chainId: 1,
  },
  {
    denom: 'erc20:0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
    contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    chainId: 1,
  },
  {
    denom: 'erc20:0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    symbol: 'MATIC',
    name: 'Polygon',
    decimals: 18,
    contractAddress: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    chainId: 1,
  },
  {
    denom: 'erc20:0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    symbol: 'SHIB',
    name: 'Shiba Inu',
    decimals: 18,
    contractAddress: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    chainId: 1,
  },
  {
    denom: 'erc20:0x4d224452801ACEd8B2F0aebE155379bb5D594381',
    symbol: 'APE',
    name: 'ApeCoin',
    decimals: 18,
    contractAddress: '0x4d224452801ACEd8B2F0aebE155379bb5D594381',
    chainId: 1,
  },
  {
    denom: 'erc20:0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    symbol: 'stETH',
    name: 'Lido Staked Ether',
    decimals: 18,
    contractAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    chainId: 1,
  },
  {
    denom: 'erc20:0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    symbol: 'AAVE',
    name: 'Aave',
    decimals: 18,
    contractAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    chainId: 1,
  },
  {
    denom: 'erc20:0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    symbol: 'MKR',
    name: 'Maker',
    decimals: 18,
    contractAddress: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    chainId: 1,
  },
  {
    denom: 'erc20:0xD533a949740bb3306d119CC777fa900bA034cd52',
    symbol: 'CRV',
    name: 'Curve DAO',
    decimals: 18,
    contractAddress: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    chainId: 1,
  },
];

// ============================================================================
// ERC20 Tokens (Ethereum Sepolia - chainId: 11155111)
// ============================================================================

export const ETH_SEPOLIA_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    symbol: 'USDT',
    name: 'Tether USD (Test)',
    decimals: 6,
    contractAddress: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    chainId: 11155111,
  },
  {
    denom: 'erc20:0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    name: 'USD Coin (Test)',
    decimals: 6,
    contractAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    chainId: 11155111,
  },
  {
    denom: 'erc20:0x68194a729C2450ad26072b3D33ADaCbcef39D574',
    symbol: 'DAI',
    name: 'Dai Stablecoin (Test)',
    decimals: 18,
    contractAddress: '0x68194a729C2450ad26072b3D33ADaCbcef39D574',
    chainId: 11155111,
  },
  {
    denom: 'erc20:0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    symbol: 'WETH',
    name: 'Wrapped Ether (Test)',
    decimals: 18,
    contractAddress: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    chainId: 11155111,
  },
  {
    denom: 'erc20:0x779877A7B0D9E8603169DdbD7836e478b4624789',
    symbol: 'LINK',
    name: 'Chainlink (Test)',
    decimals: 18,
    contractAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    chainId: 11155111,
  },
];

// ============================================================================
// ERC20 Tokens (OP Mainnet - chainId: 10)
// ============================================================================

export const OPTIMISM_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    chainId: 10,
  },
  {
    denom: 'erc20:0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    chainId: 10,
  },
  {
    denom: 'erc20:0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    symbol: 'USDC.e',
    name: 'Bridged USD Coin',
    decimals: 6,
    contractAddress: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
    chainId: 10,
  },
  {
    denom: 'erc20:0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    chainId: 10,
  },
  {
    denom: 'erc20:0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x4200000000000000000000000000000000000006',
    chainId: 10,
  },
  {
    denom: 'erc20:0x68f180fcCe6836688e9084f035309E29Bf0A2095',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
    chainId: 10,
  },
  {
    denom: 'erc20:0x4200000000000000000000000000000000000042',
    symbol: 'OP',
    name: 'Optimism',
    decimals: 18,
    contractAddress: '0x4200000000000000000000000000000000000042',
    chainId: 10,
  },
  {
    denom: 'erc20:0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6',
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6',
    chainId: 10,
  },
  {
    denom: 'erc20:0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb',
    symbol: 'wstETH',
    name: 'Wrapped Lido Staked Ether',
    decimals: 18,
    contractAddress: '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb',
    chainId: 10,
  },
  {
    denom: 'erc20:0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db',
    symbol: 'VELO',
    name: 'Velodrome',
    decimals: 18,
    contractAddress: '0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db',
    chainId: 10,
  },
];

// ============================================================================
// ERC20 Tokens (BNB Smart Chain - chainId: 56)
// ============================================================================

export const BNB_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x55d398326f99059fF775485246999027B3197955',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 18,
    contractAddress: '0x55d398326f99059fF775485246999027B3197955',
    chainId: 56,
  },
  {
    denom: 'erc20:0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 18,
    contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    chainId: 56,
  },
  {
    denom: 'erc20:0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',
    chainId: 56,
  },
  {
    denom: 'erc20:0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    contractAddress: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    chainId: 56,
  },
  {
    denom: 'erc20:0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    symbol: 'BTCB',
    name: 'Bitcoin BEP2',
    decimals: 18,
    contractAddress: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
    chainId: 56,
  },
  {
    denom: 'erc20:0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    symbol: 'WBNB',
    name: 'Wrapped BNB',
    decimals: 18,
    contractAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    chainId: 56,
  },
  {
    denom: 'erc20:0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    symbol: 'BUSD',
    name: 'Binance USD',
    decimals: 18,
    contractAddress: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    chainId: 56,
  },
  {
    denom: 'erc20:0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    symbol: 'CAKE',
    name: 'PancakeSwap',
    decimals: 18,
    contractAddress: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    chainId: 56,
  },
  {
    denom: 'erc20:0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD',
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD',
    chainId: 56,
  },
  {
    denom: 'erc20:0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47',
    symbol: 'ADA',
    name: 'Cardano',
    decimals: 18,
    contractAddress: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47',
    chainId: 56,
  },
  {
    denom: 'erc20:0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE',
    symbol: 'XRP',
    name: 'XRP',
    decimals: 18,
    contractAddress: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE',
    chainId: 56,
  },
  {
    denom: 'erc20:0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402',
    symbol: 'DOT',
    name: 'Polkadot',
    decimals: 18,
    contractAddress: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402',
    chainId: 56,
  },
];

// ============================================================================
// ERC20 Tokens (Gnosis - chainId: 100)
// ============================================================================

export const GNOSIS_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x4ECaBa5870353805a9F068101A40E0f32ed605C6',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x4ECaBa5870353805a9F068101A40E0f32ed605C6',
    chainId: 100,
  },
  {
    denom: 'erc20:0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
    chainId: 100,
  },
  {
    denom: 'erc20:0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
    symbol: 'WXDAI',
    name: 'Wrapped xDAI',
    decimals: 18,
    contractAddress: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
    chainId: 100,
  },
  {
    denom: 'erc20:0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
    chainId: 100,
  },
  {
    denom: 'erc20:0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x8e5bBbb09Ed1ebdE8674Cda39A0c169401db4252',
    chainId: 100,
  },
  {
    denom: 'erc20:0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
    symbol: 'GNO',
    name: 'Gnosis',
    decimals: 18,
    contractAddress: '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb',
    chainId: 100,
  },
  {
    denom: 'erc20:0xE2e73A1c69ecF83F464EFCE6A5be353a37cA09b2',
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0xE2e73A1c69ecF83F464EFCE6A5be353a37cA09b2',
    chainId: 100,
  },
];

// ============================================================================
// ERC20 Tokens (Polygon - chainId: 137)
// ============================================================================

export const POLYGON_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    chainId: 137,
  },
  {
    denom: 'erc20:0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    chainId: 137,
  },
  {
    denom: 'erc20:0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    symbol: 'USDC.e',
    name: 'Bridged USD Coin',
    decimals: 6,
    contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    chainId: 137,
  },
  {
    denom: 'erc20:0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    chainId: 137,
  },
  {
    denom: 'erc20:0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    chainId: 137,
  },
  {
    denom: 'erc20:0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    chainId: 137,
  },
  {
    denom: 'erc20:0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    symbol: 'WMATIC',
    name: 'Wrapped Matic',
    decimals: 18,
    contractAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    chainId: 137,
  },
  {
    denom: 'erc20:0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
    chainId: 137,
  },
  {
    denom: 'erc20:0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
    contractAddress: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
    chainId: 137,
  },
  {
    denom: 'erc20:0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
    symbol: 'AAVE',
    name: 'Aave',
    decimals: 18,
    contractAddress: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
    chainId: 137,
  },
];

// ============================================================================
// ERC20 Tokens (Manta Pacific - chainId: 169)
// ============================================================================

export const MANTA_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xb73603C5d87fA094B7314C74ACE2e64D165016fb',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xb73603C5d87fA094B7314C74ACE2e64D165016fb',
    chainId: 169,
  },
  {
    denom: 'erc20:0xf417F5A458eC102B90352F697D6e2Ac3A3d2851f',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xf417F5A458eC102B90352F697D6e2Ac3A3d2851f',
    chainId: 169,
  },
  {
    denom: 'erc20:0x0Dc808adcE2099A9F62AA87D9670745AbA741746',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x0Dc808adcE2099A9F62AA87D9670745AbA741746',
    chainId: 169,
  },
  {
    denom: 'erc20:0x305E88d809c9DC03179554BFbf85Ac05Ce8F18d6',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x305E88d809c9DC03179554BFbf85Ac05Ce8F18d6',
    chainId: 169,
  },
  {
    denom: 'erc20:0x95CeF13441Be50d20cA4558CC0a27B601aC544E5',
    symbol: 'MANTA',
    name: 'Manta',
    decimals: 18,
    contractAddress: '0x95CeF13441Be50d20cA4558CC0a27B601aC544E5',
    chainId: 169,
  },
];

// ============================================================================
// ERC20 Tokens (Fantom - chainId: 250)
// ============================================================================

export const FANTOM_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x049d68029688eAbF473097a2fC38ef61633A3C7A',
    symbol: 'fUSDT',
    name: 'Frapped USDT',
    decimals: 6,
    contractAddress: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
    chainId: 250,
  },
  {
    denom: 'erc20:0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
    chainId: 250,
  },
  {
    denom: 'erc20:0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
    chainId: 250,
  },
  {
    denom: 'erc20:0x74b23882a30290451A17c44f4F05243b6b58C76d',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x74b23882a30290451A17c44f4F05243b6b58C76d',
    chainId: 250,
  },
  {
    denom: 'erc20:0x321162Cd933E2Be498Cd2267a90534A804051b11',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x321162Cd933E2Be498Cd2267a90534A804051b11',
    chainId: 250,
  },
  {
    denom: 'erc20:0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
    symbol: 'WFTM',
    name: 'Wrapped Fantom',
    decimals: 18,
    contractAddress: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
    chainId: 250,
  },
  {
    denom: 'erc20:0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8',
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8',
    chainId: 250,
  },
];

// ============================================================================
// ERC20 Tokens (zkSync - chainId: 324)
// ============================================================================

export const ZKSYNC_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x493257fD37EDB34451f62EDf8D2a0C418852bA4C',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C',
    chainId: 324,
  },
  {
    denom: 'erc20:0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',
    chainId: 324,
  },
  {
    denom: 'erc20:0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91',
    chainId: 324,
  },
  {
    denom: 'erc20:0xBBeB516fb02a01611cBBE0453Fe3c580D7281011',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0xBBeB516fb02a01611cBBE0453Fe3c580D7281011',
    chainId: 324,
  },
  {
    denom: 'erc20:0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E',
    symbol: 'ZK',
    name: 'zkSync',
    decimals: 18,
    contractAddress: '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E',
    chainId: 324,
  },
];

// ============================================================================
// ERC20 Tokens (Cronos - chainId: 25)
// ============================================================================

export const CRONOS_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x66e428c3f67a68878562e79A0234c1F83c208770',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x66e428c3f67a68878562e79A0234c1F83c208770',
    chainId: 25,
  },
  {
    denom: 'erc20:0xc21223249CA28397B4B6541dfFaEcC539BfF0c59',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59',
    chainId: 25,
  },
  {
    denom: 'erc20:0xF2001B145b43032AAF5Ee2884e456CCd805F677D',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0xF2001B145b43032AAF5Ee2884e456CCd805F677D',
    chainId: 25,
  },
  {
    denom: 'erc20:0xe44Fd7fCb2b1581822D0c862B68222998a0c299a',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0xe44Fd7fCb2b1581822D0c862B68222998a0c299a',
    chainId: 25,
  },
  {
    denom: 'erc20:0x062E66477Faf219F25D27dCED647BF57C3107d52',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x062E66477Faf219F25D27dCED647BF57C3107d52',
    chainId: 25,
  },
  {
    denom: 'erc20:0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
    symbol: 'WCRO',
    name: 'Wrapped CRO',
    decimals: 18,
    contractAddress: '0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23',
    chainId: 25,
  },
  {
    denom: 'erc20:0x2D03bECE6747ADC00E1a131BBA1469C15fD11e03',
    symbol: 'VVS',
    name: 'VVS Finance',
    decimals: 18,
    contractAddress: '0x2D03bECE6747ADC00E1a131BBA1469C15fD11e03',
    chainId: 25,
  },
];

// ============================================================================
// ERC20 Tokens (Metis - chainId: 1088)
// ============================================================================

export const METIS_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xbB06DCA3AE6887fAbF931640f67cab3e3a16F4dC',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xbB06DCA3AE6887fAbF931640f67cab3e3a16F4dC',
    chainId: 1088,
  },
  {
    denom: 'erc20:0xEA32A96608495e54156Ae48931A7c20f0dcc1a21',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xEA32A96608495e54156Ae48931A7c20f0dcc1a21',
    chainId: 1088,
  },
  {
    denom: 'erc20:0x420000000000000000000000000000000000000A',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x420000000000000000000000000000000000000A',
    chainId: 1088,
  },
  {
    denom: 'erc20:0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000',
    symbol: 'METIS',
    name: 'Metis',
    decimals: 18,
    contractAddress: '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000',
    chainId: 1088,
  },
];

// ============================================================================
// ERC20 Tokens (Polygon zkEVM - chainId: 1101)
// ============================================================================

export const POLYGON_ZKEVM_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x1E4a5963aBFD975d8c9021ce480b42188849D41d',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x1E4a5963aBFD975d8c9021ce480b42188849D41d',
    chainId: 1101,
  },
  {
    denom: 'erc20:0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035',
    chainId: 1101,
  },
  {
    denom: 'erc20:0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4',
    chainId: 1101,
  },
  {
    denom: 'erc20:0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9',
    chainId: 1101,
  },
  {
    denom: 'erc20:0xEA034fb02eB1808C2cc3aDbC15f447B93CbE08e1',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0xEA034fb02eB1808C2cc3aDbC15f447B93CbE08e1',
    chainId: 1101,
  },
];

// ============================================================================
// ERC20 Tokens (Moonbeam - chainId: 1284)
// ============================================================================

export const MOONBEAM_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d',
    symbol: 'xcUSDT',
    name: 'Tether USD (Moonbeam)',
    decimals: 6,
    contractAddress: '0xFFFFFFfFea09FB06d082fd1275CD48b191cbCD1d',
    chainId: 1284,
  },
  {
    denom: 'erc20:0x931715FEE2d06333043d11F658C8CE934aC61D0c',
    symbol: 'USDC.wh',
    name: 'USD Coin (Wormhole)',
    decimals: 6,
    contractAddress: '0x931715FEE2d06333043d11F658C8CE934aC61D0c',
    chainId: 1284,
  },
  {
    denom: 'erc20:0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b',
    chainId: 1284,
  },
  {
    denom: 'erc20:0x30D2a9F5FDf90ACe8c17952cbb4eE48a55D916A7',
    symbol: 'WETH.wh',
    name: 'Wrapped Ether (Wormhole)',
    decimals: 18,
    contractAddress: '0x30D2a9F5FDf90ACe8c17952cbb4eE48a55D916A7',
    chainId: 1284,
  },
  {
    denom: 'erc20:0xAcc15dC74880C9944775448304B263D191c6077F',
    symbol: 'WGLMR',
    name: 'Wrapped Glimmer',
    decimals: 18,
    contractAddress: '0xAcc15dC74880C9944775448304B263D191c6077F',
    chainId: 1284,
  },
  {
    denom: 'erc20:0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080',
    symbol: 'xcDOT',
    name: 'Polkadot (Moonbeam)',
    decimals: 10,
    contractAddress: '0xFfFFfFff1FcaCBd218EDc0EbA20Fc2308C778080',
    chainId: 1284,
  },
];

// ============================================================================
// ERC20 Tokens (Moonriver - chainId: 1285)
// ============================================================================

export const MOONRIVER_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xB44a9B6905aF7c801311e8F4E76932ee959c663C',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xB44a9B6905aF7c801311e8F4E76932ee959c663C',
    chainId: 1285,
  },
  {
    denom: 'erc20:0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xE3F5a90F9cb311505cd691a46596599aA1A0AD7D',
    chainId: 1285,
  },
  {
    denom: 'erc20:0x80A16016cC4A2E6a2CACA8a4a498b1699fF0f844',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0x80A16016cC4A2E6a2CACA8a4a498b1699fF0f844',
    chainId: 1285,
  },
  {
    denom: 'erc20:0x639A647fbe20b6c8ac19E48E2de44ea792c62c5C',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x639A647fbe20b6c8ac19E48E2de44ea792c62c5C',
    chainId: 1285,
  },
  {
    denom: 'erc20:0x98878B06940aE243284CA214f92Bb71a2b032B8A',
    symbol: 'WMOVR',
    name: 'Wrapped Moonriver',
    decimals: 18,
    contractAddress: '0x98878B06940aE243284CA214f92Bb71a2b032B8A',
    chainId: 1285,
  },
];

// ============================================================================
// ERC20 Tokens (Mantle - chainId: 5000)
// ============================================================================

export const MANTLE_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE',
    chainId: 5000,
  },
  {
    denom: 'erc20:0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
    chainId: 5000,
  },
  {
    denom: 'erc20:0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
    chainId: 5000,
  },
  {
    denom: 'erc20:0xCAbAE6f6Ea1ecaB08Ad02fE02ce9A44F09aebfA2',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0xCAbAE6f6Ea1ecaB08Ad02fE02ce9A44F09aebfA2',
    chainId: 5000,
  },
  {
    denom: 'erc20:0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
    symbol: 'WMNT',
    name: 'Wrapped Mantle',
    decimals: 18,
    contractAddress: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
    chainId: 5000,
  },
];

// ============================================================================
// ERC20 Tokens (Base - chainId: 8453)
// ============================================================================

export const BASE_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    chainId: 8453,
  },
  {
    denom: 'erc20:0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    chainId: 8453,
  },
  {
    denom: 'erc20:0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    chainId: 8453,
  },
  {
    denom: 'erc20:0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x4200000000000000000000000000000000000006',
    chainId: 8453,
  },
  {
    denom: 'erc20:0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
    contractAddress: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    chainId: 8453,
  },
  {
    denom: 'erc20:0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c',
    symbol: 'rETH',
    name: 'Rocket Pool ETH',
    decimals: 18,
    contractAddress: '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c',
    chainId: 8453,
  },
  {
    denom: 'erc20:0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    symbol: 'USDbC',
    name: 'USD Base Coin',
    decimals: 6,
    contractAddress: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    chainId: 8453,
  },
  {
    denom: 'erc20:0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    symbol: 'wstETH',
    name: 'Wrapped Lido Staked Ether',
    decimals: 18,
    contractAddress: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    chainId: 8453,
  },
  {
    denom: 'erc20:0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    symbol: 'AERO',
    name: 'Aerodrome',
    decimals: 18,
    contractAddress: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    chainId: 8453,
  },
];

// ============================================================================
// ERC20 Tokens (Mode - chainId: 34443)
// ============================================================================

export const MODE_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xd988097fb8612cc24eeC14542bC03424c656005f',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xd988097fb8612cc24eeC14542bC03424c656005f',
    chainId: 34443,
  },
  {
    denom: 'erc20:0xf0F161fDA2712DB8b566946122a5af183995e2eD',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xf0F161fDA2712DB8b566946122a5af183995e2eD',
    chainId: 34443,
  },
  {
    denom: 'erc20:0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x4200000000000000000000000000000000000006',
    chainId: 34443,
  },
  {
    denom: 'erc20:0xcDd475325D6F564d27247D1DddBb0DAc6fA0a5CF',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0xcDd475325D6F564d27247D1DddBb0DAc6fA0a5CF',
    chainId: 34443,
  },
  {
    denom: 'erc20:0xDfc7C877a950e49D2610114102175A06C2e3167a',
    symbol: 'MODE',
    name: 'Mode',
    decimals: 18,
    contractAddress: '0xDfc7C877a950e49D2610114102175A06C2e3167a',
    chainId: 34443,
  },
];

// ============================================================================
// ERC20 Tokens (Arbitrum One - chainId: 42161)
// ============================================================================

export const ARBITRUM_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    chainId: 42161,
  },
  {
    denom: 'erc20:0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    chainId: 42161,
  },
  {
    denom: 'erc20:0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    symbol: 'USDC.e',
    name: 'Bridged USD Coin',
    decimals: 6,
    contractAddress: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    chainId: 42161,
  },
  {
    denom: 'erc20:0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    chainId: 42161,
  },
  {
    denom: 'erc20:0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    chainId: 42161,
  },
  {
    denom: 'erc20:0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    chainId: 42161,
  },
  {
    denom: 'erc20:0x912CE59144191C1204E64559FE8253a0e49E6548',
    symbol: 'ARB',
    name: 'Arbitrum',
    decimals: 18,
    contractAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    chainId: 42161,
  },
  {
    denom: 'erc20:0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    chainId: 42161,
  },
  {
    denom: 'erc20:0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
    contractAddress: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
    chainId: 42161,
  },
  {
    denom: 'erc20:0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    symbol: 'GMX',
    name: 'GMX',
    decimals: 18,
    contractAddress: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    chainId: 42161,
  },
];

// ============================================================================
// ERC20 Tokens (Celo - chainId: 42220)
// ============================================================================

export const CELO_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    chainId: 42220,
  },
  {
    denom: 'erc20:0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    chainId: 42220,
  },
  {
    denom: 'erc20:0xE4fE50cdD716522A56204352f00AA110F731932d',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0xE4fE50cdD716522A56204352f00AA110F731932d',
    chainId: 42220,
  },
  {
    denom: 'erc20:0x122013fd7dF1C6F636a5bb8f03108E876548b455',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x122013fd7dF1C6F636a5bb8f03108E876548b455',
    chainId: 42220,
  },
  {
    denom: 'erc20:0x765DE816845861e75A25fCA122bb6898B8B1282a',
    symbol: 'cUSD',
    name: 'Celo Dollar',
    decimals: 18,
    contractAddress: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    chainId: 42220,
  },
  {
    denom: 'erc20:0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
    symbol: 'cEUR',
    name: 'Celo Euro',
    decimals: 18,
    contractAddress: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
    chainId: 42220,
  },
];

// ============================================================================
// ERC20 Tokens (Avalanche C-Chain - chainId: 43114)
// ============================================================================

export const AVALANCHE_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    chainId: 43114,
  },
  {
    denom: 'erc20:0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    chainId: 43114,
  },
  {
    denom: 'erc20:0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
    symbol: 'USDC.e',
    name: 'Bridged USD Coin',
    decimals: 6,
    contractAddress: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
    chainId: 43114,
  },
  {
    denom: 'erc20:0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
    symbol: 'DAI.e',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
    chainId: 43114,
  },
  {
    denom: 'erc20:0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
    symbol: 'WETH.e',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
    chainId: 43114,
  },
  {
    denom: 'erc20:0x50b7545627a5162F82A992c33b87aDc75187B218',
    symbol: 'WBTC.e',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x50b7545627a5162F82A992c33b87aDc75187B218',
    chainId: 43114,
  },
  {
    denom: 'erc20:0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    symbol: 'WAVAX',
    name: 'Wrapped AVAX',
    decimals: 18,
    contractAddress: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
    chainId: 43114,
  },
  {
    denom: 'erc20:0x5947BB275c521040051D82396192181b413227A3',
    symbol: 'LINK.e',
    name: 'Chainlink',
    decimals: 18,
    contractAddress: '0x5947BB275c521040051D82396192181b413227A3',
    chainId: 43114,
  },
  {
    denom: 'erc20:0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd',
    symbol: 'JOE',
    name: 'Trader Joe',
    decimals: 18,
    contractAddress: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd',
    chainId: 43114,
  },
];

// ============================================================================
// ERC20 Tokens (Linea - chainId: 59144)
// ============================================================================

export const LINEA_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xA219439258ca9da29E9Cc4cE5596924745e12B93',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xA219439258ca9da29E9Cc4cE5596924745e12B93',
    chainId: 59144,
  },
  {
    denom: 'erc20:0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff',
    chainId: 59144,
  },
  {
    denom: 'erc20:0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5',
    chainId: 59144,
  },
  {
    denom: 'erc20:0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
    chainId: 59144,
  },
  {
    denom: 'erc20:0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4',
    chainId: 59144,
  },
];

// ============================================================================
// ERC20 Tokens (Blast - chainId: 81457)
// ============================================================================

export const BLAST_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x4300000000000000000000000000000000000003',
    symbol: 'USDB',
    name: 'Blast USD',
    decimals: 18,
    contractAddress: '0x4300000000000000000000000000000000000003',
    chainId: 81457,
  },
  {
    denom: 'erc20:0x4300000000000000000000000000000000000004',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x4300000000000000000000000000000000000004',
    chainId: 81457,
  },
  {
    denom: 'erc20:0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad',
    symbol: 'BLAST',
    name: 'Blast',
    decimals: 18,
    contractAddress: '0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad',
    chainId: 81457,
  },
];

// ============================================================================
// ERC20 Tokens (Base Sepolia - chainId: 84532)
// ============================================================================

export const BASE_SEPOLIA_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    symbol: 'USDC',
    name: 'USD Coin (Test)',
    decimals: 6,
    contractAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    chainId: 84532,
  },
  {
    denom: 'erc20:0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether (Test)',
    decimals: 18,
    contractAddress: '0x4200000000000000000000000000000000000006',
    chainId: 84532,
  },
];

// ============================================================================
// ERC20 Tokens (Scroll - chainId: 534352)
// ============================================================================

export const SCROLL_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df',
    chainId: 534352,
  },
  {
    denom: 'erc20:0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
    chainId: 534352,
  },
  {
    denom: 'erc20:0xcA77eB3fEFe3725Dc33bccB54eDEFc3D9f764f97',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    contractAddress: '0xcA77eB3fEFe3725Dc33bccB54eDEFc3D9f764f97',
    chainId: 534352,
  },
  {
    denom: 'erc20:0x5300000000000000000000000000000000000004',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x5300000000000000000000000000000000000004',
    chainId: 534352,
  },
  {
    denom: 'erc20:0x3C1BCa5a656e69edCD0D4E36BEbb3FcDAcA60Cf1',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    contractAddress: '0x3C1BCa5a656e69edCD0D4E36BEbb3FcDAcA60Cf1',
    chainId: 534352,
  },
];

// ============================================================================
// ERC20 Tokens (Zora - chainId: 7777777)
// ============================================================================

export const ZORA_ERC20_TOKENS: KnownToken[] = [
  {
    denom: 'erc20:0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    contractAddress: '0x4200000000000000000000000000000000000006',
    chainId: 7777777,
  },
];

// ============================================================================
// SPL Tokens (Solana Mainnet)
// ============================================================================

export const SOLANA_MAINNET_SPL_TOKENS: KnownToken[] = [
  {
    denom: 'spl20:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:So11111111111111111111111111111111111111112',
    symbol: 'WSOL',
    name: 'Wrapped SOL',
    decimals: 9,
    contractAddress: 'So11111111111111111111111111111111111111112',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    symbol: 'mSOL',
    name: 'Marinade staked SOL',
    decimals: 9,
    contractAddress: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
    symbol: 'stSOL',
    name: 'Lido Staked SOL',
    decimals: 9,
    contractAddress: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    symbol: 'BONK',
    name: 'Bonk',
    decimals: 5,
    contractAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    symbol: 'JUP',
    name: 'Jupiter',
    decimals: 6,
    contractAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    symbol: 'RAY',
    name: 'Raydium',
    decimals: 6,
    contractAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    symbol: 'ORCA',
    name: 'Orca',
    decimals: 6,
    contractAddress: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    symbol: 'WETH',
    name: 'Wrapped Ether (Wormhole)',
    decimals: 8,
    contractAddress: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    cluster: 'mainnet-beta',
  },
  {
    denom: 'spl20:3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    symbol: 'WBTC',
    name: 'Wrapped BTC (Wormhole)',
    decimals: 8,
    contractAddress: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    cluster: 'mainnet-beta',
  },
];

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Get all known ERC20 tokens for a chain
 */
export function getKnownErc20Tokens(chainId: number): KnownToken[] {
  switch (chainId) {
    case 1:
      return ETH_MAINNET_ERC20_TOKENS;
    case 10:
      return OPTIMISM_ERC20_TOKENS;
    case 25:
      return CRONOS_ERC20_TOKENS;
    case 56:
      return BNB_ERC20_TOKENS;
    case 100:
      return GNOSIS_ERC20_TOKENS;
    case 137:
      return POLYGON_ERC20_TOKENS;
    case 169:
      return MANTA_ERC20_TOKENS;
    case 250:
      return FANTOM_ERC20_TOKENS;
    case 324:
      return ZKSYNC_ERC20_TOKENS;
    case 1088:
      return METIS_ERC20_TOKENS;
    case 1101:
      return POLYGON_ZKEVM_ERC20_TOKENS;
    case 1284:
      return MOONBEAM_ERC20_TOKENS;
    case 1285:
      return MOONRIVER_ERC20_TOKENS;
    case 5000:
      return MANTLE_ERC20_TOKENS;
    case 8453:
      return BASE_ERC20_TOKENS;
    case 34443:
      return MODE_ERC20_TOKENS;
    case 42161:
      return ARBITRUM_ERC20_TOKENS;
    case 42220:
      return CELO_ERC20_TOKENS;
    case 43114:
      return AVALANCHE_ERC20_TOKENS;
    case 59144:
      return LINEA_ERC20_TOKENS;
    case 81457:
      return BLAST_ERC20_TOKENS;
    case 84532:
      return BASE_SEPOLIA_ERC20_TOKENS;
    case 534352:
      return SCROLL_ERC20_TOKENS;
    case 7777777:
      return ZORA_ERC20_TOKENS;
    case 11155111:
      return ETH_SEPOLIA_ERC20_TOKENS;
    default:
      return [];
  }
}

/**
 * Get all known SPL tokens for a cluster
 */
export function getKnownSplTokens(cluster: string): KnownToken[] {
  if (cluster === 'mainnet-beta') {
    return SOLANA_MAINNET_SPL_TOKENS;
  }
  return [];
}

/**
 * All ERC20 token lists for lookup
 */
const ALL_ERC20_TOKENS = [
  ...ETH_MAINNET_ERC20_TOKENS,
  ...ETH_SEPOLIA_ERC20_TOKENS,
  ...OPTIMISM_ERC20_TOKENS,
  ...BNB_ERC20_TOKENS,
  ...GNOSIS_ERC20_TOKENS,
  ...POLYGON_ERC20_TOKENS,
  ...MANTA_ERC20_TOKENS,
  ...FANTOM_ERC20_TOKENS,
  ...ZKSYNC_ERC20_TOKENS,
  ...CRONOS_ERC20_TOKENS,
  ...METIS_ERC20_TOKENS,
  ...POLYGON_ZKEVM_ERC20_TOKENS,
  ...MOONBEAM_ERC20_TOKENS,
  ...MOONRIVER_ERC20_TOKENS,
  ...MANTLE_ERC20_TOKENS,
  ...BASE_ERC20_TOKENS,
  ...MODE_ERC20_TOKENS,
  ...ARBITRUM_ERC20_TOKENS,
  ...CELO_ERC20_TOKENS,
  ...AVALANCHE_ERC20_TOKENS,
  ...LINEA_ERC20_TOKENS,
  ...BLAST_ERC20_TOKENS,
  ...BASE_SEPOLIA_ERC20_TOKENS,
  ...SCROLL_ERC20_TOKENS,
  ...ZORA_ERC20_TOKENS,
];

/**
 * Get token info by denom
 */
export function getKnownToken(denom: string): KnownToken | undefined {
  // Check all ERC20 tokens
  const erc20Token = ALL_ERC20_TOKENS.find((t) => t.denom === denom);
  if (erc20Token) return erc20Token;

  // Check SPL tokens
  const splToken = SOLANA_MAINNET_SPL_TOKENS.find((t) => t.denom === denom);
  if (splToken) return splToken;

  return undefined;
}

/**
 * Check if a denom is an ERC20 token
 */
export function isErc20Token(denom: string): boolean {
  return denom.startsWith('erc20:');
}

/**
 * Check if a denom is an SPL token
 */
export function isSplToken(denom: string): boolean {
  return denom.startsWith('spl20:');
}

/**
 * Extract contract address from ERC20 denom
 */
export function getErc20ContractAddress(denom: string): string | null {
  if (!isErc20Token(denom)) return null;
  return denom.replace('erc20:', '');
}

/**
 * Extract mint address from SPL denom
 */
export function getSplMintAddress(denom: string): string | null {
  if (!isSplToken(denom)) return null;
  return denom.replace('spl20:', '');
}
