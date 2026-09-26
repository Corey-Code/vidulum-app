# Adding a Network Type

1. Extend the network type union in the shared config module.
2. Wire the type into the registry loaders under `src/lib/assets/`.
3. Update the background service worker routing if the type needs new message handlers.
4. Add tests for the new type's message flow.
