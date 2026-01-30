/**
 * Swap Router - Multi-hop swap routing for BeeZee DEX
 *
 * Finds optimal routes through liquidity pools to swap tokens.
 * Supports up to 3 hops (4 tokens in the path).
 */

export interface LiquidityPool {
  id: string;
  base: string;
  quote: string;
  reserve_base: string;
  reserve_quote: string;
  fee: string;
}

export interface PoolEdge {
  poolId: string;
  targetDenom: string;
  reserveIn: bigint;
  reserveOut: bigint;
  fee: number;
}

export interface SwapRoute {
  path: string[]; // [denomA, denomB, denomC, ...]
  pools: string[]; // [pool1, pool2, ...]
  estimatedOutput: bigint;
  priceImpact: number;
  totalFee: number;
  hops: number;
}

/**
 * Pool Graph for routing
 */
class PoolGraph {
  private edges: Map<string, PoolEdge[]> = new Map();
  private allDenoms: Set<string> = new Set();

  constructor(pools: LiquidityPool[]) {
    this.buildGraph(pools);
  }

  private buildGraph(pools: LiquidityPool[]): void {
    for (const pool of pools) {
      this.allDenoms.add(pool.base);
      this.allDenoms.add(pool.quote);

      const feePercent = parseFloat(pool.fee);

      // Add edge from base to quote
      const baseEdges = this.edges.get(pool.base) || [];
      baseEdges.push({
        poolId: pool.id,
        targetDenom: pool.quote,
        reserveIn: BigInt(pool.reserve_base),
        reserveOut: BigInt(pool.reserve_quote),
        fee: feePercent,
      });
      this.edges.set(pool.base, baseEdges);

      // Add edge from quote to base
      const quoteEdges = this.edges.get(pool.quote) || [];
      quoteEdges.push({
        poolId: pool.id,
        targetDenom: pool.base,
        reserveIn: BigInt(pool.reserve_quote),
        reserveOut: BigInt(pool.reserve_base),
        fee: feePercent,
      });
      this.edges.set(pool.quote, quoteEdges);
    }
  }

  getEdges(denom: string): PoolEdge[] {
    return this.edges.get(denom) || [];
  }

  getAllDenoms(): string[] {
    return Array.from(this.allDenoms);
  }
}

/**
 * Calculate output amount using constant product formula (x * y = k)
 */
function calculateSwapOutput(
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
  feePercent: number
): bigint {
  if (inputAmount <= 0n || inputReserve <= 0n || outputReserve <= 0n) {
    return 0n;
  }

  // Apply fee (fee is taken from input)
  const feeMultiplier = BigInt(Math.floor((1 - feePercent) * 10000));
  const inputWithFee = (inputAmount * feeMultiplier) / 10000n;

  // Constant product formula
  const numerator = inputWithFee * outputReserve;
  const denominator = inputReserve + inputWithFee;

  return numerator / denominator;
}

/**
 * Calculate price impact for a swap
 */
function calculatePriceImpact(inputAmount: bigint, inputReserve: bigint): number {
  if (inputReserve <= 0n) return 100;
  // Use bigint arithmetic to avoid precision loss, then convert bounded result to number.
  // Calculate price impact in basis points (hundredths of a percent).
  const impactBasisPoints = (inputAmount * 10000n) / inputReserve;
  return Number(impactBasisPoints) / 100;
}

/**
 * Find all routes from source to target within maxHops
 */
function findAllRoutes(
  graph: PoolGraph,
  fromDenom: string,
  toDenom: string,
  inputAmount: bigint,
  maxHops: number
): SwapRoute[] {
  const routes: SwapRoute[] = [];

  // BFS with path tracking
  interface PathState {
    currentDenom: string;
    path: string[];
    pools: string[];
    currentAmount: bigint;
    totalFee: number;
    totalPriceImpact: number;
  }

  const queue: PathState[] = [
    {
      currentDenom: fromDenom,
      path: [fromDenom],
      pools: [],
      currentAmount: inputAmount,
      totalFee: 0,
      totalPriceImpact: 0,
    },
  ];

  while (queue.length > 0) {
    const state = queue.shift()!;

    // Skip if we've exceeded max hops
    if (state.pools.length >= maxHops) {
      continue;
    }

    const edges = graph.getEdges(state.currentDenom);

    for (const edge of edges) {
      // Skip if we've already visited this denom (no cycles)
      if (state.path.includes(edge.targetDenom)) {
        continue;
      }

      // Skip if we've already used this pool
      if (state.pools.includes(edge.poolId)) {
        continue;
      }

      // Calculate output for this hop
      const output = calculateSwapOutput(
        state.currentAmount,
        edge.reserveIn,
        edge.reserveOut,
        edge.fee
      );

      if (output <= 0n) {
        continue;
      }

      const hopPriceImpact = calculatePriceImpact(state.currentAmount, edge.reserveIn);
      const newPath = [...state.path, edge.targetDenom];
      const newPools = [...state.pools, edge.poolId];
      const newTotalFee = state.totalFee + edge.fee;
      const newTotalPriceImpact = state.totalPriceImpact + hopPriceImpact;

      // If we've reached the target, add this route
      if (edge.targetDenom === toDenom) {
        routes.push({
          path: newPath,
          pools: newPools,
          estimatedOutput: output,
          priceImpact: newTotalPriceImpact,
          totalFee: newTotalFee,
          hops: newPools.length,
        });
      } else {
        // Continue exploring
        queue.push({
          currentDenom: edge.targetDenom,
          path: newPath,
          pools: newPools,
          currentAmount: output,
          totalFee: newTotalFee,
          totalPriceImpact: newTotalPriceImpact,
        });
      }
    }
  }

  return routes;
}

/**
 * Find the best route from source to target
 */
export function findBestRoute(
  pools: LiquidityPool[],
  fromDenom: string,
  toDenom: string,
  inputAmount: bigint,
  maxHops: number = 3
): SwapRoute | null {
  if (fromDenom === toDenom) {
    return null;
  }

  const graph = new PoolGraph(pools);
  const routes = findAllRoutes(graph, fromDenom, toDenom, inputAmount, maxHops);

  if (routes.length === 0) {
    return null;
  }

  // Sort by output amount (descending) - best route first
  routes.sort((a, b) => {
    if (b.estimatedOutput > a.estimatedOutput) return 1;
    if (b.estimatedOutput < a.estimatedOutput) return -1;
    // If same output, prefer fewer hops
    return a.hops - b.hops;
  });

  return routes[0];
}

/**
 * Find all possible routes (for display/selection)
 */
export function findAllPossibleRoutes(
  pools: LiquidityPool[],
  fromDenom: string,
  toDenom: string,
  inputAmount: bigint,
  maxHops: number = 3,
  limit: number = 5
): SwapRoute[] {
  if (fromDenom === toDenom) {
    return [];
  }

  const graph = new PoolGraph(pools);
  const routes = findAllRoutes(graph, fromDenom, toDenom, inputAmount, maxHops);

  // Sort by output amount
  routes.sort((a, b) => {
    if (b.estimatedOutput > a.estimatedOutput) return 1;
    if (b.estimatedOutput < a.estimatedOutput) return -1;
    return a.hops - b.hops;
  });

  return routes.slice(0, limit);
}

/**
 * Check if a direct route exists
 */
export function hasDirectRoute(
  pools: LiquidityPool[],
  fromDenom: string,
  toDenom: string
): boolean {
  return pools.some(
    (pool) =>
      (pool.base === fromDenom && pool.quote === toDenom) ||
      (pool.base === toDenom && pool.quote === fromDenom)
  );
}

/**
 * Get all tokens that can be reached from a source token
 */
export function getReachableTokens(
  pools: LiquidityPool[],
  fromDenom: string,
  maxHops: number = 3
): Set<string> {
  const graph = new PoolGraph(pools);
  const reachable = new Set<string>();
  const visited = new Set<string>();

  interface State {
    denom: string;
    hops: number;
  }

  const queue: State[] = [{ denom: fromDenom, hops: 0 }];

  while (queue.length > 0) {
    const { denom, hops } = queue.shift()!;

    if (visited.has(denom)) continue;
    visited.add(denom);

    if (denom !== fromDenom) {
      reachable.add(denom);
    }

    if (hops >= maxHops) continue;

    for (const edge of graph.getEdges(denom)) {
      if (!visited.has(edge.targetDenom)) {
        queue.push({ denom: edge.targetDenom, hops: hops + 1 });
      }
    }
  }

  return reachable;
}
