type StorageKeySpec = string | string[] | Record<string, any> | null | undefined;

type StorageArea = {
  get: (keys?: StorageKeySpec) => Promise<Record<string, any>>;
  set: (items: Record<string, any>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
};

function safeJsonParse(value: string | null): any {
  if (value === null) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function makeStorageArea(storage: Storage): StorageArea {
  const getAll = (): Record<string, any> => {
    const out: Record<string, any> = {};
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      out[key] = safeJsonParse(storage.getItem(key));
    }
    return out;
  };

  const getOne = (key: string): any => safeJsonParse(storage.getItem(key));

  return {
    async get(keys?: StorageKeySpec): Promise<Record<string, any>> {
      if (keys == null) {
        return getAll();
      }

      if (typeof keys === 'string') {
        return { [keys]: getOne(keys) };
      }

      if (Array.isArray(keys)) {
        const out: Record<string, any> = {};
        for (const key of keys) out[key] = getOne(key);
        return out;
      }

      // Object = default values. Overlay stored values onto defaults.
      const out: Record<string, any> = { ...keys };
      for (const key of Object.keys(keys)) {
        const stored = getOne(key);
        if (stored !== undefined) out[key] = stored;
      }
      return out;
    },

    async set(items: Record<string, any>): Promise<void> {
      for (const [key, value] of Object.entries(items)) {
        storage.setItem(key, JSON.stringify(value));
      }
    },

    async remove(keys: string | string[]): Promise<void> {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) storage.removeItem(key);
    },

    async clear(): Promise<void> {
      storage.clear();
    },
  };
}

const browser = {
  runtime: {
    // In the web build there is no background service worker to message.
    async sendMessage(_message: any): Promise<any> {
      return undefined;
    },

    // Used only in extension injection code; harmless stub for web.
    getURL(path: string): string {
      return new URL(path, window.location.origin).toString();
    },

    onMessage: {
      addListener(_listener: (...args: any[]) => any) {
        // no-op
      },
      removeListener(_listener: (...args: any[]) => any) {
        // no-op
      },
    },
  },

  tabs: {
    async create(options: { url: string }): Promise<void> {
      // Best-effort equivalent of opening a new tab.
      window.open(options.url, '_blank', 'noopener,noreferrer');
    },
  },

  storage: {
    local: makeStorageArea(window.localStorage),
    session: makeStorageArea(window.sessionStorage),
  },
} as const;

export default browser;
