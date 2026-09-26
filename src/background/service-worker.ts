type Message = { type: string; payload?: unknown };

const handlers: Record<string, (payload: unknown) => Promise<unknown>> = {
  async 'chain:getRegistry'() {
    const { CHAIN_REGISTRY } = await import('../lib/assets/chainRegistry');
    return CHAIN_REGISTRY;
  },
  async 'ping'() {
    return 'pong';
  },
};

self.addEventListener('install', () => {
  // Activate immediately on deploy.
  self.skipWaiting();
});

self.addEventListener('message', (event: MessageEvent<Message>) => {
  const { type, payload } = event.data ?? {};
  const handler = handlers[type];
  if (!handler) return;
  handler(payload)
    .then((result) => event.source?.postMessage({ ok: true, result }))
    .catch((err: unknown) => event.source?.postMessage({ ok: false, error: String(err) }));
});

export {};
