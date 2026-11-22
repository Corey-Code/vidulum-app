import {
  SKIP_GO_API_URL,
  beezeeSwapAsset,
  beezeeSwapConfig,
  beezeeSwapCopy,
  skipCanQuoteBeezeeAsset,
  vdlSwapConfig,
  vdlSwapCopy,
  CTL_DENOM,
  CTL_SWAP_TITLE,
  VDL_CHAIN_ID,
  VDL_DENOM,
  VDL_SWAP_TITLE,
} from '@/lib/swap/vdlSwapConfig';

describe('vdlSwapConfig', () => {
  it('buys VDL on BeeZee and leaves the pay-with side open', () => {
    const config = vdlSwapConfig('buy');

    expect(config.defaultRoute).toEqual({
      destChainId: VDL_CHAIN_ID,
      destAssetDenom: VDL_DENOM,
      destLocked: true,
    });
    expect(config.defaultRoute.srcLocked).toBeUndefined();
    expect(config.defaultRoute.srcChainId).toBeUndefined();
    expect(config.defaultRoute.srcAssetDenom).toBeUndefined();
    expect(config.defaultRoute).not.toHaveProperty('amountIn');
    expect(config.defaultRoute).not.toHaveProperty('amountOut');

    expect(config.filter.destination).toEqual({
      [VDL_CHAIN_ID]: [VDL_DENOM],
    });
    expect(config.filter.source).toBeUndefined();

    expect(config.filterOut.source).toEqual({
      [VDL_CHAIN_ID]: [VDL_DENOM],
    });
    expect(config.filterOut.destination).toBeUndefined();
  });

  it('sells BeeZee VDL and leaves the receive side open', () => {
    const config = vdlSwapConfig('sell');

    expect(config.defaultRoute).toEqual({
      srcChainId: VDL_CHAIN_ID,
      srcAssetDenom: VDL_DENOM,
      srcLocked: true,
    });
    expect(config.defaultRoute.destLocked).toBeUndefined();
    expect(config.defaultRoute.destChainId).toBeUndefined();
    expect(config.defaultRoute.destAssetDenom).toBeUndefined();
    expect(config.defaultRoute).not.toHaveProperty('amountIn');
    expect(config.defaultRoute).not.toHaveProperty('amountOut');

    expect(config.filter.source).toEqual({
      [VDL_CHAIN_ID]: [VDL_DENOM],
    });
    expect(config.filter.destination).toBeUndefined();

    expect(config.filterOut.destination).toEqual({
      [VDL_CHAIN_ID]: [VDL_DENOM],
    });
    expect(config.filterOut.source).toBeUndefined();
  });

  it('does not lock the same side for buy and sell', () => {
    const buy = vdlSwapConfig('buy');
    const sell = vdlSwapConfig('sell');

    expect(buy.filter.destination).toBeDefined();
    expect(buy.filter.source).toBeUndefined();
    expect(sell.filter.source).toBeDefined();
    expect(sell.filter.destination).toBeUndefined();
  });

  it('uses the BeeZee factory denom', () => {
    expect(VDL_CHAIN_ID).toBe('beezee-1');
    expect(VDL_DENOM).toBe('factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl');
  });

  it('returns the page copy', () => {
    expect(VDL_SWAP_TITLE).toBe('Buy / Sell VDL');
    expect(vdlSwapCopy('buy')).toBe('Pay with any asset. Receive VDL.');
    expect(vdlSwapCopy('sell')).toBe('Pay with VDL. Receive any asset.');
  });

  it('calls Skip directly so the client can append /v2', () => {
    expect(SKIP_GO_API_URL).toBe('https://api.skip.build');
    expect(SKIP_GO_API_URL.endsWith('/v2')).toBe(false);
    expect(SKIP_GO_API_URL.includes('api.vidulum.app')).toBe(false);
  });
});

describe('beezeeSwapConfig CTL', () => {
  it('uses the BeeZee CTL factory denom', () => {
    expect(CTL_DENOM).toBe('factory/bze1972aqfzdg29ugjln74edx0xvcg4ehvysjptk77/CTL');
    expect(beezeeSwapAsset('ctl')).toEqual({
      id: 'ctl',
      symbol: 'CTL',
      denom: CTL_DENOM,
      title: CTL_SWAP_TITLE,
    });
    expect(CTL_SWAP_TITLE).toBe('Buy / Sell CTL');
  });

  it('buys CTL on BeeZee and leaves the pay-with side open', () => {
    const config = beezeeSwapConfig('ctl', 'buy');

    expect(config.defaultRoute).toEqual({
      destChainId: VDL_CHAIN_ID,
      destAssetDenom: CTL_DENOM,
      destLocked: true,
    });
    expect(config.filter.destination).toEqual({
      [VDL_CHAIN_ID]: [CTL_DENOM],
    });
    expect(config.filterOut.source).toEqual({
      [VDL_CHAIN_ID]: [CTL_DENOM],
    });
  });

  it('sells BeeZee CTL and leaves the receive side open', () => {
    const config = beezeeSwapConfig('ctl', 'sell');

    expect(config.defaultRoute).toEqual({
      srcChainId: VDL_CHAIN_ID,
      srcAssetDenom: CTL_DENOM,
      srcLocked: true,
    });
    expect(config.filter.source).toEqual({
      [VDL_CHAIN_ID]: [CTL_DENOM],
    });
    expect(config.filterOut.destination).toEqual({
      [VDL_CHAIN_ID]: [CTL_DENOM],
    });
  });

  it('returns CTL page copy', () => {
    expect(beezeeSwapCopy('ctl', 'buy')).toBe('Pay with any asset. Receive CTL.');
    expect(beezeeSwapCopy('ctl', 'sell')).toBe('Pay with CTL. Receive any asset.');
  });

  it('marks CTL as not Skip-quotable while VDL remains quotable', () => {
    expect(skipCanQuoteBeezeeAsset('vdl')).toBe(true);
    expect(skipCanQuoteBeezeeAsset('ctl')).toBe(false);
  });
});
