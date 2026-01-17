import { StargateClient, SigningStargateClient, defaultRegistryTypes } from '@cosmjs/stargate';
import { OfflineSigner, GeneratedType, Registry } from '@cosmjs/proto-signing';
import { Balance } from '@/types/wallet';
import { fetchWithFailover, withFailover, getHealthyEndpoint } from '@/lib/networks';

// Simple protobuf encoder for BZE messages (no eval required)
// Protobuf wire format: tag = (field_number << 3) | wire_type
// Wire type 2 = length-delimited (strings)

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 127) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return bytes;
}

function encodeString(fieldNumber: number, value: string): number[] {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(value);
  const tag = (fieldNumber << 3) | 2; // wire type 2 = length-delimited
  return [...encodeVarint(tag), ...encodeVarint(strBytes.length), ...strBytes];
}

// MsgJoinStaking: creator (1), reward_id (2), amount (3)
function encodeMsgJoinStaking(message: { creator: string; reward_id: string; amount: string }): Uint8Array {
  const bytes: number[] = [];
  if (message.creator) bytes.push(...encodeString(1, message.creator));
  if (message.reward_id) bytes.push(...encodeString(2, message.reward_id));
  if (message.amount) bytes.push(...encodeString(3, message.amount));
  return new Uint8Array(bytes);
}

// MsgExitStaking: creator (1), reward_id (2)
function encodeMsgExitStaking(message: { creator: string; reward_id: string }): Uint8Array {
  const bytes: number[] = [];
  if (message.creator) bytes.push(...encodeString(1, message.creator));
  if (message.reward_id) bytes.push(...encodeString(2, message.reward_id));
  return new Uint8Array(bytes);
}

// MsgClaimStakingRewards: creator (1), reward_id (2)
function encodeMsgClaimStakingRewards(message: { creator: string; reward_id: string }): Uint8Array {
  const bytes: number[] = [];
  if (message.creator) bytes.push(...encodeString(1, message.creator));
  if (message.reward_id) bytes.push(...encodeString(2, message.reward_id));
  return new Uint8Array(bytes);
}

// Create CosmJS-compatible message type
function createMsgType<T>(
  encoder: (msg: T) => Uint8Array,
  defaults: T
): GeneratedType {
  return {
    encode(message: T): { finish(): Uint8Array } {
      return {
        finish: () => encoder(message),
      };
    },
    decode(): T {
      // Decoding not needed for signing
      return defaults;
    },
    fromPartial(object: Partial<T>): T {
      return { ...defaults, ...object };
    },
  } as GeneratedType;
}

// Create a custom registry with BZE types
// Type URLs from: https://unpkg.com/@bze/bzejs/bze/rewards/tx.registry.js
function createBzeRegistry(): Registry {
  const registry = new Registry(defaultRegistryTypes);
  
  // Register BZE rewards module types with manual encoders
  registry.register(
    '/bze.rewards.MsgJoinStaking',
    createMsgType(encodeMsgJoinStaking, { creator: '', reward_id: '', amount: '' })
  );
  registry.register(
    '/bze.rewards.MsgExitStaking',
    createMsgType(encodeMsgExitStaking, { creator: '', reward_id: '' })
  );
  registry.register(
    '/bze.rewards.MsgClaimStakingRewards',
    createMsgType(encodeMsgClaimStakingRewards, { creator: '', reward_id: '' })
  );
  
  return registry;
}

export class CosmosClient {
  private clients: Map<string, StargateClient> = new Map();
  private bzeRegistry: Registry;

  constructor() {
    this.bzeRegistry = createBzeRegistry();
  }

  /**
   * Get a StargateClient for a single RPC endpoint
   * For failover support, use getClientWithFailover instead
   */
  async getClient(rpcEndpoint: string): Promise<StargateClient> {
    if (!this.clients.has(rpcEndpoint)) {
      const client = await StargateClient.connect(rpcEndpoint);
      this.clients.set(rpcEndpoint, client);
    }
    return this.clients.get(rpcEndpoint)!;
  }

  /**
   * Get a StargateClient with automatic failover across multiple RPC endpoints
   */
  async getClientWithFailover(rpcEndpoints: string[]): Promise<{ client: StargateClient; endpoint: string }> {
    const { result: client, endpoint } = await withFailover(
      rpcEndpoints,
      async (rpcEndpoint) => {
        // Don't reuse cached clients for failover - create fresh connections
        const client = await StargateClient.connect(rpcEndpoint);
        return client;
      }
    );
    
    // Cache the successful client
    this.clients.set(endpoint, client);
    
    return { client, endpoint };
  }

  /**
   * Get a SigningStargateClient for a single RPC endpoint
   */
  async getSigningClient(
    rpcEndpoint: string,
    signer: OfflineSigner
  ): Promise<SigningStargateClient> {
    // Use the custom registry with BZE types
    return await SigningStargateClient.connectWithSigner(rpcEndpoint, signer, {
      registry: this.bzeRegistry,
    });
  }

  /**
   * Get a SigningStargateClient with automatic failover across multiple RPC endpoints
   */
  async getSigningClientWithFailover(
    rpcEndpoints: string[],
    signer: OfflineSigner
  ): Promise<{ client: SigningStargateClient; endpoint: string }> {
    const { result: client, endpoint } = await withFailover(
      rpcEndpoints,
      async (rpcEndpoint) => {
        return await SigningStargateClient.connectWithSigner(rpcEndpoint, signer, {
          registry: this.bzeRegistry,
        });
      }
    );
    
    return { client, endpoint };
  }

  /**
   * Get balance using REST API with automatic failover
   * Falls back to RPC if all REST endpoints fail
   */
  async getBalance(
    rpcEndpoints: string | string[],
    address: string,
    restEndpoints?: string | string[]
  ): Promise<Balance[]> {
    // Normalize to arrays
    const rpcArray = Array.isArray(rpcEndpoints) ? rpcEndpoints : [rpcEndpoints];
    const restArray = restEndpoints 
      ? (Array.isArray(restEndpoints) ? restEndpoints : [restEndpoints])
      : rpcArray.map(rpc => rpc.replace('rpc.', 'rest.').replace('/rpc', '/rest'));
    
    // Try REST API first with failover
    try {
      const data = await fetchWithFailover<{ balances: Array<{ denom: string; amount: string }> }>(
        restArray,
        `/cosmos/bank/v1beta1/balances/${address}`
      );
      
      if (data.balances && Array.isArray(data.balances)) {
        console.log('Fetched balances via REST:', data.balances);
        return data.balances.map((b) => ({
          denom: b.denom,
          amount: b.amount,
        }));
      }
    } catch (error) {
      console.error('REST balance fetch failed, falling back to RPC:', error);
    }
    
    // Fallback to RPC with failover if REST fails
    const { client } = await this.getClientWithFailover(rpcArray);
    const balances = await client.getAllBalances(address);
    console.log('Fetched balances via RPC:', balances);
    return balances.map((b) => ({
      denom: b.denom,
      amount: b.amount,
    }));
  }

  /**
   * Get account info with automatic failover
   */
  async getAccount(rpcEndpoints: string | string[], address: string) {
    const rpcArray = Array.isArray(rpcEndpoints) ? rpcEndpoints : [rpcEndpoints];
    const { client } = await this.getClientWithFailover(rpcArray);
    return await client.getAccount(address);
  }

  disconnect(rpcEndpoint: string) {
    const client = this.clients.get(rpcEndpoint);
    if (client) {
      client.disconnect();
      this.clients.delete(rpcEndpoint);
    }
  }

  disconnectAll() {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }
}

export const cosmosClient = new CosmosClient();
