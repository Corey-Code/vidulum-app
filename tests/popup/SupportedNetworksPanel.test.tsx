/**
 * SupportedNetworksPanel tests
 *
 * Renders the Settings catalog in jsdom so the user-facing copy stays
 * aligned with the curated network list.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import SupportedNetworksPanel from '@/popup/components/SupportedNetworksPanel';

function renderPanel() {
  return render(
    <ChakraProvider>
      <SupportedNetworksPanel />
    </ChakraProvider>
  );
}

describe('SupportedNetworksPanel', () => {
  it('shows the four network families and September 2026 review text', () => {
    renderPanel();

    expect(screen.getByText('Supported networks')).toBeInTheDocument();
    expect(
      screen.getByText(/This wallet can hold your assets on the network types below\. Reviewed September 2026\./)
    ).toBeInTheDocument();

    expect(screen.getByText('Cosmos')).toBeInTheDocument();
    expect(screen.getByText('Bitcoin-like (UTXO)')).toBeInTheDocument();
    expect(screen.getByText('Ethereum-like (EVM)')).toBeInTheDocument();
    expect(screen.getByText('Solana (SVM)')).toBeInTheDocument();
  });

  it('lists curated networks in plain language', () => {
    renderPanel();

    expect(screen.getByText(/BeeZee, Osmosis, AtomOne, Cosmos Hub/)).toBeInTheDocument();
    expect(screen.getByText(/Bitcoin, Litecoin, Dogecoin, Zcash/)).toBeInTheDocument();
    expect(screen.getByText(/Ethereum, OP Mainnet, BNB Chain, Polygon, Base, Arbitrum One/)).toBeInTheDocument();
    expect(screen.getByText(/^Solana$/)).toBeInTheDocument();
  });

  it('lists current Bitcoin-like explorers including CipherScan and Ravencoin Explorer', () => {
    renderPanel();

    expect(screen.getByText('Bitcoin-like explorers')).toBeInTheDocument();
    expect(
      screen.getByText(
        /When you look up a Bitcoin-like address, this wallet opens these websites\. Checked September 2026\./
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Zcash: cipherscan.app')).toBeInTheDocument();
    expect(screen.getByText('Ravencoin: ravencoinexplorer.com')).toBeInTheDocument();
    expect(screen.getByText('Bitcoin: blockstream.info')).toBeInTheDocument();
  });
});
