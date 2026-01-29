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
        // Wait for existing connection attempt
        const checkConnection = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected to', this.wsUrl);
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

          resolve();
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
          this.isConnecting = false;
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnecting = false;
          this.attemptReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
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
    this.unsubscribeAll();
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
