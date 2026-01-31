import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Input,
  Divider,
  Switch,
  useToast,
  Collapse,
} from '@chakra-ui/react';
import { ArrowBackIcon, ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import browser from 'webextension-polyfill';
import { useWalletStore } from '@/store/walletStore';
import { EncryptedStorage } from '@/lib/storage/encrypted-storage';
import { FEATURES } from '@/lib/config/features';

// Settings storage key (must match inject.ts)
const SETTINGS_KEY = 'vidulum_settings';

interface FeatureSettings {
  VIDULUM_INJECTION?: boolean;
  WALLET_CONNECT?: boolean;
  AUTO_OPEN_POPUP?: boolean;
  TX_TRANSLATION?: boolean;
}

interface DAppCompatibilitySettings {
  enableKeplrInjection: boolean;
  enableMetamaskInjection: boolean;
  enablePhantomInjection: boolean;
  enableCoinbaseInjection: boolean;
}

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { accounts, autoLockMinutes, setAutoLockMinutes, lock } = useWalletStore();
  const toast = useToast();

  // dApp compatibility settings
  const [enableKeplrInjection, setEnableKeplrInjection] = useState(false);
  const [enableMetamaskInjection, setEnableMetamaskInjection] = useState(false);
  const [enablePhantomInjection, setEnablePhantomInjection] = useState(false);
  const [enableCoinbaseInjection, setEnableCoinbaseInjection] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Feature flags state
  const [featureSettings, setFeatureSettings] = useState<FeatureSettings>({
    VIDULUM_INJECTION: FEATURES.VIDULUM_INJECTION,
    WALLET_CONNECT: FEATURES.WALLET_CONNECT,
    AUTO_OPEN_POPUP: FEATURES.AUTO_OPEN_POPUP,
    TX_TRANSLATION: FEATURES.TX_TRANSLATION,
  });
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const [replacementCompatExpanded, setReplacementCompatExpanded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await browser.storage.local.get(SETTINGS_KEY);
        const settings = result[SETTINGS_KEY] || {};
        setEnableKeplrInjection(settings.enableKeplrInjection ?? false);
        setEnableMetamaskInjection(settings.enableMetamaskInjection ?? false);
        setEnablePhantomInjection(settings.enablePhantomInjection ?? false);
        setEnableCoinbaseInjection(settings.enableCoinbaseInjection ?? false);

        // Load feature settings
        setFeatureSettings({
          VIDULUM_INJECTION: settings.features?.VIDULUM_INJECTION ?? FEATURES.VIDULUM_INJECTION,
          WALLET_CONNECT: settings.features?.WALLET_CONNECT ?? FEATURES.WALLET_CONNECT,
          AUTO_OPEN_POPUP: settings.features?.AUTO_OPEN_POPUP ?? FEATURES.AUTO_OPEN_POPUP,
          TX_TRANSLATION: settings.features?.TX_TRANSLATION ?? FEATURES.TX_TRANSLATION,
        });
      } catch (error) {
        // Storage access failed, use default
        console.error('Failed to load settings from storage', error);
      } finally {
        setLoadingSettings(false);
      }
    };
    loadSettings();
  }, []);

  // Handle Keplr injection toggle
  const handleKeplrInjectionToggle = async (enabled: boolean) => {
    setEnableKeplrInjection(enabled);
    try {
      const result = await browser.storage.local.get(SETTINGS_KEY);
      const settings = result[SETTINGS_KEY] || {};
      settings.enableKeplrInjection = enabled;
      await browser.storage.local.set({ [SETTINGS_KEY]: settings });
      toast({
        title: enabled ? 'Keplr mode enabled' : 'Keplr mode disabled',
        description: 'Refresh any open dApp pages to apply changes',
        status: 'info',
        duration: 4000,
      });
    } catch (error) {
      console.error('Failed to save Keplr injection setting:', error);
      toast({
        title: 'Failed to save setting',
        status: 'error',
        duration: 2000,
      });
      setEnableKeplrInjection(!enabled); // Revert
    }
  };

  // Handle Metamask injection toggle
  const handleMetamaskInjectionToggle = async (enabled: boolean) => {
    setEnableMetamaskInjection(enabled);
    try {
      const result = await browser.storage.local.get(SETTINGS_KEY);
      const settings = result[SETTINGS_KEY] || {};
      settings.enableMetamaskInjection = enabled;
      await browser.storage.local.set({ [SETTINGS_KEY]: settings });
      toast({
        title: enabled ? 'Metamask mode enabled' : 'Metamask mode disabled',
        description: 'Refresh any open dApp pages to apply changes',
        status: 'info',
        duration: 4000,
      });
    } catch (error) {
      console.error('Failed to save Metamask injection setting:', error);
      toast({
        title: 'Failed to save setting',
        status: 'error',
        duration: 2000,
      });
      setEnableMetamaskInjection(!enabled); // Revert
    }
  };

  // Handle Phantom injection toggle
  const handlePhantomInjectionToggle = async (enabled: boolean) => {
    setEnablePhantomInjection(enabled);
    try {
      const result = await browser.storage.local.get(SETTINGS_KEY);
      const settings = result[SETTINGS_KEY] || {};
      settings.enablePhantomInjection = enabled;
      await browser.storage.local.set({ [SETTINGS_KEY]: settings });
      toast({
        title: enabled ? 'Phantom mode enabled' : 'Phantom mode disabled',
        description: 'Refresh any open dApp pages to apply changes',
        status: 'info',
        duration: 4000,
      });
    } catch (error) {
      console.error('Failed to save Phantom injection setting:', error);
      toast({
        title: 'Failed to save setting',
        status: 'error',
        duration: 2000,
      });
      setEnablePhantomInjection(!enabled); // Revert
    }
  };

  // Handle Coinbase Wallet injection toggle
  const handleCoinbaseInjectionToggle = async (enabled: boolean) => {
    setEnableCoinbaseInjection(enabled);
    try {
      const result = await browser.storage.local.get(SETTINGS_KEY);
      const settings = result[SETTINGS_KEY] || {};
      settings.enableCoinbaseInjection = enabled;
      await browser.storage.local.set({ [SETTINGS_KEY]: settings });
      toast({
        title: enabled ? 'Coinbase Wallet mode enabled' : 'Coinbase Wallet mode disabled',
        description: 'Refresh any open dApp pages to apply changes',
        status: 'info',
        duration: 4000,
      });
    } catch (error) {
      console.error('Failed to save Coinbase injection setting:', error);
      toast({
        title: 'Failed to save setting',
        status: 'error',
        duration: 2000,
      });
      setEnableCoinbaseInjection(!enabled); // Revert
    }
  };

  // Handle feature toggle
  const handleFeatureToggle = async (featureKey: keyof FeatureSettings, enabled: boolean) => {
    setFeatureSettings((prev) => ({ ...prev, [featureKey]: enabled }));
    try {
      const result = await browser.storage.local.get(SETTINGS_KEY);
      const settings = result[SETTINGS_KEY] || {};
      settings.features = { ...(settings.features || {}), [featureKey]: enabled };
      await browser.storage.local.set({ [SETTINGS_KEY]: settings });
      toast({
        title: enabled ? 'Feature enabled' : 'Feature disabled',
        description: 'Changes may require page refresh',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to save feature setting:', error);
      toast({
        title: 'Failed to save setting',
        status: 'error',
        duration: 2000,
      });
      setFeatureSettings((prev) => ({ ...prev, [featureKey]: !enabled })); // Revert
    }
  };

  // Reveal keys state
  const [revealStep, setRevealStep] = useState<'hidden' | 'password' | 'revealed'>('hidden');
  const [revealPassword, setRevealPassword] = useState('');
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealedMnemonic, setRevealedMnemonic] = useState('');
  const [revealedImportedMnemonics, setRevealedImportedMnemonics] = useState<
    { address: string; name: string; mnemonic: string }[]
  >([]);

  const resetRevealState = () => {
    setRevealStep('hidden');
    setRevealPassword('');
    setRevealedMnemonic('');
    setRevealedImportedMnemonics([]);
  };

  const handleRevealKeys = async () => {
    if (!revealPassword) {
      toast({ title: 'Password required', status: 'error', duration: 2000 });
      return;
    }

    setRevealLoading(true);
    try {
      // Load main wallet mnemonic
      const wallet = await EncryptedStorage.loadWallet(revealPassword);
      if (!wallet) {
        throw new Error('Invalid password');
      }
      setRevealedMnemonic(wallet.mnemonic);

      // Load imported account mnemonics
      const importedAccounts = accounts.filter((acc) => acc.id.startsWith('imported-'));
      const importedMnemonics: { address: string; name: string; mnemonic: string }[] = [];

      for (const acc of importedAccounts) {
        const mnemonic = await EncryptedStorage.getImportedAccountMnemonic(
          acc.address,
          revealPassword
        );
        if (mnemonic) {
          importedMnemonics.push({
            address: acc.address,
            name: acc.name,
            mnemonic,
          });
        }
      }
      setRevealedImportedMnemonics(importedMnemonics);

      setRevealStep('revealed');
    } catch (error) {
      console.error('Failed to reveal keys:', error);
      toast({
        title: 'Failed to reveal',
        description: 'Invalid password',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setRevealLoading(false);
    }
  };

  const handleLock = () => {
    lock();
    resetRevealState();
  };

  return (
    <Box h="full" bg="#0a0a0a" display="flex" flexDirection="column" color="white">
      {/* Header */}
      <HStack px={4} py={3} borderBottom="1px" borderColor="#2a2a2a">
        <IconButton
          aria-label="Back"
          icon={<ArrowBackIcon />}
          variant="ghost"
          size="sm"
          color="gray.400"
          _hover={{ color: 'white' }}
          onClick={onBack}
        />
        <Text fontSize="lg" fontWeight="semibold" flex={1}>
          Settings
        </Text>
      </HStack>

      {/* Content */}
      <Box flex={1} overflowY="auto" px={4} py={4}>
        <VStack spacing={5} align="stretch">
          {/* Auto-lock Timer */}
          <Box>
            <Text fontSize="sm" color="gray.400" mb={3}>
              Auto-lock Timer
            </Text>
            <HStack spacing={2} flexWrap="wrap">
              {[0, 5, 15, 30, 60].map((minutes) => (
                <Button
                  key={minutes}
                  size="sm"
                  variant={autoLockMinutes === minutes ? 'solid' : 'outline'}
                  colorScheme={autoLockMinutes === minutes ? 'cyan' : 'gray'}
                  borderColor="#3a3a3a"
                  onClick={() => setAutoLockMinutes(minutes)}
                >
                  {minutes === 0 ? 'Never' : `${minutes}m`}
                </Button>
              ))}
            </HStack>
            <Text fontSize="xs" color="gray.500" mt={2}>
              {autoLockMinutes === 0
                ? 'Wallet will only lock when browser closes'
                : `Wallet will lock after ${autoLockMinutes} minutes of inactivity`}
            </Text>
          </Box>

          <Divider borderColor="#2a2a2a" />

          {/* Replacement Compatibility Section (Collapsible) */}
          <Box>
            <HStack
              justify="space-between"
              align="center"
              cursor="pointer"
              onClick={() => setReplacementCompatExpanded(!replacementCompatExpanded)}
              _hover={{ bg: 'rgba(255, 255, 255, 0.02)' }}
              p={2}
              borderRadius="md"
              transition="all 0.2s"
            >
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" color="gray.400">
                  Replacement Compatibility
                </Text>
                <Text fontSize="xs" color="gray.600">
                  Replace other wallet providers
                </Text>
              </VStack>
              <IconButton
                aria-label="Toggle replacement compatibility"
                icon={replacementCompatExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                variant="ghost"
                size="sm"
                color="gray.500"
              />
            </HStack>

            <Collapse in={replacementCompatExpanded} animateOpacity>
              <VStack spacing={3} align="stretch" mt={3} pl={2}>
                {/* Keplr Replacement */}
                <Box>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" spacing={0} flex={1}>
                      <Text fontSize="sm" color="white">
                        Keplr (Cosmos)
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Inject as window.keplr
                      </Text>
                    </VStack>
                    <Switch
                      colorScheme="cyan"
                      isChecked={enableKeplrInjection}
                      onChange={(e) => handleKeplrInjectionToggle(e.target.checked)}
                      isDisabled={loadingSettings}
                    />
                  </HStack>
                  {enableKeplrInjection && (
                    <Box
                      mt={2}
                      p={2}
                      bg="rgba(6, 182, 212, 0.1)"
                      borderRadius="lg"
                      border="1px"
                      borderColor="cyan.700"
                    >
                      <Text fontSize="xs" color="cyan.300">
                        ⚡ Active - Disable if Keplr is installed
                      </Text>
                    </Box>
                  )}
                </Box>

                <Divider borderColor="#1a1a1a" />

                {/* Metamask Replacement */}
                <Box>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" spacing={0} flex={1}>
                      <Text fontSize="sm" color="white">
                        Metamask (EVM)
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Inject as window.ethereum
                      </Text>
                    </VStack>
                    <Switch
                      colorScheme="cyan"
                      isChecked={enableMetamaskInjection}
                      onChange={(e) => handleMetamaskInjectionToggle(e.target.checked)}
                      isDisabled={loadingSettings}
                    />
                  </HStack>
                  {enableMetamaskInjection && (
                    <Box
                      mt={2}
                      p={2}
                      bg="rgba(6, 182, 212, 0.1)"
                      borderRadius="lg"
                      border="1px"
                      borderColor="cyan.700"
                    >
                      <Text fontSize="xs" color="cyan.300">
                        ⚡ Active - Disable if Metamask is installed
                      </Text>
                    </Box>
                  )}
                </Box>

                <Divider borderColor="#1a1a1a" />

                {/* Phantom Replacement */}
                <Box>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" spacing={0} flex={1}>
                      <Text fontSize="sm" color="white">
                        Phantom (Solana)
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Inject as window.solana
                      </Text>
                    </VStack>
                    <Switch
                      colorScheme="cyan"
                      isChecked={enablePhantomInjection}
                      onChange={(e) => handlePhantomInjectionToggle(e.target.checked)}
                      isDisabled={loadingSettings}
                    />
                  </HStack>
                  {enablePhantomInjection && (
                    <Box
                      mt={2}
                      p={2}
                      bg="rgba(6, 182, 212, 0.1)"
                      borderRadius="lg"
                      border="1px"
                      borderColor="cyan.700"
                    >
                      <Text fontSize="xs" color="cyan.300">
                        ⚡ Active - Disable if Phantom is installed
                      </Text>
                    </Box>
                  )}
                </Box>

                <Divider borderColor="#1a1a1a" />

                {/* Coinbase Wallet Replacement */}
                <Box>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" spacing={0} flex={1}>
                      <Text fontSize="sm" color="white">
                        Coinbase Wallet
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        Multi-chain wallet compatibility
                      </Text>
                    </VStack>
                    <Switch
                      colorScheme="cyan"
                      isChecked={enableCoinbaseInjection}
                      onChange={(e) => handleCoinbaseInjectionToggle(e.target.checked)}
                      isDisabled={loadingSettings}
                    />
                  </HStack>
                  {enableCoinbaseInjection && (
                    <Box
                      mt={2}
                      p={2}
                      bg="rgba(6, 182, 212, 0.1)"
                      borderRadius="lg"
                      border="1px"
                      borderColor="cyan.700"
                    >
                      <Text fontSize="xs" color="cyan.300">
                        ⚡ Active - Coinbase Wallet mode enabled
                      </Text>
                    </Box>
                  )}
                </Box>
              </VStack>
            </Collapse>
          </Box>

          <Divider borderColor="#2a2a2a" />

          {/* Features Section (Collapsible) */}
          <Box>
            <HStack
              justify="space-between"
              align="center"
              cursor="pointer"
              onClick={() => setFeaturesExpanded(!featuresExpanded)}
              _hover={{ bg: 'rgba(255, 255, 255, 0.02)' }}
              p={2}
              borderRadius="md"
              transition="all 0.2s"
            >
              <VStack align="start" spacing={0}>
                <Text fontSize="sm" color="gray.400">
                  Advanced Features
                </Text>
                <Text fontSize="xs" color="gray.600">
                  Toggle experimental features
                </Text>
              </VStack>
              <IconButton
                aria-label="Toggle features"
                icon={featuresExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                variant="ghost"
                size="sm"
                color="gray.500"
              />
            </HStack>

            <Collapse in={featuresExpanded} animateOpacity>
              <VStack spacing={3} align="stretch" mt={3} pl={2}>
                {/* Vidulum Injection */}
                <HStack justify="space-between" align="center">
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontSize="sm" color="white">
                      Vidulum Provider
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Inject window.vidulum for dApps
                    </Text>
                  </VStack>
                  <Switch
                    colorScheme="cyan"
                    isChecked={featureSettings.VIDULUM_INJECTION}
                    onChange={(e) => handleFeatureToggle('VIDULUM_INJECTION', e.target.checked)}
                    isDisabled={loadingSettings}
                  />
                </HStack>

                <Divider borderColor="#1a1a1a" />

                {/* WalletConnect */}
                <HStack justify="space-between" align="center">
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontSize="sm" color="white">
                      WalletConnect
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Mobile wallet & cross-device support
                    </Text>
                  </VStack>
                  <Switch
                    colorScheme="cyan"
                    isChecked={featureSettings.WALLET_CONNECT}
                    onChange={(e) => handleFeatureToggle('WALLET_CONNECT', e.target.checked)}
                    isDisabled={loadingSettings}
                  />
                </HStack>

                <Divider borderColor="#1a1a1a" />

                {/* Auto Open Popup */}
                <HStack justify="space-between" align="center">
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontSize="sm" color="white">
                      Auto-open Popup
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Open automatically on approval requests
                    </Text>
                  </VStack>
                  <Switch
                    colorScheme="cyan"
                    isChecked={featureSettings.AUTO_OPEN_POPUP}
                    onChange={(e) => handleFeatureToggle('AUTO_OPEN_POPUP', e.target.checked)}
                    isDisabled={loadingSettings}
                  />
                </HStack>

                <Divider borderColor="#1a1a1a" />

                {/* Transaction Translation */}
                <HStack justify="space-between" align="center">
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontSize="sm" color="white">
                      Transaction Summary
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Show human-readable transaction details
                    </Text>
                  </VStack>
                  <Switch
                    colorScheme="cyan"
                    isChecked={featureSettings.TX_TRANSLATION}
                    onChange={(e) => handleFeatureToggle('TX_TRANSLATION', e.target.checked)}
                    isDisabled={loadingSettings}
                  />
                </HStack>
              </VStack>
            </Collapse>
          </Box>

          <Divider borderColor="#2a2a2a" />

          {/* Reveal Recovery Phrase */}
          <Box>
            <Text fontSize="sm" color="gray.400" mb={3}>
              Recovery Phrase & Keys
            </Text>

            {revealStep === 'hidden' && (
              <Button
                w="full"
                variant="outline"
                borderColor="#F59E0B"
                color="#F59E0B"
                _hover={{ bg: 'rgba(245, 158, 11, 0.1)' }}
                borderRadius="xl"
                onClick={() => setRevealStep('password')}
              >
                Reveal Recovery Phrase
              </Button>
            )}

            {revealStep === 'password' && (
              <VStack spacing={3} align="stretch">
                <Box
                  p={3}
                  bg="rgba(245, 158, 11, 0.1)"
                  borderRadius="lg"
                  border="1px"
                  borderColor="#F59E0B"
                >
                  <Text fontSize="xs" color="#F59E0B">
                    ⚠️ Never share your recovery phrase. Anyone with it can access your funds.
                  </Text>
                </Box>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={revealPassword}
                  onChange={(e) => setRevealPassword(e.target.value)}
                  bg="#141414"
                  border="none"
                  borderRadius="xl"
                  _placeholder={{ color: 'gray.600' }}
                  _focus={{ ring: 2, ringColor: 'orange.400' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRevealKeys();
                  }}
                />
                <HStack spacing={2}>
                  <Button
                    flex={1}
                    colorScheme="orange"
                    borderRadius="xl"
                    isLoading={revealLoading}
                    onClick={handleRevealKeys}
                  >
                    Confirm
                  </Button>
                  <Button flex={1} variant="ghost" onClick={resetRevealState}>
                    Cancel
                  </Button>
                </HStack>
              </VStack>
            )}

            {revealStep === 'revealed' && (
              <VStack spacing={4} align="stretch">
                {/* Main Wallet Mnemonic */}
                <Box>
                  <Text fontSize="xs" color="gray.500" mb={2}>
                    Main Wallet ({accounts.filter((a) => !a.id.startsWith('imported-')).length}{' '}
                    accounts)
                  </Text>
                  <Box p={3} bg="#141414" borderRadius="lg" border="1px" borderColor="#2a2a2a">
                    <Text
                      fontSize="xs"
                      fontFamily="mono"
                      color="orange.300"
                      wordBreak="break-word"
                      userSelect="all"
                    >
                      {revealedMnemonic}
                    </Text>
                  </Box>
                  <HStack mt={2} spacing={1} flexWrap="wrap">
                    {accounts
                      .filter((a) => !a.id.startsWith('imported-'))
                      .map((acc) => (
                        <Text key={acc.id} fontSize="xs" color="gray.500">
                          {acc.name}
                          {acc !==
                            accounts.filter((a) => !a.id.startsWith('imported-')).slice(-1)[0] &&
                            ','}
                        </Text>
                      ))}
                  </HStack>
                </Box>

                {/* Imported Account Mnemonics */}
                {revealedImportedMnemonics.length > 0 && (
                  <>
                    <Divider borderColor="#2a2a2a" />
                    <Text fontSize="xs" color="gray.500">
                      Imported Accounts
                    </Text>
                    {revealedImportedMnemonics.map((imported) => (
                      <Box key={imported.address}>
                        <Text fontSize="xs" color="gray.400" mb={1}>
                          {imported.name}
                        </Text>
                        <Box
                          p={3}
                          bg="#141414"
                          borderRadius="lg"
                          border="1px"
                          borderColor="#2a2a2a"
                        >
                          <Text
                            fontSize="xs"
                            fontFamily="mono"
                            color="orange.300"
                            wordBreak="break-word"
                            userSelect="all"
                          >
                            {imported.mnemonic}
                          </Text>
                        </Box>
                      </Box>
                    ))}
                  </>
                )}

                <Button
                  w="full"
                  variant="outline"
                  borderColor="#3a3a3a"
                  borderRadius="xl"
                  onClick={resetRevealState}
                >
                  Hide
                </Button>
              </VStack>
            )}
          </Box>

          <Divider borderColor="#2a2a2a" />

          {/* Lock Now Button */}
          <Button
            w="full"
            variant="outline"
            borderColor="#EF4444"
            color="#EF4444"
            _hover={{ bg: 'rgba(239, 68, 68, 0.1)' }}
            borderRadius="xl"
            onClick={handleLock}
          >
            Lock Wallet Now
          </Button>

          {/* Version Info */}
          <Box pt={4} textAlign="center">
            <Text fontSize="xs" color="gray.600">
              State v{EncryptedStorage.WALLET_VERSION}
            </Text>
          </Box>
        </VStack>
      </Box>
    </Box>
  );
};

export default Settings;
