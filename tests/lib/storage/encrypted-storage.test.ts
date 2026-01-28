/**
 * Encrypted Storage Tests
 *
 * Tests for wallet storage, encryption, and migrations
 */

import { EncryptedStorage } from '@/lib/storage/encrypted-storage';
import { KeyringAccount } from '@/lib/crypto/keyring';
import { mockBrowser } from '../../setup';

describe('EncryptedStorage', () => {
  const testPassword = 'test-password-123';
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  
  const testAccount: KeyringAccount = {
    id: 'account-1',
    name: 'Test Account',
    address: 'bze1abc123def456',
    pubKey: new Uint8Array([1, 2, 3, 4, 5]),
    algo: 'secp256k1',
    hdPath: "m/44'/118'/0'/0/0",
    accountIndex: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Version Constants', () => {
    it('should expose wallet version', () => {
      expect(EncryptedStorage.WALLET_VERSION).toBeDefined();
      expect(typeof EncryptedStorage.WALLET_VERSION).toBe('number');
      expect(EncryptedStorage.WALLET_VERSION).toBeGreaterThanOrEqual(1);
    });

    it('should expose preferences version', () => {
      expect(EncryptedStorage.PREFERENCES_VERSION).toBeDefined();
      expect(typeof EncryptedStorage.PREFERENCES_VERSION).toBe('number');
      expect(EncryptedStorage.PREFERENCES_VERSION).toBeGreaterThanOrEqual(1);
    });
  });

  describe('hasWallet', () => {
    it('should return true when wallet exists', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({
        vidulum_app: { encryptedMnemonic: 'test' },
      });

      const result = await EncryptedStorage.hasWallet();
      expect(result).toBe(true);
    });

    it('should return false when wallet does not exist', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({});

      const result = await EncryptedStorage.hasWallet();
      expect(result).toBe(false);
    });
  });

  describe('saveWallet', () => {
    it('should save wallet with version', async () => {
      await EncryptedStorage.saveWallet(testMnemonic, testPassword, [testAccount]);

      expect(mockBrowser.storage.local.set).toHaveBeenCalled();
      const savedData = mockBrowser.storage.local.set.mock.calls[0][0];
      expect(savedData.vidulum_app).toBeDefined();
      expect(savedData.vidulum_app.version).toBe(EncryptedStorage.WALLET_VERSION);
      expect(savedData.vidulum_app.encryptedMnemonic).toBeDefined();
      expect(savedData.vidulum_app.salt).toBeDefined();
      expect(savedData.vidulum_app.accounts).toHaveLength(1);
    });

    it('should serialize accounts correctly', async () => {
      await EncryptedStorage.saveWallet(testMnemonic, testPassword, [testAccount]);

      const savedData = mockBrowser.storage.local.set.mock.calls[0][0];
      const savedAccount = savedData.vidulum_app.accounts[0];
      
      expect(savedAccount.id).toBe(testAccount.id);
      expect(savedAccount.name).toBe(testAccount.name);
      expect(savedAccount.address).toBe(testAccount.address);
      expect(typeof savedAccount.pubKey).toBe('string'); // Base64 encoded
      expect(savedAccount.algo).toBe(testAccount.algo);
      expect(savedAccount.accountIndex).toBe(testAccount.accountIndex);
    });
  });

  describe('loadWallet', () => {
    it('should return null when no wallet exists', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({});

      const result = await EncryptedStorage.loadWallet(testPassword);
      expect(result).toBeNull();
    });
  });

  describe('loadWalletMetadata', () => {
    it('should load accounts without decrypting mnemonic', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({
        vidulum_app: {
          version: 1,
          encryptedMnemonic: 'encrypted',
          salt: 'salt',
          accounts: [
            {
              id: 'account-1',
              name: 'Test',
              address: 'bze1abc',
              pubKey: btoa(String.fromCharCode(1, 2, 3)),
              algo: 'secp256k1',
              hdPath: "m/44'/118'/0'/0/0",
              accountIndex: 0,
            },
          ],
        },
      });

      const result = await EncryptedStorage.loadWalletMetadata();

      expect(result).not.toBeNull();
      expect(result?.accounts).toHaveLength(1);
      expect(result?.accounts[0].id).toBe('account-1');
    });

    it('should return null when no wallet exists', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({});

      const result = await EncryptedStorage.loadWalletMetadata();
      expect(result).toBeNull();
    });
  });

  describe('updateAccounts', () => {
    it('should update accounts in stored wallet', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({
        vidulum_app: {
          version: 1,
          encryptedMnemonic: 'encrypted',
          salt: 'salt',
          accounts: [],
        },
      });

      const updatedAccounts = [testAccount, { ...testAccount, id: 'account-2', name: 'Account 2' }];
      await EncryptedStorage.updateAccounts(updatedAccounts);

      expect(mockBrowser.storage.local.set).toHaveBeenCalled();
      const savedData = mockBrowser.storage.local.set.mock.calls[0][0];
      expect(savedData.vidulum_app.accounts).toHaveLength(2);
    });

    it('should throw when no wallet exists', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({});

      await expect(EncryptedStorage.updateAccounts([testAccount])).rejects.toThrow('No wallet found');
    });
  });

  describe('deleteWallet', () => {
    it('should remove wallet and clear session', async () => {
      await EncryptedStorage.deleteWallet();

      expect(mockBrowser.storage.local.remove).toHaveBeenCalledWith('vidulum_app');
      expect(mockBrowser.storage.session.remove).toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    describe('setSession', () => {
      it('should set session ID', async () => {
        await EncryptedStorage.setSession('session-123');

        expect(mockBrowser.storage.session.set).toHaveBeenCalledWith(
          expect.objectContaining({
            vidulum_session: 'session-123',
          })
        );
      });

      it('should set session with serialized wallet', async () => {
        await EncryptedStorage.setSession('session-123', 'serialized-wallet-data');

        expect(mockBrowser.storage.session.set).toHaveBeenCalledWith(
          expect.objectContaining({
            vidulum_session: 'session-123',
            serializedWallet: 'serialized-wallet-data',
          })
        );
      });
    });

    describe('getSession', () => {
      it('should return session ID', async () => {
        mockBrowser.storage.session.get.mockResolvedValueOnce({
          vidulum_session: 'session-123',
        });

        const result = await EncryptedStorage.getSession();
        expect(result).toBe('session-123');
      });

      it('should return null when no session exists', async () => {
        mockBrowser.storage.session.get.mockResolvedValueOnce({});

        const result = await EncryptedStorage.getSession();
        expect(result).toBeNull();
      });
    });

    describe('clearSession', () => {
      it('should clear all session data', async () => {
        await EncryptedStorage.clearSession();

        expect(mockBrowser.storage.session.remove).toHaveBeenCalledWith([
          'vidulum_session',
          'serializedWallet',
          'lastActivity',
        ]);
      });
    });
  });

  describe('Preferences', () => {
    describe('savePreferences', () => {
      it('should save preferences with version', async () => {
        mockBrowser.storage.local.get.mockResolvedValueOnce({});

        await EncryptedStorage.savePreferences({
          selectedAccountId: 'account-1',
          selectedChainId: 'beezee-1',
          autoLockMinutes: 15,
        });

        expect(mockBrowser.storage.local.set).toHaveBeenCalled();
        const savedData = mockBrowser.storage.local.set.mock.calls[0][0];
        expect(savedData.vidulum_preferences.version).toBe(EncryptedStorage.PREFERENCES_VERSION);
        expect(savedData.vidulum_preferences.selectedAccountId).toBe('account-1');
      });

      it('should merge with existing preferences', async () => {
        mockBrowser.storage.local.get.mockResolvedValueOnce({
          vidulum_preferences: {
            version: 1,
            selectedAccountId: 'old-account',
            autoLockMinutes: 30,
          },
        });

        await EncryptedStorage.savePreferences({
          selectedAccountId: 'new-account',
        });

        const savedData = mockBrowser.storage.local.set.mock.calls[0][0];
        expect(savedData.vidulum_preferences.selectedAccountId).toBe('new-account');
        expect(savedData.vidulum_preferences.autoLockMinutes).toBe(30);
      });
    });

    describe('getPreferences', () => {
      it('should return stored preferences', async () => {
        mockBrowser.storage.local.get.mockResolvedValueOnce({
          vidulum_preferences: {
            version: 1,
            selectedAccountId: 'account-1',
            selectedChainId: 'beezee-1',
            autoLockMinutes: 15,
          },
        });

        const result = await EncryptedStorage.getPreferences();

        expect(result.selectedAccountId).toBe('account-1');
        expect(result.selectedChainId).toBe('beezee-1');
        expect(result.autoLockMinutes).toBe(15);
      });

      it('should return empty object when no preferences exist', async () => {
        mockBrowser.storage.local.get.mockResolvedValueOnce({});

        const result = await EncryptedStorage.getPreferences();
        expect(result).toEqual({});
      });
    });
  });

  describe('Auto-lock', () => {
    describe('setLastActivity', () => {
      it('should set last activity timestamp', async () => {
        await EncryptedStorage.setLastActivity();

        expect(mockBrowser.storage.session.set).toHaveBeenCalledWith(
          expect.objectContaining({
            lastActivity: expect.any(Number),
          })
        );
      });
    });

    describe('getLastActivity', () => {
      it('should return last activity timestamp', async () => {
        const timestamp = Date.now();
        mockBrowser.storage.session.get.mockResolvedValueOnce({
          lastActivity: timestamp,
        });

        const result = await EncryptedStorage.getLastActivity();
        expect(result).toBe(timestamp);
      });

      it('should return null when no activity recorded', async () => {
        mockBrowser.storage.session.get.mockResolvedValueOnce({});

        const result = await EncryptedStorage.getLastActivity();
        expect(result).toBeNull();
      });
    });

    describe('shouldAutoLock', () => {
      it('should return true when timeout exceeded', async () => {
        const oldTimestamp = Date.now() - 20 * 60 * 1000; // 20 minutes ago
        
        mockBrowser.storage.local.get.mockResolvedValueOnce({
          vidulum_preferences: { version: 1, autoLockMinutes: 15 },
        });
        mockBrowser.storage.session.get.mockResolvedValueOnce({
          lastActivity: oldTimestamp,
        });

        const result = await EncryptedStorage.shouldAutoLock();
        expect(result).toBe(true);
      });

      it('should return false when within timeout', async () => {
        const recentTimestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
        
        mockBrowser.storage.local.get.mockResolvedValueOnce({
          vidulum_preferences: { version: 1, autoLockMinutes: 15 },
        });
        mockBrowser.storage.session.get.mockResolvedValueOnce({
          lastActivity: recentTimestamp,
        });

        const result = await EncryptedStorage.shouldAutoLock();
        expect(result).toBe(false);
      });

      it('should return false when auto-lock is disabled', async () => {
        mockBrowser.storage.local.get.mockResolvedValueOnce({
          vidulum_preferences: { version: 1, autoLockMinutes: 0 },
        });

        const result = await EncryptedStorage.shouldAutoLock();
        expect(result).toBe(false);
      });

      it('should return false when no last activity', async () => {
        mockBrowser.storage.local.get.mockResolvedValueOnce({
          vidulum_preferences: { version: 1, autoLockMinutes: 15 },
        });
        mockBrowser.storage.session.get.mockResolvedValueOnce({});

        const result = await EncryptedStorage.shouldAutoLock();
        expect(result).toBe(false);
      });
    });
  });

  describe('Imported Accounts', () => {
    describe('addImportedAccount', () => {
      it('should add imported account with encrypted mnemonic', async () => {
        mockBrowser.storage.local.get.mockResolvedValueOnce({
          vidulum_app: {
            version: 1,
            encryptedMnemonic: 'encrypted',
            salt: 'salt',
            accounts: [],
          },
        });

        const importedAccount: KeyringAccount = {
          ...testAccount,
          id: 'imported-123',
          name: 'Imported Account',
        };

        await EncryptedStorage.addImportedAccount(testMnemonic, testPassword, importedAccount);

        expect(mockBrowser.storage.local.set).toHaveBeenCalled();
        const savedData = mockBrowser.storage.local.set.mock.calls[0][0];
        expect(savedData.vidulum_app.importedAccounts).toHaveLength(1);
        expect(savedData.vidulum_app.importedAccounts[0].account.id).toBe('imported-123');
        expect(savedData.vidulum_app.importedAccounts[0].encryptedMnemonic).toBeDefined();
        expect(savedData.vidulum_app.importedAccounts[0].salt).toBeDefined();
      });
    });

    describe('getImportedAccounts', () => {
      it('should return imported accounts', async () => {
        mockBrowser.storage.local.get.mockResolvedValueOnce({
          vidulum_app: {
            version: 1,
            encryptedMnemonic: 'encrypted',
            salt: 'salt',
            accounts: [],
            importedAccounts: [
              {
                account: {
                  id: 'imported-1',
                  name: 'Imported 1',
                  address: 'bze1imported',
                  pubKey: btoa(String.fromCharCode(1, 2, 3)),
                  algo: 'secp256k1',
                  hdPath: "m/44'/118'/0'/0/0",
                  accountIndex: 0,
                },
                encryptedMnemonic: 'encrypted',
                salt: 'salt',
              },
            ],
          },
        });

        const result = await EncryptedStorage.getImportedAccounts();

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('imported-1');
      });

      it('should return empty array when no imported accounts', async () => {
        mockBrowser.storage.local.get.mockResolvedValueOnce({
          vidulum_app: {
            version: 1,
            encryptedMnemonic: 'encrypted',
            salt: 'salt',
            accounts: [],
          },
        });

        const result = await EncryptedStorage.getImportedAccounts();
        expect(result).toEqual([]);
      });
    });
  });

  describe('Migration', () => {
    it('should handle data with version field', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({
        vidulum_app: {
          version: 1,
          encryptedMnemonic: 'encrypted',
          salt: 'salt',
          accounts: [
            {
              id: 'account-1',
              name: 'Test',
              address: 'bze1abc',
              pubKey: btoa(String.fromCharCode(1, 2, 3)),
              algo: 'secp256k1',
              hdPath: "m/44'/118'/0'/0/0",
              accountIndex: 0,
            },
          ],
        },
      });

      // loadWalletMetadata doesn't require decryption
      const result = await EncryptedStorage.loadWalletMetadata();

      expect(result).not.toBeNull();
      expect(result?.accounts).toHaveLength(1);
    });

    it('should handle legacy data without version field', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({
        vidulum_app: {
          // No version field - legacy data
          encryptedMnemonic: 'encrypted',
          salt: 'salt',
          accounts: [
            {
              id: 'account-1',
              name: 'Test',
              address: 'bze1abc',
              pubKey: btoa(String.fromCharCode(1, 2, 3)),
              algo: 'secp256k1',
              hdPath: "m/44'/118'/0'/0/0",
              accountIndex: 0,
            },
          ],
        },
      });

      // loadWalletMetadata should still work with legacy data
      const result = await EncryptedStorage.loadWalletMetadata();

      expect(result).not.toBeNull();
      expect(result?.accounts).toHaveLength(1);
    });
  });
});
