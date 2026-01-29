/**
 * WebSocket subscription manager for real-time blockchain events
 * Connects to Tendermint RPC WebSocket to listen for account-related transactions
 */

type EventCallback = (data: any) => void;

interface Subscription {
  query: string;
  callback: EventCallback;
}

export class ChainWebSocket {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private wsUrl: string;
  private isConnecting = false;
  private messageId = 0;
  private pendingSubscriptions: Map<string, Subscription> = new Map();
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private readonly CONNECTION_TIMEOUT_MS = 10000; // 10 second timeout
  private intentionalDisconnect = false;

  constructor(rpcUrl: string) {
    // Convert HTTP RPC URL to WebSocket URL
    this.wsUrl = rpcUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://')
      .replace(/\/$/, '') + '/websocket';
  }

  /**
   * Connect to the WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // Wait for existing connection attempt to complete
        // Store resolve/reject to be called when current attempt finishes
        let settled = false;
        const checkInterval = setInterval(() => {
          if (!this.isConnecting) {
            clearInterval(checkInterval);
            if (!settled) {
              settled = true;
              if (this.ws?.readyState === WebSocket.OPEN) {
                resolve();
              } else {
                reject(new Error('Connection attempt failed'));
              }
            }
          }
        }, 100);

        // Add timeout for the polling to prevent indefinite waiting
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!settled) {
            settled = true;
            reject(new Error('Connection timeout while waiting for existing attempt'));
          }
        }, this.CONNECTION_TIMEOUT_MS);
        return;
      }

      this.isConnecting = true;
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.intentionalDisconnect = false; // Reset flag on new connection attempt

      // Set up connection timeout
      this.connectionTimeout = setTimeout(() => {
        this.cleanupConnection();
        const rejectFn = this.connectReject;
        this.connectReject = null;
        this.connectResolve = null;
        if (rejectFn) {
          rejectFn(new Error('WebSocket connection timeout'));
        }
      }, this.CONNECTION_TIMEOUT_MS);

      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected to', this.wsUrl);
          this.clearConnectionTimeout();
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          // Resubscribe to any pending subscriptions
          this.pendingSubscriptions.forEach((sub, id) => {
            this.sendSubscribe(id, sub.query);
          });
          this.pendingSubscriptions.clear();

          // Resubscribe to existing subscriptions after reconnect
          this.subscriptions.forEach((sub, id) => {
            this.sendSubscribe(id, sub.query);
          });

          // Resolve the promise
          const resolveFn = this.connectResolve;
          this.connectResolve = null;
          this.connectReject = null;
          if (resolveFn) {
            resolveFn();
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.clearConnectionTimeout();
          this.isConnecting = false;

          // Reject the promise if it hasn't been resolved yet
          const rejectFn = this.connectReject;
          this.connectReject = null;
          this.connectResolve = null;
          if (rejectFn) {
            rejectFn(new Error('WebSocket connection error'));
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.clearConnectionTimeout();
          this.isConnecting = false;

          // Reject the promise if it hasn't been resolved yet
          const rejectFn = this.connectReject;
          this.connectReject = null;
          this.connectResolve = null;
          if (rejectFn) {
            rejectFn(new Error('WebSocket connection closed before opening'));
          }

          // Only attempt reconnection if this was not an intentional disconnect
          if (!this.intentionalDisconnect) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        this.clearConnectionTimeout();
        this.isConnecting = false;
        const rejectFn = this.connectReject;
        this.connectReject = null;
        this.connectResolve = null;
        if (rejectFn) {
          rejectFn(error as Error);
        } else {
          reject(error);
        }
      }
    });
  }

  /**
   * Clear the connection timeout if it exists
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  /**
   * Clean up connection state and timeout
   */
  private cleanupConnection(): void {
    this.clearConnectionTimeout();
    this.isConnecting = false;
    if (this.ws) {
      const state = this.ws.readyState;
      // Only attempt to close if WebSocket is CONNECTING or OPEN
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        try {
          this.ws.close();
        } catch (error) {
          console.error('Error closing WebSocket during cleanup:', error);
        }
      }
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  /**
   * Send a subscription request
   */
  private sendSubscribe(id: string, query: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.pendingSubscriptions.set(id, { query, callback: () => {} });
      return;
    }

    const request = {
      jsonrpc: '2.0',
      method: 'subscribe',
      id: this.messageId++,
      params: {
        query: query,
      },
    };

    this.ws.send(JSON.stringify(request));
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: any): void {
    // Check if this is an event notification
    if (data.result?.data?.type === 'tendermint/event/Tx') {
      const txResult = data.result.data.value?.TxResult;
      if (txResult) {
        const eventQuery = data.result?.query;

        if (typeof eventQuery === 'string' && eventQuery.length > 0) {
          // Route event only to subscriptions whose query matches the event query
          this.subscriptions.forEach((sub) => {
            if (sub.query === eventQuery) {
              sub.callback(txResult);
            }
          });
        } else {
          // Fallback: if the event does not include a query, notify all subscriptions
          this.subscriptions.forEach((sub) => {
            sub.callback(txResult);
          });
        }
      }
    }

    // Also handle NewBlock events for more frequent updates
    if (data.result?.data?.type === 'tendermint/event/NewBlock') {
      this.subscriptions.forEach((sub) => {
        if (sub.query.includes('NewBlock')) {
          sub.callback(data.result.data.value);
        }
      });
    }
  }

  /**
   * Subscribe to transactions affecting a specific address
   */
  subscribeToAddress(address: string, callback: EventCallback): string {
    const subscriptionId = `addr-${address}-${Date.now()}`;

    // Query for transactions where the address is sender or recipient
    // This covers most transfer events
    const query = `tm.event='Tx' AND (transfer.sender='${address}' OR transfer.recipient='${address}' OR message.sender='${address}')`;

    this.subscriptions.set(subscriptionId, { query, callback });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(subscriptionId, query);
    } else {
      this.pendingSubscriptions.set(subscriptionId, { query, callback });
      this.connect().catch(console.error);
    }

    return subscriptionId;
  }

  /**
   * Subscribe to new blocks (useful for periodic balance refresh)
   */
  subscribeToNewBlocks(callback: EventCallback): string {
    const subscriptionId = `blocks-${Date.now()}`;
    const query = `tm.event='NewBlock'`;

    this.subscriptions.set(subscriptionId, { query, callback });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(subscriptionId, query);
    } else {
      this.pendingSubscriptions.set(subscriptionId, { query, callback });
      this.connect().catch(console.error);
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
    this.pendingSubscriptions.delete(subscriptionId);

    // Note: Tendermint doesn't have a clean unsubscribe for specific queries
    // The subscription just won't trigger callbacks anymore
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();

    if (this.ws?.readyState === WebSocket.OPEN) {
      const request = {
        jsonrpc: '2.0',
        method: 'unsubscribe_all',
        id: this.messageId++,
        params: {},
      };
      this.ws.send(JSON.stringify(request));
    }
  }

  /**
   * Disconnect the WebSocket
   */
  disconnect(): void {
    this.intentionalDisconnect = true;
    this.unsubscribeAll();
    this.clearConnectionTimeout();
    this.connectResolve = null;
    this.connectReject = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instances for each chain
const wsInstances: Map<string, ChainWebSocket> = new Map();

/**
 * Get or create a WebSocket instance for a chain
 */
export function getChainWebSocket(rpcUrl: string): ChainWebSocket {
  if (!wsInstances.has(rpcUrl)) {
    wsInstances.set(rpcUrl, new ChainWebSocket(rpcUrl));
  }
  return wsInstances.get(rpcUrl)!;
}

/**
 * Disconnect all WebSocket instances
 */
export function disconnectAllWebSockets(): void {
  wsInstances.forEach((ws) => ws.disconnect());
  wsInstances.clear();
}
