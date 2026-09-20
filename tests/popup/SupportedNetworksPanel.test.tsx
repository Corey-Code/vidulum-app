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
    expect(screen.getByText(/current public RPC and LCD/)).toBeInTheDocument();
    expect(screen.getByText(/ezstaking\.dev, itastakers\.com, and setten\.io/)).toBeInTheDocument();
    expect(screen.getByText(/Mintscan, ATOMScan, BeeZee Explorer/)).toBeInTheDocument();
    expect(screen.getByText(/ezstaking\.app, finder\.kujira\.app, and explorers\.guru/)).toBeInTheDocument();
    expect(screen.getByText(/Bitcoin, Litecoin, Dogecoin, Zcash/)).toBeInTheDocument();
    expect(
      screen.getByText(/Bitcoin and Litecoin can load balances today/)
    ).toBeInTheDocument();
    expect(screen.getByText(/CipherScan, Ravencoin Explorer, OKLink, Flux Blockbook/)).toBeInTheDocument();
    expect(
      screen.getByText(/dogechain\.info, explorer\.runonflux\.io, and explorer\.nosocoin\.com/)
    ).toBeInTheDocument();
    expect(screen.getByText(/Ethereum, OP Mainnet, BNB Chain, Polygon, Base, Arbitrum One/)).toBeInTheDocument();
    expect(screen.getByText(/Ethereum and compatible networks load balances through current public RPCs/)).toBeInTheDocument();
    expect(screen.getByText(/PublicNode, DRPC, and official chain endpoints/)).toBeInTheDocument();
    expect(screen.getByText(/Sepolia\.org RPCs and zkevm\.polygonscan\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare Ethereum, Ankr public RPC, and BlastAPI/)).toBeInTheDocument();
    expect(screen.getByText(/^Solana$/)).toBeInTheDocument();
    expect(screen.getByText(/official Solana and PublicNode/)).toBeInTheDocument();
    expect(screen.getByText(/Ankr public RPC and Solana dRPC/)).toBeInTheDocument();
  });
});
