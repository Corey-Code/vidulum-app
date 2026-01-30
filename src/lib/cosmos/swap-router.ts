/**
 * Multi-hop swap router using graph-based pathfinding
 * Finds optimal routes through liquidity pools (max 3 hops)
 */

export interface LiquidityPool {
  id: string;
  base: string;
  quote: string;
  reserve_base: string;
  reserve_quote: string;
  fee: string;
}

export interface SwapRoute {
  pools: LiquidityPool[];
  path: string[]; // Token denoms in order: [input, hop1, hop2, output]
  outputAmount: bigint;
  totalFee: number; // Combined fee percentage
  priceImpact: number; // Percentage
}

interface GraphNode {
  denom: string;
  pools: Map<string, LiquidityPool>; // Map of neighbor denom -> pool
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

  // Constant product formula: outputAmount = (inputWithFee * outputReserve) / (inputReserve + inputWithFee)
  const numerator = inputWithFee * outputReserve;
  const denominator = inputReserve + inputWithFee;

  return numerator / denominator;
}

/**
 * Calculate price impact as percentage
 */
function calculatePriceImpact(
  inputAmount: bigint,
  inputReserve: bigint,
  outputAmount: bigint,
  outputReserve: bigint
): number {
  if (inputReserve <= 0n || outputReserve <= 0n) return 0;

  // Price before swap: outputReserve / inputReserve
  // Price after swap: (outputReserve - outputAmount) / (inputReserve + inputAmount)
  // Price impact = (priceBefore - priceAfter) / priceBefore * 100

  const priceBefore = Number(outputReserve) / Number(inputReserve);
  const priceAfter =
    Number(outputReserve - outputAmount) / Number(inputReserve + inputAmount);

  const impact = ((priceBefore - priceAfter) / priceBefore) * 100;
  return Math.max(0, impact);
}

/**
 * Build graph from liquidity pools
 */
function buildPoolGraph(pools: LiquidityPool[]): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  for (const pool of pools) {
    // Add base token node
    if (!graph.has(pool.base)) {
      graph.set(pool.base, { denom: pool.base, pools: new Map() });
    }
    // Add quote token node
    if (!graph.has(pool.quote)) {
      graph.set(pool.quote, { denom: pool.quote, pools: new Map() });
    }

    // Add bidirectional edges
    graph.get(pool.base)!.pools.set(pool.quote, pool);
    graph.get(pool.quote)!.pools.set(pool.base, pool);
  }

  return graph;
}

/**
 * Find all routes from input to output token using BFS (max 3 hops)
 */
function findAllRoutes(
  graph: Map<string, GraphNode>,
  inputDenom: string,
  outputDenom: string,
  maxHops: number = 3
): SwapRoute[] {
  const routes: SwapRoute[] = [];

  // BFS queue: [currentDenom, path, pools, visited]
  interface QueueItem {
    denom: string;
    path: string[];
    pools: LiquidityPool[];
    visited: Set<string>;
  }

  const queue: QueueItem[] = [
    {
      denom: inputDenom,
      path: [inputDenom],
      pools: [],
      visited: new Set([inputDenom]),
    },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Check if we've reached the destination
    if (current.denom === outputDenom && current.pools.length > 0) {
      routes.push({
        pools: current.pools,
        path: current.path,
        outputAmount: 0n, // Will be calculated later
        totalFee: 0, // Will be calculated later
        priceImpact: 0, // Will be calculated later
      });
      continue;
    }

    // Don't explore further if we've reached max hops
    if (current.pools.length >= maxHops) {
      continue;
    }

    // Explore neighbors
    const node = graph.get(current.denom);
    if (!node) continue;

    for (const [neighborDenom, pool] of node.pools) {
      // Skip if already visited
      if (current.visited.has(neighborDenom)) continue;

      const newVisited = new Set(current.visited);
      newVisited.add(neighborDenom);

      queue.push({
        denom: neighborDenom,
        path: [...current.path, neighborDenom],
        pools: [...current.pools, pool],
        visited: newVisited,
      });
    }
  }

  return routes;
}

/**
 * Calculate output amount for a multi-hop route
 */
function calculateRouteOutput(
  route: SwapRoute,
  inputAmount: bigint
): {
  outputAmount: bigint;
  totalFee: number;
  priceImpact: number;
} {
  let currentAmount = inputAmount;
  let totalFee = 0;
  let totalPriceImpact = 0;

  for (let i = 0; i < route.pools.length; i++) {
    const pool = route.pools[i];
    const inputDenom = route.path[i];
    const outputDenom = route.path[i + 1];

    // Determine reserves based on direction
    let inputReserve: bigint;
    let outputReserve: bigint;

    if (pool.base === inputDenom) {
      inputReserve = BigInt(pool.reserve_base);
      outputReserve = BigInt(pool.reserve_quote);
    } else {
      inputReserve = BigInt(pool.reserve_quote);
      outputReserve = BigInt(pool.reserve_base);
    }

    const feePercent = parseFloat(pool.fee);
    const outputAmount = calculateSwapOutput(
      currentAmount,
      inputReserve,
      outputReserve,
      feePercent
    );

    // Calculate price impact for this hop
    const hopPriceImpact = calculatePriceImpact(
      currentAmount,
      inputReserve,
      outputAmount,
      outputReserve
    );

    // Accumulate fees and price impact
    totalFee += feePercent;
    totalPriceImpact += hopPriceImpact;

    currentAmount = outputAmount;
  }

  return {
    outputAmount: currentAmount,
    totalFee,
    priceImpact: totalPriceImpact,
  };
}

/**
 * Find the best route considering output amount and fees
 * Returns null if no route is found
 */
export function findBestRoute(
  pools: LiquidityPool[],
  inputDenom: string,
  outputDenom: string,
  inputAmount: bigint,
  maxHops: number = 3
): SwapRoute | null {
  // Build graph
  const graph = buildPoolGraph(pools);

  // Check if input and output denoms exist in graph
  if (!graph.has(inputDenom) || !graph.has(outputDenom)) {
    return null;
  }

  // Find all possible routes
  const allRoutes = findAllRoutes(graph, inputDenom, outputDenom, maxHops);

  if (allRoutes.length === 0) {
    return null;
  }

  // Calculate output for each route and find the best one
  let bestRoute: SwapRoute | null = null;
  let bestOutput = 0n;

  for (const route of allRoutes) {
    const { outputAmount, totalFee, priceImpact } = calculateRouteOutput(route, inputAmount);

    route.outputAmount = outputAmount;
    route.totalFee = totalFee;
    route.priceImpact = priceImpact;

    // Select route with highest output amount
    if (outputAmount > bestOutput) {
      bestOutput = outputAmount;
      bestRoute = route;
    }
  }

  return bestRoute;
}

/**
 * Get pool IDs from a route (for MsgMultiSwap.routes field)
 */
export function getRoutePoolIds(route: SwapRoute): string[] {
  return route.pools.map((pool) => pool.id);
}

/**
 * Format route path for display (e.g., "PHOTON → BZE → VDL")
 */
export function formatRoutePath(route: SwapRoute, tokenSymbols: Map<string, string>): string {
  return route.path
    .map((denom) => tokenSymbols.get(denom) || denom)
    .join(' → ');
}
