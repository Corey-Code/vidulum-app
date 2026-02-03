/**
 * Known Assets Tests
 *
 * Tests for ERC20 and SPL token registry functionality
 */

import {
  ETH_MAINNET_ERC20_TOKENS,
  SOLANA_MAINNET_SPL_TOKENS,
  getKnownErc20Tokens,
  getKnownSplTokens,
  getKnownToken,
  isErc20Token,
  isSplToken,
  getErc20ContractAddress,
  getSplMintAddress,
} from '@/lib/assets/knownAssets';

describe('Known Assets', () => {
  describe('ETH_MAINNET_ERC20_TOKENS', () => {
    it('should have ERC20 tokens defined', () => {
      expect(ETH_MAINNET_ERC20_TOKENS.length).toBeGreaterThan(0);
    });

    it('should have valid token structure', () => {
      ETH_MAINNET_ERC20_TOKENS.forEach((token) => {
        expect(token.denom).toBeDefined();
        expect(token.symbol).toBeDefined();
        expect(token.name).toBeDefined();
        expect(typeof token.decimals).toBe('number');
        expect(token.contractAddress).toBeDefined();
        expect(token.chainId).toBe(1);
      });
    });

    it('should have correct denom format', () => {
      ETH_MAINNET_ERC20_TOKENS.forEach((token) => {
        expect(token.denom.startsWith('erc20:')).toBe(true);
      });
    });

    it('should include common tokens like USDT and USDC', () => {
      const symbols = ETH_MAINNET_ERC20_TOKENS.map((t) => t.symbol);
      expect(symbols).toContain('USDT');
      expect(symbols).toContain('USDC');
    });
  });

  describe('SOLANA_MAINNET_SPL_TOKENS', () => {
    it('should have SPL tokens defined', () => {
      expect(SOLANA_MAINNET_SPL_TOKENS.length).toBeGreaterThan(0);
    });

    it('should have valid token structure', () => {
      SOLANA_MAINNET_SPL_TOKENS.forEach((token) => {
        expect(token.denom).toBeDefined();
        expect(token.symbol).toBeDefined();
        expect(token.name).toBeDefined();
        expect(typeof token.decimals).toBe('number');
        expect(token.contractAddress).toBeDefined();
        expect(token.cluster).toBe('mainnet-beta');
      });
    });

    it('should have correct denom format', () => {
      SOLANA_MAINNET_SPL_TOKENS.forEach((token) => {
        expect(token.denom.startsWith('spl20:')).toBe(true);
      });
    });

    it('should include common tokens like USDT and USDC', () => {
      const symbols = SOLANA_MAINNET_SPL_TOKENS.map((t) => t.symbol);
      expect(symbols).toContain('USDT');
      expect(symbols).toContain('USDC');
    });

    it('should include wrapped SOL', () => {
      const wsol = SOLANA_MAINNET_SPL_TOKENS.find((t) => t.symbol === 'WSOL');
      expect(wsol).toBeDefined();
      expect(wsol?.decimals).toBe(9);
    });
  });

  describe('getKnownErc20Tokens', () => {
    it('should return ERC20 tokens for Ethereum mainnet (chainId 1)', () => {
      const tokens = getKnownErc20Tokens(1);
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toEqual(ETH_MAINNET_ERC20_TOKENS);
    });

    it('should return empty array for unknown chain', () => {
      const tokens = getKnownErc20Tokens(999999);
      expect(tokens).toEqual([]);
    });

    it('should return empty array for non-Ethereum chains', () => {
      expect(getKnownErc20Tokens(56)).toEqual([]); // BSC
      expect(getKnownErc20Tokens(137)).toEqual([]); // Polygon
    });
  });

  describe('getKnownSplTokens', () => {
    it('should return SPL tokens for Solana mainnet', () => {
      const tokens = getKnownSplTokens('mainnet-beta');
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toEqual(SOLANA_MAINNET_SPL_TOKENS);
    });

    it('should return empty array for unknown cluster', () => {
      const tokens = getKnownSplTokens('unknown-cluster');
      expect(tokens).toEqual([]);
    });

    it('should return empty array for devnet/testnet', () => {
      expect(getKnownSplTokens('devnet')).toEqual([]);
      expect(getKnownSplTokens('testnet')).toEqual([]);
    });
  });

  describe('getKnownToken', () => {
    it('should find ERC20 token by denom', () => {
      const usdtDenom = ETH_MAINNET_ERC20_TOKENS.find((t) => t.symbol === 'USDT')?.denom;
      if (usdtDenom) {
        const token = getKnownToken(usdtDenom);
        expect(token).toBeDefined();
        expect(token?.symbol).toBe('USDT');
      }
    });

    it('should find SPL token by denom', () => {
      const usdcDenom = SOLANA_MAINNET_SPL_TOKENS.find((t) => t.symbol === 'USDC')?.denom;
      if (usdcDenom) {
        const token = getKnownToken(usdcDenom);
        expect(token).toBeDefined();
        expect(token?.symbol).toBe('USDC');
      }
    });

    it('should return undefined for unknown denom', () => {
      const token = getKnownToken('unknown:0x1234');
      expect(token).toBeUndefined();
    });
  });

  describe('isErc20Token', () => {
    it('should return true for ERC20 denoms', () => {
      expect(isErc20Token('erc20:0x1234567890123456789012345678901234567890')).toBe(true);
      expect(isErc20Token('erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe(true);
    });

    it('should return false for non-ERC20 denoms', () => {
      expect(isErc20Token('spl20:mint123')).toBe(false);
      expect(isErc20Token('ubze')).toBe(false);
      expect(isErc20Token('uatom')).toBe(false);
      expect(isErc20Token('')).toBe(false);
    });
  });

  describe('isSplToken', () => {
    it('should return true for SPL denoms', () => {
      expect(isSplToken('spl20:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
      expect(isSplToken('spl20:So11111111111111111111111111111111111111112')).toBe(true);
    });

    it('should return false for non-SPL denoms', () => {
      expect(isSplToken('erc20:0x1234')).toBe(false);
      expect(isSplToken('ubze')).toBe(false);
      expect(isSplToken('')).toBe(false);
    });
  });

  describe('getErc20ContractAddress', () => {
    it('should extract contract address from ERC20 denom', () => {
      const address = getErc20ContractAddress('erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7');
      expect(address).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    });

    it('should return null for non-ERC20 denom', () => {
      expect(getErc20ContractAddress('spl20:mint123')).toBeNull();
      expect(getErc20ContractAddress('ubze')).toBeNull();
    });
  });

  describe('getSplMintAddress', () => {
    it('should extract mint address from SPL denom', () => {
      const mint = getSplMintAddress('spl20:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });

    it('should return null for non-SPL denom', () => {
      expect(getSplMintAddress('erc20:0x1234')).toBeNull();
      expect(getSplMintAddress('ubze')).toBeNull();
    });
  });

  describe('Token Data Integrity', () => {
    it('should have unique denoms for ERC20 tokens', () => {
      const denoms = ETH_MAINNET_ERC20_TOKENS.map((t) => t.denom);
      const uniqueDenoms = new Set(denoms);
      expect(uniqueDenoms.size).toBe(denoms.length);
    });

    it('should have unique denoms for SPL tokens', () => {
      const denoms = SOLANA_MAINNET_SPL_TOKENS.map((t) => t.denom);
      const uniqueDenoms = new Set(denoms);
      expect(uniqueDenoms.size).toBe(denoms.length);
    });

    it('should have valid decimals for ERC20 tokens', () => {
      ETH_MAINNET_ERC20_TOKENS.forEach((token) => {
        expect(token.decimals).toBeGreaterThanOrEqual(0);
        expect(token.decimals).toBeLessThanOrEqual(18);
      });
    });

    it('should have valid decimals for SPL tokens', () => {
      SOLANA_MAINNET_SPL_TOKENS.forEach((token) => {
        expect(token.decimals).toBeGreaterThanOrEqual(0);
        expect(token.decimals).toBeLessThanOrEqual(9);
      });
    });

    it('should have contract address matching denom for ERC20 tokens', () => {
      ETH_MAINNET_ERC20_TOKENS.forEach((token) => {
        const denomAddress = getErc20ContractAddress(token.denom);
        expect(denomAddress).toBe(token.contractAddress);
      });
    });

    it('should have mint address matching denom for SPL tokens', () => {
      SOLANA_MAINNET_SPL_TOKENS.forEach((token) => {
        const denomMint = getSplMintAddress(token.denom);
        expect(denomMint).toBe(token.contractAddress);
      });
    });
  });
});
