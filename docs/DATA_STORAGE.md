# Data Storage Documentation

This document describes how Vidulum App stores user data, including encryption methods, storage locations, and security considerations.

## Overview

Vidulum App runs in two modes with different storage backends:

| Mode                  | Storage API                                         | Persistence                |
| --------------------- | --------------------------------------------------- | -------------------------- |
| Browser Extension     | `browser.storage.local` / `browser.storage.session` | Extension-isolated storage |
| Web App (vidulum.app) | `localStorage` / `sessionStorage`                   | Domain-isolated storage    |

Both modes use the same encryption and data structures. The web app includes a polyfill that maps the WebExtension Storage API to browser Web Storage APIs.

## Storage Types

### Persistent Storage

**Extension:** `browser.storage.local`  
**Web App:** `localStorage`

Data stored here persists across browser sessions and restarts.

| Key                   | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `vidulum_app`         | Encrypted wallet data including mnemonic and accounts |
| `vidulum_preferences` | User preferences and settings                         |

Note: Storage key prefixes use `vidulum_` for backward compatibility with existing installations.

#### Wallet Data Structure

```typescript
interface StoredWallet {
  version: number; // Storage schema version for migrations
  encryptedMnemonic: string; // AES-256-GCM encrypted
  salt: string; // Random 16-byte salt (hex encoded)
  accounts: SerializedAccount[];
  importedAccounts?: ImportedAccount[];
}

interface SerializedAccount {
  id: string;
  name: string;
  address: string; // Public address
  pubKey: string; // Base64 encoded public key
  algo: string; // Signing algorithm (secp256k1)
  hdPath: string; // BIP44 derivation path
  accountIndex: number;
}

interface ImportedAccount {
  account: SerializedAccount;
  encryptedMnemonic: string; // Separate encryption per imported account
  salt: string;
}
```

#### Preferences Data Structure

```typescript
interface StoredPreferences {
  version: number; // Storage schema version for migrations
  selectedAccountId?: string;
  selectedChainId?: string;
  autoLockMinutes?: number; // Default: 15, 0 = disabled
}
```

### Session Storage

**Extension:** `browser.storage.session`  
**Web App:** `sessionStorage`

Data stored here is cleared when the browser closes (or tab closes for web app).

| Key                | Description                           |
| ------------------ | ------------------------------------- |
| `vidulum_session`  | Session ID indicating unlocked state  |
| `serializedWallet` | Cached keyring with derived addresses |
| `lastActivity`     | Timestamp for auto-lock feature       |

## Encryption

### Algorithm

- **Cipher**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2
- **Hash Function**: SHA-256
- **Iterations**: 100,000
- **Salt Length**: 16 bytes (random)
- **IV Length**: 12 bytes (random per encryption)

### Encryption Flow

1. User provides password
2. Random 16-byte salt is generated
3. PBKDF2 derives a 256-bit key from password + salt
4. Random 12-byte IV is generated
5. Mnemonic is encrypted with AES-256-GCM using derived key and IV
6. IV is prepended to ciphertext
7. Result is Base64 encoded for storage

### Decryption Flow

1. User provides password
2. Stored salt is retrieved
3. PBKDF2 derives the same key from password + salt
4. IV is extracted from stored ciphertext (first 12 bytes)
5. AES-256-GCM decrypts the remaining data
6. Plaintext mnemonic is returned

## Physical Storage Locations

### Web App (vidulum.app)

Web app data is stored in the browser's Web Storage for the `vidulum.app` origin:

- **localStorage**: Persistent wallet data (encrypted mnemonic, accounts, preferences)
- **sessionStorage**: Session data (cleared when tab closes)

Data is isolated to the `vidulum.app` domain and cannot be accessed by other websites.

### Browser Extension

#### Chrome / Chromium-based Browsers

**Linux:**

```
~/.config/google-chrome/Default/Local Extension Settings/<extension-id>/
```

**macOS:**

```
~/Library/Application Support/Google/Chrome/Default/Local Extension Settings/<extension-id>/
```

**Windows:**

```
%LOCALAPPDATA%\Google\Chrome\User Data\Default\Local Extension Settings\<extension-id>\
```

### Firefox

**Linux:**

```
~/.mozilla/firefox/<profile>/storage/default/moz-extension+++<extension-id>/
```

**macOS:**

```
~/Library/Application Support/Firefox/Profiles/<profile>/storage/default/moz-extension+++<extension-id>/
```

### Extension ID

- **Chrome Web Store**: Fixed ID assigned by Google
- **Unpacked/Developer Mode**: Hash generated from extension path (may change if reloaded)

## Security Considerations

### What IS Protected

- Mnemonic phrase is always encrypted at rest
- Each imported account has its own encryption salt
- Session data is cleared on browser close
- Auto-lock clears session after inactivity

### What IS NOT Protected

- Account names and addresses are stored unencrypted (needed for UI without password)
- Selected chain and account preferences are unencrypted
- Data is accessible to anyone with filesystem access to the browser profile

### Threat Model

| Threat                       | Mitigation                             |
| ---------------------------- | -------------------------------------- |
| Attacker reads storage files | Mnemonic encrypted with AES-256-GCM    |
| Weak password brute force    | 100,000 PBKDF2 iterations slow attacks |
| Memory dump while unlocked   | Session storage used, cleared on lock  |
| Browser extension compromise | Storage isolated per extension origin  |
| Physical device access       | User must set strong password          |

### Recommendations for Users

1. Use a strong, unique password
2. Enable auto-lock (default 15 minutes)
3. Always backup mnemonic phrase externally
4. Lock wallet when not in use
5. Do not install untrusted browser extensions

## Data Lifecycle

### Wallet Creation

1. User creates password
2. New mnemonic generated (24 words, BIP39)
3. Mnemonic encrypted with password
4. Initial account derived (BIP44 path m/44'/0'/0'/0/0)
5. Encrypted wallet saved to `storage.local`

### Wallet Unlock

1. User enters password
2. Encrypted mnemonic retrieved from `storage.local`
3. Mnemonic decrypted with password
4. Keyring initialized with mnemonic
5. Session ID saved to `storage.session`
6. Derived addresses cached in session

### Wallet Lock

1. Keyring cleared from memory
2. Session storage cleared
3. User must re-enter password to access

### Wallet Deletion

1. All data removed from `storage.local`
2. Session storage cleared
3. No recovery possible without mnemonic backup

## Backup and Recovery

### What Users Should Backup

- 24-word mnemonic phrase (written down, stored securely offline)

### Recovery Process

1. Install extension (new or existing)
2. Select "Import Wallet"
3. Enter mnemonic phrase
4. Set new password
5. All accounts derived from mnemonic are restored

### What Cannot Be Recovered

- Custom account names (stored locally only)
- Imported accounts from different mnemonics (each requires its own backup)
- User preferences

## Developer Notes

### Inspecting Storage (Development)

1. Open `chrome://extensions`
2. Find the extension
3. Click "Inspect views: service worker" or popup
4. Go to DevTools > Application > Storage > Extension Storage

### Clearing Storage (Development)

```javascript
// In extension console
chrome.storage.local.clear();
chrome.storage.session.clear();
```

### Storage Limits

- `storage.local`: 5MB (can request `unlimitedStorage` permission)
- `storage.session`: 10MB (Chrome), varies by browser

## Storage Versioning & Migrations

The storage layer includes a versioning system to handle schema changes without losing user data.

### How It Works

1. Each stored data type (wallet, preferences) includes a `version` field
2. When data is loaded, the version is checked against the current expected version
3. If the stored version is older, migration functions run sequentially to upgrade the data
4. The migrated data is automatically saved back to storage

### Adding a New Migration

When the storage schema needs to change:

1. Increment `CURRENT_STORAGE_VERSION` (or `CURRENT_PREFERENCES_VERSION`)
2. Add a migration function in the `MIGRATIONS` object:

```typescript
const MIGRATIONS: Record<number, MigrationFn> = {
  // Existing migrations...
  0: (data) => ({ ...data, version: 1 }),

  // New migration from version 1 to 2
  1: (data: StoredWalletV1): StoredWalletV2 => {
    return {
      ...data,
      version: 2,
      newField: 'default value', // Add new fields with defaults
    };
  },
};
```

### Migration Guidelines

- Migrations must be **idempotent** and **non-destructive**
- Always provide default values for new required fields
- Never remove data that might be needed for rollback
- Test migrations with real user data structures
- Migrations run automatically on unlock/load

### Current Versions

| Data Type   | Version | Description              |
| ----------- | ------- | ------------------------ |
| Wallet      | 1       | Initial versioned schema |
| Preferences | 1       | Initial versioned schema |

## Version History

| Version | Changes                                                    |
| ------- | ---------------------------------------------------------- |
| 1.0.0   | Initial storage implementation with AES-256-GCM encryption |
| 1.1.0   | Added storage versioning and migration system              |
