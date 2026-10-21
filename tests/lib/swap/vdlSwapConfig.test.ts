import { vdlSwapConfig, vdlSwapCopy, VDL_CHAIN_ID, VDL_DENOM, VDL_SWAP_TITLE } from '@/lib/swap/vdlSwapConfig';

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
});
