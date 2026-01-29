import { create } from 'zustand';
import { ChainInfo, Balance } from '@/types/wallet';
import { SUPPORTED_CHAINS, getNetworkType } from '@/lib/cosmos/chains';
import { cosmosClient } from '@/lib/cosmos/client';
import { getChainWebSocket, disconnectAllWebSockets } from '@/lib/cosmos/websocket';
import { getBitcoinClient } from '@/lib/bitcoin/client';
import { getEvmClient } from '@/lib/evm/client';

interface ChainState {
  chains: Map<string, ChainInfo>;
  balances: Map<string, Map<string, Balance[]>>; // chainId -> address -> balances
  subscriptions: Map<string, string>; // "chainId:address" -> subscriptionId
  timeoutHandles: Map<string, NodeJS.Timeout>; // "chainId:address" -> timeout handle for debounced refresh
  isSubscribed: boolean;

  getChain: (chainId: string) => ChainInfo | undefined;
  addChain: (chain: ChainInfo) => void;
  removeChain: (chainId: string) => void;

  fetchBalance: (networkId: string, address: string) => Promise<Balance[]>;
  getBalance: (networkId: string, address: string) => Balance[] | undefined;
  clearBalances: () => void;

  // WebSocket subscription management
  subscribeToBalanceUpdates: (chainId: string, address: string) => void;
  unsubscribeFromBalanceUpdates: (chainId: string, address: string) => void;
  unsubscribeAll: () => void;
}

export const useChainStore = create<ChainState>((set, get) => ({
  chains: new Map(SUPPORTED_CHAINS),
  balances: new Map(),
  subscriptions: new Map(),
  timeoutHandles: new Map(),
  isSubscribed: false,

  getChain: (chainId: string) => {
    return get().chains.get(chainId);
  },

  addChain: (chain: ChainInfo) => {
    const { chains } = get();
    chains.set(chain.chainId, chain);
    set({ chains: new Map(chains) });
  },

  removeChain: (chainId: string) => {
    const { chains } = get();
    chains.delete(chainId);
    set({ chains: new Map(chains) });
  },

  fetchBalance: async (networkId: string, address: string) => {
    const networkType = getNetworkType(networkId);

    let balances: Balance[];

    if (networkType === 'bitcoin') {
      // Fetch Bitcoin balance
      try {
        const client = getBitcoinClient(networkId);
        const satoshis = await client.getBalance(address);
        balances = [
          {
            denom: 'sat',
            amount: satoshis.toString(),
          },
        ];
      } catch (error) {
        console.error(`Failed to fetch Bitcoin balance:`, error);
        balances = [];
      }
    } else if (networkType === 'evm') {
      // Fetch EVM balance
      try {
        const client = getEvmClient(networkId);
        const wei = await client.getBalance(address);
        balances = [
          {
            denom: 'wei',
            amount: wei.toString(),
          },
        ];
      } catch (error) {
        console.error(`Failed to fetch EVM balance:`, error);
        balances = [];
      }
    } else {
      // Fetch Cosmos balance
      const chain = get().getChain(networkId);
      if (!chain) {
        throw new Error(`Chain ${networkId} not found`);
      }
      balances = await cosmosClient.getBalance(chain.rpc, address, chain.rest);
    }

    const { balances: currentBalances } = get();
    let chainBalances = currentBalances.get(networkId);

    if (!chainBalances) {
      chainBalances = new Map();
      currentBalances.set(networkId, chainBalances);
    }

    chainBalances.set(address, balances);
    set({ balances: new Map(currentBalances) });

    return balances;
  },

  getBalance: (chainId: string, address: string) => {
    const { balances } = get();
    const chainBalances = balances.get(chainId);
    return chainBalances?.get(address);
  },

  clearBalances: () => {
    set({ balances: new Map() });
  },

  subscribeToBalanceUpdates: (chainId: string, address: string) => {
    const chain = get().getChain(chainId);
    if (!chain) {
      console.warn(`Cannot subscribe: Chain ${chainId} not found`);
      return;
    }

    const key = `${chainId}:${address}`;
    const { subscriptions } = get();

    // Already subscribed
    if (subscriptions.has(key)) {
      return;
    }

    const ws = getChainWebSocket(chain.rpc);

    // Subscribe to transactions affecting this address
    const subscriptionId = ws.subscribeToAddress(address, async (txResult) => {
      console.log('Transaction detected for', address, txResult);
      
      // Clear existing timeout for this chainId:address to prevent queue buildup
      const state = get();
      const existingTimeout = state.timeoutHandles.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      // Debounce balance refresh
      const timeoutHandle = setTimeout(() => {
        get().fetchBalance(chainId, address).catch(console.error);
        // Clean up the timeout handle after execution
        set((currentState) => {
          const newHandles = new Map(currentState.timeoutHandles);
          newHandles.delete(key);
          return { timeoutHandles: newHandles };
        });
      }, 1000);
      
      // Update state with the new timeout handle
      set((currentState) => {
        const newHandles = new Map(currentState.timeoutHandles);
        newHandles.set(key, timeoutHandle);
        return { timeoutHandles: newHandles };
      });
    });

    subscriptions.set(key, subscriptionId);
    set({ subscriptions: new Map(subscriptions), isSubscribed: subscriptions.size > 0 });

    console.log(`Subscribed to balance updates for ${address} on ${chainId}`);
  },

  unsubscribeFromBalanceUpdates: (chainId: string, address: string) => {
    const chain = get().getChain(chainId);
    if (!chain) return;

    const key = `${chainId}:${address}`;
    const { subscriptions, timeoutHandles } = get();
    const subscriptionId = subscriptions.get(key);

    if (subscriptionId) {
      const ws = getChainWebSocket(chain.rpc);
      ws.unsubscribe(subscriptionId);
      subscriptions.delete(key);
      
      // Clear any pending timeout for this subscription
      const timeoutHandle = timeoutHandles.get(key);
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandles.delete(key);
      }
      
      // Update isSubscribed based on whether there are any remaining subscriptions
      set({ 
        subscriptions: new Map(subscriptions),
        timeoutHandles: new Map(timeoutHandles),
        isSubscribed: subscriptions.size > 0
      });
      console.log(`Unsubscribed from balance updates for ${address} on ${chainId}`);
    }
  },

  unsubscribeAll: () => {
    // Clear all pending timeouts
    const { timeoutHandles } = get();
    timeoutHandles.forEach((handle) => clearTimeout(handle));
    
    disconnectAllWebSockets();
    set({ subscriptions: new Map(), timeoutHandles: new Map(), isSubscribed: false });
    console.log('Unsubscribed from all balance updates');
  },
}));
