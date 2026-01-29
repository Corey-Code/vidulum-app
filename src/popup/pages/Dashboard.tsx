import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  useToast,
  useDisclosure,
  Input,
  Textarea,
  Divider,
  Spinner,
  Switch,
  Tabs,
  TabList,
  Tab,
} from '@chakra-ui/react';
import {
  CopyIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  AddIcon,
  CheckIcon,
  EditIcon,
  RepeatIcon,
} from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { useChainStore } from '@/store/chainStore';
import { UI_CHAINS, SUPPORTED_CHAINS, getNetworkType } from '@/lib/cosmos/chains';
import { Keyring } from '@/lib/crypto/keyring';
import { fetchChainAssets, RegistryAsset, getTokenColor } from '@/lib/assets/chainRegistry';
import { getExplorerAccountUrl } from '@/lib/networks';
import SendModal from '../components/SendModal';
import SwapModal from '../components/SwapModal';
import NetworkManagerModal from '../components/NetworkManagerModal';
import { useNetworkStore } from '@/store/networkStore';

interface DashboardProps {
  onNavigateToStaking?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToEarn?: () => void;
  onNavigateToDeposit?: () => void;
  onNavigateToWithdraw?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToStaking,
  onNavigateToSettings,
  onNavigateToEarn,
  onNavigateToDeposit,
  onNavigateToWithdraw,
}) => {
  const {
    selectedAccount,
    accounts,
    selectAccount,
    selectChain,
    selectedChainId,
    renameAccount,
    addAccount,
    importAccountFromMnemonic,
    getAddressForChain,
    getBitcoinAddress,
    getEvmAddress,
    updateActivity,
  } = useWalletStore();

  const { fetchBalance, getBalance, subscribeToBalanceUpdates, unsubscribeAll } = useChainStore();
  const [loading, setLoading] = useState(false);
  const [updatingTokens, setUpdatingTokens] = useState<Set<string>>(new Set());
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [chainAssets, setChainAssets] = useState<RegistryAsset[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [addAccountStep, setAddAccountStep] = useState<
    'none' | 'choose' | 'create' | 'import' | 'import-key' | 'import-mnemonic'
  >('none');
  const [newAccountName, setNewAccountName] = useState('');
  const [importMnemonic, setImportMnemonic] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [addingLoading, setAddingLoading] = useState(false);
  const [bitcoinAddress, setBitcoinAddress] = useState<string>('');
  const [loadingBtcAddress, setLoadingBtcAddress] = useState(false);
  // Cache of Bitcoin addresses for all accounts: accountIndex -> address
  const [bitcoinAddressCache, setBitcoinAddressCache] = useState<Map<number, string>>(new Map());
  // Cache of EVM addresses for all accounts: accountIndex -> address
  const [evmAddressCache, setEvmAddressCache] = useState<Map<number, string>>(new Map());
  // Network tab: 0 = All, 1 = Cosmos, 2 = UTXO, 3 = EVM
  const [networkTab, setNetworkTab] = useState(0);

  // Handle network tab change - auto-select first network of that type
  const handleNetworkTabChange = (tabIndex: number) => {
    setNetworkTab(tabIndex);

    // Auto-select first enabled network of the selected type
    if (tabIndex === 1) {
      // Cosmos tab - select first enabled Cosmos network
      const cosmosNetwork = enabledUIChains.find((n) => n.type === 'cosmos');
      if (cosmosNetwork) {
        selectChain(cosmosNetwork.id);
      }
    } else if (tabIndex === 2) {
      // UTXO tab - select first enabled Bitcoin network
      const bitcoinNetwork = enabledUIChains.find((n) => n.type === 'bitcoin');
      if (bitcoinNetwork) {
        selectChain(bitcoinNetwork.id);
      }
    } else if (tabIndex === 3) {
      // EVM tab - select first enabled EVM network
      const evmNetwork = enabledUIChains.find((n) => n.type === 'evm');
      if (evmNetwork) {
        selectChain(evmNetwork.id);
      }
    }
    // All tab (0) - keep current selection
  };

  const toast = useToast();
  const { isOpen: isSendOpen, onOpen: onSendOpen, onClose: onSendClose } = useDisclosure();
  const { isOpen: isSwapOpen, onOpen: onSwapOpen, onClose: onSwapClose } = useDisclosure();
  const {
    isOpen: isNetworkManagerOpen,
    onOpen: onNetworkManagerOpen,
    onClose: onNetworkManagerClose,
  } = useDisclosure();

  // Network store for preferences
  const { loadPreferences, isLoaded: networkPrefsLoaded, isNetworkEnabled } = useNetworkStore();

  // Get selected chain info
  const selectedChain = UI_CHAINS.find((c) => c.id === selectedChainId) || UI_CHAINS[0];
  const selectedChainConfig = SUPPORTED_CHAINS.get(selectedChainId);
  const selectedNetworkType = getNetworkType(selectedChainId);
  const isCosmosSelected = selectedNetworkType === 'cosmos';
  const isBitcoinSelected = selectedNetworkType === 'bitcoin';
  const isEvmSelected = selectedNetworkType === 'evm';

  // State for EVM address
  const [evmAddress, setEvmAddress] = useState<string>('');
  const [loadingEvmAddress, setLoadingEvmAddress] = useState(false);

  // Derive Bitcoin address when Bitcoin network is selected
  useEffect(() => {
    if (isBitcoinSelected && selectedAccount) {
      setLoadingBtcAddress(true);
      getBitcoinAddress(selectedChainId)
        .then((addr) => {
          setBitcoinAddress(addr || '');
        })
        .catch((err) => {
          console.error('Failed to get Bitcoin address:', err);
          setBitcoinAddress('');
        })
        .finally(() => {
          setLoadingBtcAddress(false);
        });
    }
  }, [isBitcoinSelected, selectedChainId, selectedAccount, getBitcoinAddress]);

  // Derive EVM address when EVM network is selected
  useEffect(() => {
    if (isEvmSelected && selectedAccount) {
      setLoadingEvmAddress(true);
      getEvmAddress(selectedChainId)
        .then((addr) => {
          setEvmAddress(addr || '');
        })
        .catch((err) => {
          console.error('Failed to get EVM address:', err);
          setEvmAddress('');
        })
        .finally(() => {
          setLoadingEvmAddress(false);
        });
    }
  }, [isEvmSelected, selectedChainId, selectedAccount, getEvmAddress]);

  // Derive Bitcoin addresses for all accounts when Bitcoin network is selected
  useEffect(() => {
    if (isBitcoinSelected && accounts.length > 0) {
      const deriveAllBitcoinAddresses = async () => {
        const newCache = new Map<number, string>();
        for (const account of accounts) {
          try {
            const addr = await getBitcoinAddress(selectedChainId, account.accountIndex);
            if (addr) {
              newCache.set(account.accountIndex, addr);
            }
          } catch (err) {
            console.error(
              `Failed to derive Bitcoin address for account ${account.accountIndex}:`,
              err
            );
          }
        }
        setBitcoinAddressCache(newCache);
      };
      deriveAllBitcoinAddresses();
    } else {
      setBitcoinAddressCache(new Map());
    }
  }, [isBitcoinSelected, selectedChainId, accounts, getBitcoinAddress]);

  // Derive EVM addresses for all accounts when EVM network is selected
  useEffect(() => {
    if (isEvmSelected && accounts.length > 0) {
      const deriveAllEvmAddresses = async () => {
        const newCache = new Map<number, string>();
        for (const account of accounts) {
          try {
            const addr = await getEvmAddress(selectedChainId, account.accountIndex);
            if (addr) {
              newCache.set(account.accountIndex, addr);
            }
          } catch (err) {
            console.error(`Failed to derive EVM address for account ${account.accountIndex}:`, err);
          }
        }
        setEvmAddressCache(newCache);
      };
      deriveAllEvmAddresses();
    } else {
      setEvmAddressCache(new Map());
    }
  }, [isEvmSelected, selectedChainId, accounts, getEvmAddress]);

  // Token config with colors and mock prices
  // Load chain assets from registry when chain changes
  useEffect(() => {
    const loadAssets = async () => {
      const assets = await fetchChainAssets(selectedChainId);
      setChainAssets(assets);
    };
    loadAssets();
  }, [selectedChainId]);

  // Get token config from chain registry or fallback
  const getTokenConfig = (denom: string) => {
    const asset = chainAssets.find((a) => a.denom === denom);
    if (asset) {
      return {
        symbol: asset.symbol,
        name: asset.name,
        decimals: asset.decimals,
        color: getTokenColor(asset.symbol),
        logoUrl: asset.logoUrl,
        priceUsd: 0, // Price data not available from registry
      };
    }
    // Fallback for unknown tokens
    return {
      symbol: denom.startsWith('ibc/') ? 'IBC' : denom.slice(0, 6).toUpperCase(),
      name: denom.startsWith('ibc/') ? 'IBC Token' : denom,
      decimals: 6,
      color: '#718096',
      logoUrl: undefined,
      priceUsd: 0,
    };
  };

  // Get the address for the selected chain
  const getChainAddress = () => {
    if (!selectedAccount) return '';

    // For Cosmos chains, convert address prefix
    if (isCosmosSelected && selectedChain.prefix) {
      return getAddressForChain(selectedChain.prefix) || '';
    }

    // For Bitcoin, use the derived Bitcoin address
    if (isBitcoinSelected) {
      if (loadingBtcAddress) return 'Loading...';
      return bitcoinAddress || 'Deriving address...';
    }

    // For EVM, use the derived EVM address
    if (isEvmSelected) {
      if (loadingEvmAddress) return 'Loading...';
      return evmAddress || 'Deriving address...';
    }

    return selectedAccount.address;
  };

  // Convert any account's address to the selected chain's format
  const getAccountChainAddress = (account: { address: string; accountIndex?: number }) => {
    const accountIndex = account.accountIndex ?? 0;

    // For Bitcoin, use cached derived address
    if (isBitcoinSelected) {
      const cachedAddr = bitcoinAddressCache.get(accountIndex);
      return cachedAddr || 'Deriving...';
    }

    // For EVM, use cached derived address
    if (isEvmSelected) {
      const cachedAddr = evmAddressCache.get(accountIndex);
      return cachedAddr || 'Deriving...';
    }

    // For Cosmos chains, convert address prefix
    if (isCosmosSelected && selectedChain.prefix) {
      try {
        return Keyring.convertAddress(account.address, selectedChain.prefix);
      } catch {
        return account.address;
      }
    }

    return account.address;
  };

  const resetAddAccountFlow = () => {
    setAddAccountStep('none');
    setNewAccountName('');
    setImportMnemonic('');
    setImportPassword('');
  };

  // Update activity on mount and interactions
  useEffect(() => {
    updateActivity();
  }, []);

  // Load network preferences on mount
  useEffect(() => {
    if (!networkPrefsLoaded) {
      loadPreferences();
    }
  }, [networkPrefsLoaded, loadPreferences]);

  // Filter UI_CHAINS based on network preferences
  const enabledUIChains = UI_CHAINS.filter((chain) => isNetworkEnabled(chain.id));

  // Track activity on any click
  useEffect(() => {
    const handleActivity = () => updateActivity();
    window.addEventListener('click', handleActivity);
    return () => window.removeEventListener('click', handleActivity);
  }, [updateActivity]);

  useEffect(() => {
    if (selectedAccount) {
      loadBalance();

      // Subscribe to real-time balance updates via WebSocket (Cosmos only)
      if (isCosmosSelected) {
        const chainAddress = getChainAddress();
        if (chainAddress) {
          subscribeToBalanceUpdates(selectedChainId, chainAddress);
        }
      }
    }

    // Cleanup subscriptions when account/chain changes or component unmounts
    return () => {
      unsubscribeAll();
    };
  }, [selectedAccount, selectedChainId, isCosmosSelected, bitcoinAddress, evmAddress]);

  const loadBalance = async () => {
    if (!selectedAccount) return;

    const chainAddress = getChainAddress();
    if (!chainAddress || chainAddress === 'Loading...' || chainAddress === 'Deriving address...') {
      return;
    }

    setLoading(true);
    try {
      await fetchBalance(selectedChainId, chainAddress);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handler for swap completion - marks tokens as updating and refreshes balance
  const handleSwapSuccess = async (fromDenom: string, toDenom: string) => {
    const chainAddress = getChainAddress();
    if (!chainAddress) return;

    // Mark both tokens as updating
    setUpdatingTokens(new Set([fromDenom, toDenom]));

    // Poll for balance updates (swaps may take a few blocks to settle)
    const maxAttempts = 10;
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      try {
        await fetchBalance(selectedChainId, chainAddress);
      } catch (error) {
        console.error('Failed to refresh balance:', error);
      }
    }

    // Clear updating state after polling completes
    setUpdatingTokens(new Set());
  };

  const handleCopyAddress = () => {
    const address = getChainAddress();
    if (address) {
      navigator.clipboard.writeText(address);
      toast({
        title: 'Address copied',
        status: 'success',
        duration: 2000,
      });
    }
  };

  const chainAddress = getChainAddress();
  const balance = chainAddress ? getBalance(selectedChainId, chainAddress) : undefined;

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 12)}…${addr.slice(-12)}`;
  };

  const getExplorerUrl = () => {
    const url = getExplorerAccountUrl(selectedChainId, chainAddress);
    return url || '#';
  };

  return (
    <Box
      h="full"
      bg="#0a0a0a"
      display="flex"
      flexDirection="column"
      color="white"
      position="relative"
    >
      {/* Scrollable Content */}
      <Box flex={1} overflowY="auto" px={5} py={5} pb={14}>
        <VStack spacing={5} align="stretch">
          {/* Deposit / Withdraw Buttons */}
          <HStack spacing={3}>
            <Button
              flex={1}
              size="md"
              variant="outline"
              color="teal.300"
              borderColor="teal.500"
              borderWidth="1.5px"
              _hover={{ bg: 'teal.900', borderColor: 'teal.400' }}
              onClick={onNavigateToDeposit}
            >
              Deposit
            </Button>
            <Button
              flex={1}
              size="md"
              variant="outline"
              color="orange.300"
              borderColor="orange.500"
              borderWidth="1.5px"
              _hover={{ bg: 'orange.900', borderColor: 'orange.400' }}
              onClick={onNavigateToWithdraw}
            >
              Withdraw
            </Button>
          </HStack>

          {/* Account Card */}
          <Box bg="#141414" borderRadius="xl" p={4}>
            <Menu
              isOpen={isAccountMenuOpen}
              onOpen={() => setIsAccountMenuOpen(true)}
              onClose={() => {
                setIsAccountMenuOpen(false);
                setEditingAccountId(null);
                resetAddAccountFlow();
              }}
              closeOnSelect={false}
            >
              <MenuButton as={Box} cursor="pointer" w="full">
                <VStack align="start" spacing={1}>
                  <HStack w="full" justify="space-between">
                    <Text color="gray.500" fontSize="sm">
                      {selectedAccount?.name || 'Select Account'}
                    </Text>
                    <ChevronDownIcon color="gray.500" />
                  </HStack>
                  <HStack spacing={3}>
                    <Text fontFamily="mono" fontSize="md">
                      {formatAddress(chainAddress)}
                    </Text>
                    <IconButton
                      aria-label="Copy address"
                      icon={<CopyIcon />}
                      size="xs"
                      variant="ghost"
                      color="gray.500"
                      _hover={{ color: 'white' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCopyAddress();
                      }}
                    />
                  </HStack>
                </VStack>
              </MenuButton>

              <MenuList bg="#1a1a1a" borderColor="#2a2a2a" minW="280px">
                {/* Add Account */}
                {addAccountStep === 'none' && (
                  <MenuItem
                    icon={<AddIcon />}
                    bg="transparent"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    color="cyan.400"
                    onClick={() => setAddAccountStep('choose')}
                  >
                    Add Account
                  </MenuItem>
                )}

                {addAccountStep === 'choose' && (
                  <Box px={3} py={2}>
                    <VStack spacing={2} align="stretch">
                      <Text fontSize="sm" fontWeight="medium" color="gray.400">
                        Add Account
                      </Text>
                      <Button
                        size="sm"
                        variant="outline"
                        borderColor="#3a3a3a"
                        _hover={{ bg: 'whiteAlpha.100' }}
                        onClick={() => {
                          setAddAccountStep('create');
                          setNewAccountName(`Account ${accounts.length + 1}`);
                        }}
                      >
                        Create new account
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        borderColor="#3a3a3a"
                        _hover={{ bg: 'whiteAlpha.100' }}
                        onClick={() => setAddAccountStep('import')}
                      >
                        Import account
                      </Button>
                      <Button size="xs" variant="ghost" onClick={resetAddAccountFlow}>
                        Cancel
                      </Button>
                    </VStack>
                  </Box>
                )}

                {addAccountStep === 'create' && (
                  <Box px={3} py={2}>
                    <VStack spacing={2} align="stretch">
                      <Text fontSize="sm" fontWeight="medium" color="gray.400">
                        Create Account
                      </Text>
                      <Input
                        size="sm"
                        bg="#0a0a0a"
                        borderColor="#3a3a3a"
                        placeholder="Account name"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        autoFocus
                      />
                      <HStack>
                        <Button
                          size="sm"
                          colorScheme="cyan"
                          flex={1}
                          isLoading={addingLoading}
                          onClick={async () => {
                            setAddingLoading(true);
                            try {
                              await addAccount(newAccountName || `Account ${accounts.length + 1}`);
                              toast({
                                title: 'Account created',
                                status: 'success',
                                duration: 2000,
                              });
                              setIsAccountMenuOpen(false);
                              resetAddAccountFlow();
                            } catch (error) {
                              toast({
                                title: 'Failed',
                                description:
                                  error instanceof Error ? error.message : 'Unknown error',
                                status: 'error',
                                duration: 3000,
                              });
                            } finally {
                              setAddingLoading(false);
                            }
                          }}
                        >
                          Create
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAddAccountStep('choose')}
                        >
                          Back
                        </Button>
                      </HStack>
                    </VStack>
                  </Box>
                )}

                {addAccountStep === 'import' && (
                  <Box px={3} py={2}>
                    <VStack spacing={2} align="stretch">
                      <Text fontSize="sm" fontWeight="medium" color="gray.400">
                        Import Account
                      </Text>
                      <Button
                        size="sm"
                        variant="outline"
                        borderColor="#3a3a3a"
                        _hover={{ bg: 'whiteAlpha.100' }}
                        onClick={() => setAddAccountStep('import-key')}
                      >
                        Private key
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        borderColor="#3a3a3a"
                        _hover={{ bg: 'whiteAlpha.100' }}
                        onClick={() => setAddAccountStep('import-mnemonic')}
                      >
                        Recovery phrase
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setAddAccountStep('choose')}>
                        Back
                      </Button>
                    </VStack>
                  </Box>
                )}

                {addAccountStep === 'import-key' && (
                  <Box px={3} py={2}>
                    <VStack spacing={2} align="stretch">
                      <Text fontSize="sm" color="gray.500">
                        Coming soon
                      </Text>
                      <Button size="xs" variant="ghost" onClick={() => setAddAccountStep('import')}>
                        Back
                      </Button>
                    </VStack>
                  </Box>
                )}

                {addAccountStep === 'import-mnemonic' && (
                  <Box px={3} py={2}>
                    <VStack spacing={2} align="stretch">
                      <Text fontSize="sm" fontWeight="medium" color="gray.400">
                        Import from phrase
                      </Text>
                      <Input
                        size="sm"
                        bg="#0a0a0a"
                        borderColor="#3a3a3a"
                        placeholder="Account name"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                      />
                      <Textarea
                        size="sm"
                        bg="#0a0a0a"
                        borderColor="#3a3a3a"
                        placeholder="Recovery phrase"
                        value={importMnemonic}
                        onChange={(e) => setImportMnemonic(e.target.value)}
                        rows={3}
                        fontFamily="mono"
                        fontSize="xs"
                      />
                      <Input
                        size="sm"
                        bg="#0a0a0a"
                        borderColor="#3a3a3a"
                        type="password"
                        placeholder="Wallet password"
                        value={importPassword}
                        onChange={(e) => setImportPassword(e.target.value)}
                      />
                      <HStack>
                        <Button
                          size="sm"
                          colorScheme="cyan"
                          flex={1}
                          isLoading={addingLoading}
                          isDisabled={!importMnemonic || !importPassword}
                          onClick={async () => {
                            setAddingLoading(true);
                            try {
                              await importAccountFromMnemonic(
                                importMnemonic.trim(),
                                newAccountName || `Imported ${accounts.length + 1}`,
                                importPassword
                              );
                              toast({
                                title: 'Account imported',
                                status: 'success',
                                duration: 2000,
                              });
                              setIsAccountMenuOpen(false);
                              resetAddAccountFlow();
                            } catch (error) {
                              toast({
                                title: 'Failed',
                                description:
                                  error instanceof Error ? error.message : 'Unknown error',
                                status: 'error',
                                duration: 3000,
                              });
                            } finally {
                              setAddingLoading(false);
                            }
                          }}
                        >
                          Import
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAddAccountStep('import')}
                        >
                          Back
                        </Button>
                      </HStack>
                    </VStack>
                  </Box>
                )}

                <MenuDivider borderColor="#2a2a2a" />

                {/* Account List */}
                {accounts.map((account, index) => {
                  const isEditing = editingAccountId === account.id;
                  // Check if this exact account is selected by ID
                  const isSelected = selectedAccount !== null && selectedAccount.id === account.id;
                  const accountAddr = getAccountChainAddress(account);

                  return (
                    <MenuItem
                      key={`${account.id}-${index}`}
                      bg={isSelected ? 'whiteAlpha.50' : 'transparent'}
                      _hover={{ bg: 'whiteAlpha.100' }}
                      _focus={{ bg: 'whiteAlpha.100' }}
                      onClick={() => {
                        if (!isEditing) {
                          selectAccount(account.id);
                          setIsAccountMenuOpen(false);
                        }
                      }}
                      closeOnSelect={false}
                    >
                      <HStack spacing={3} w="full">
                        <Box w={4} flexShrink={0}>
                          {isSelected && <CheckIcon color="cyan.400" boxSize={3} />}
                        </Box>
                        <VStack align="start" spacing={0} flex={1}>
                          {isEditing ? (
                            <HStack spacing={2}>
                              <Input
                                size="sm"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    renameAccount(account.address, editingName);
                                    setEditingAccountId(null);
                                    toast({ title: 'Renamed', status: 'success', duration: 2000 });
                                  } else if (e.key === 'Escape') {
                                    setEditingAccountId(null);
                                  }
                                }}
                                autoFocus
                                bg="#0a0a0a"
                                borderColor="#3a3a3a"
                              />
                              <Box
                                p={1}
                                cursor="pointer"
                                color="cyan.400"
                                _hover={{ color: 'white' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  renameAccount(account.address, editingName);
                                  setEditingAccountId(null);
                                  toast({ title: 'Renamed', status: 'success', duration: 2000 });
                                }}
                              >
                                <CheckIcon boxSize={3} />
                              </Box>
                            </HStack>
                          ) : (
                            <HStack spacing={2}>
                              <Text fontWeight="medium" fontSize="sm">
                                {account.name}
                              </Text>
                              <Box
                                p={1}
                                cursor="pointer"
                                color="gray.500"
                                _hover={{ color: 'white' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAccountId(account.id);
                                  setEditingName(account.name);
                                }}
                              >
                                <EditIcon boxSize={3} />
                              </Box>
                            </HStack>
                          )}
                          <Text fontSize="xs" color="gray.500" fontFamily="mono">
                            {formatAddress(accountAddr)}
                          </Text>
                        </VStack>
                        {/* Copy address button */}
                        <Box
                          p={1}
                          borderRadius="md"
                          cursor="pointer"
                          color="gray.500"
                          _hover={{ color: 'white' }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigator.clipboard.writeText(accountAddr);
                            toast({ title: 'Address copied', status: 'success', duration: 2000 });
                          }}
                        >
                          <CopyIcon boxSize={3} />
                        </Box>
                      </HStack>
                    </MenuItem>
                  );
                })}
              </MenuList>
            </Menu>
          </Box>

          <Divider borderColor="#2a2a2a" />

          {/* Network Selector */}
          <Box>
            <HStack justify="space-between" align="center" mb={3}>
              <HStack spacing={2}>
                <IconButton
                  aria-label="Manage networks"
                  icon={<AddIcon />}
                  size="xs"
                  variant="ghost"
                  color="gray.500"
                  _hover={{ color: 'cyan.400', bg: 'whiteAlpha.100' }}
                  onClick={onNetworkManagerOpen}
                />
                <Text color="gray.400" fontWeight="medium">
                  Network
                </Text>
              </HStack>
              <Tabs
                size="sm"
                variant="soft-rounded"
                index={networkTab}
                onChange={handleNetworkTabChange}
              >
                <TabList bg="#141414" borderRadius="full" p={0.5}>
                  <Tab
                    fontSize="xs"
                    px={2}
                    py={1}
                    borderRadius="full"
                    color="gray.500"
                    _selected={{ bg: '#2a2a2a', color: 'white' }}
                  >
                    All
                  </Tab>
                  <Tab
                    fontSize="xs"
                    px={2}
                    py={1}
                    borderRadius="full"
                    color="gray.500"
                    _selected={{ bg: 'purple.600', color: 'white' }}
                  >
                    Cosmos
                  </Tab>
                  <Tab
                    fontSize="xs"
                    px={2}
                    py={1}
                    borderRadius="full"
                    color="gray.500"
                    _selected={{ bg: 'orange.600', color: 'white' }}
                  >
                    UTXO
                  </Tab>
                  <Tab
                    fontSize="xs"
                    px={2}
                    py={1}
                    borderRadius="full"
                    color="gray.500"
                    _selected={{ bg: 'blue.600', color: 'white' }}
                  >
                    EVM
                  </Tab>
                </TabList>
              </Tabs>
            </HStack>
            <Box position="relative">
              {/* Fade gradient on right edge */}
              <Box
                position="absolute"
                right={0}
                top={0}
                bottom={0}
                w="40px"
                bg="linear-gradient(to right, transparent, #0a0a0a)"
                pointerEvents="none"
                zIndex={1}
              />
              <Box
                overflowX="auto"
                overflowY="hidden"
                maxH="88px"
                pb={4}
                pr={10}
                css={{
                  '&::-webkit-scrollbar': {
                    height: '4px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: '#1a1a1a',
                    borderRadius: '2px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: '#3a3a3a',
                    borderRadius: '2px',
                  },
                  '&::-webkit-scrollbar-thumb:hover': {
                    background: '#4a4a4a',
                  },
                }}
              >
                <Box
                  display="grid"
                  gridTemplateRows="repeat(2, 1fr)"
                  gridAutoFlow="column"
                  gridAutoColumns="max-content"
                  gap={2}
                  minW="max-content"
                >
                  {enabledUIChains
                    .filter((network) => {
                      // Filter based on selected tab
                      if (networkTab === 0) return true; // All: show all
                      if (networkTab === 1) return network.type === 'cosmos'; // Cosmos only
                      if (networkTab === 2) return network.type === 'bitcoin'; // UTXO only
                      if (networkTab === 3) return network.type === 'evm'; // EVM only
                      return true;
                    })
                    .map((network) => {
                      const isActive = selectedChainId === network.id;
                      const isBitcoin = network.type === 'bitcoin';
                      const isEvm = network.type === 'evm';
                      const borderActiveColor = isBitcoin
                        ? 'orange.500'
                        : isEvm
                          ? 'blue.500'
                          : 'cyan.500';
                      const borderHoverColor = isBitcoin
                        ? 'orange.400'
                        : isEvm
                          ? 'blue.400'
                          : 'cyan.400';
                      return (
                        <Button
                          key={network.id}
                          size="sm"
                          variant="outline"
                          bg={isActive ? '#141414' : 'transparent'}
                          color={isActive ? 'white' : 'gray.400'}
                          borderColor={isActive ? borderActiveColor : '#3a3a3a'}
                          borderWidth={isActive ? '2px' : '1px'}
                          borderRadius="xl"
                          opacity={isActive ? 1 : 0.8}
                          whiteSpace="nowrap"
                          _hover={{
                            opacity: 1,
                            borderColor: isActive ? borderHoverColor : '#4a4a4a',
                            color: 'white',
                          }}
                          onClick={() => selectChain(network.id)}
                        >
                          <Text>{network.name}</Text>
                        </Button>
                      );
                    })}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Quick Actions */}
          <Box>
            <Text color="gray.400" fontWeight="medium" mb={3}>
              Quick Actions
            </Text>
            <HStack spacing={2}>
              <Button
                size="sm"
                variant="outline"
                borderColor="#3a3a3a"
                borderRadius="xl"
                flex={1}
                onClick={onSendOpen}
              >
                Send
              </Button>
              {/* Swap only available on BeeZee */}
              {isCosmosSelected && (
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="#3a3a3a"
                  borderRadius="xl"
                  flex={1}
                  onClick={onSwapOpen}
                  isDisabled={selectedChainId !== 'beezee-1'}
                  opacity={selectedChainId !== 'beezee-1' ? 0.5 : 1}
                >
                  Swap
                </Button>
              )}
              <Menu>
                <MenuButton
                  as={Button}
                  size="sm"
                  variant="outline"
                  borderColor="#3a3a3a"
                  borderRadius="xl"
                  flex={1}
                  rightIcon={<ChevronDownIcon />}
                >
                  More
                </MenuButton>
                <MenuList bg="#1a1a1a" borderColor="#2a2a2a" minW="180px">
                  <MenuItem
                    bg="transparent"
                    _hover={{ bg: 'whiteAlpha.100' }}
                    as="a"
                    href={getExplorerUrl()}
                    target="_blank"
                    isDisabled={isBitcoinSelected} // Bitcoin explorer needs address
                  >
                    <HStack justify="space-between" w="full">
                      <Text>Explorer</Text>
                      <ExternalLinkIcon boxSize={3} color="gray.500" />
                    </HStack>
                  </MenuItem>

                  {/* Cosmos-specific menu items */}
                  {isCosmosSelected && (
                    <>
                      <MenuItem
                        bg="transparent"
                        _hover={{ bg: 'whiteAlpha.100' }}
                        as="a"
                        href={
                          selectedChainId === 'beezee-1'
                            ? 'https://explorer.getbze.com/beezee/gov'
                            : selectedChainId === 'atomone-1'
                              ? 'https://explorer.govgen.io/atomone/gov'
                              : selectedChainId === 'cosmoshub-4'
                                ? 'https://www.mintscan.io/cosmos/proposals'
                                : 'https://www.mintscan.io/osmosis/proposals'
                        }
                        target="_blank"
                      >
                        <HStack justify="space-between" w="full">
                          <Text>Governance</Text>
                          <ExternalLinkIcon boxSize={3} color="gray.500" />
                        </HStack>
                      </MenuItem>
                      <MenuItem
                        bg="transparent"
                        _hover={{ bg: 'whiteAlpha.100' }}
                        onClick={onNavigateToStaking}
                      >
                        Stake{' '}
                        {selectedChainId === 'beezee-1'
                          ? 'BZE'
                          : selectedChainId === 'atomone-1'
                            ? 'ATONE'
                            : selectedChainId === 'cosmoshub-4'
                              ? 'ATOM'
                              : 'OSMO'}
                      </MenuItem>
                      {selectedChainId === 'beezee-1' && (
                        <MenuItem
                          bg="transparent"
                          _hover={{ bg: 'whiteAlpha.100' }}
                          onClick={onNavigateToEarn}
                        >
                          Offers
                        </MenuItem>
                      )}
                    </>
                  )}

                  {/* Bitcoin-specific menu items */}
                  {isBitcoinSelected && (
                    <MenuItem bg="transparent" _hover={{ bg: 'whiteAlpha.100' }} isDisabled>
                      <Text color="gray.500">Coming soon...</Text>
                    </MenuItem>
                  )}

                  {/* EVM-specific menu items */}
                  {isEvmSelected && (
                    <MenuItem bg="transparent" _hover={{ bg: 'whiteAlpha.100' }} isDisabled>
                      <Text color="gray.500">More features coming soon...</Text>
                    </MenuItem>
                  )}
                </MenuList>
              </Menu>
            </HStack>
          </Box>

          {/* Balances Section */}
          <Box>
            <HStack justify="space-between" mb={3}>
              <HStack spacing={2}>
                <Text color="gray.400" fontWeight="medium">
                  Balances
                </Text>
                <IconButton
                  aria-label="Refresh balances"
                  icon={<RepeatIcon />}
                  size="xs"
                  variant="ghost"
                  color="gray.500"
                  _hover={{ color: 'cyan.400' }}
                  onClick={loadBalance}
                  isLoading={loading}
                />
              </HStack>
              <HStack spacing={2}>
                <Text color="gray.500" fontSize="xs">
                  Show zero
                </Text>
                <Switch
                  size="sm"
                  isChecked={showZeroBalances}
                  onChange={(e) => setShowZeroBalances(e.target.checked)}
                  colorScheme="cyan"
                />
              </HStack>
            </HStack>
            <VStack spacing={3} align="stretch">
              {loading ? (
                <Text color="gray.500" textAlign="center" py={4}>
                  Loading...
                </Text>
              ) : (
                (() => {
                  // Build a map of balances from chain
                  const balanceMap = new Map<string, string>();
                  if (balance) {
                    balance.forEach((b) => balanceMap.set(b.denom, b.amount));
                  }

                  // Create full asset list with balances from chain registry
                  const assetsWithBalances = chainAssets.map((asset) => ({
                    denom: asset.denom,
                    amount: balanceMap.get(asset.denom) || '0',
                  }));

                  // Also include any tokens from balance that aren't in registry
                  if (balance) {
                    balance.forEach((b) => {
                      if (!chainAssets.find((a) => a.denom === b.denom)) {
                        assetsWithBalances.push({ denom: b.denom, amount: b.amount });
                      }
                    });
                  }

                  // Sort assets: native first, VDL second (if beezee), then by balance
                  // Get native denom from chain assets (first asset is always native)
                  const nativeDenom =
                    chainAssets.length > 0
                      ? chainAssets[0].denom
                      : selectedChainId === 'beezee-1'
                        ? 'ubze'
                        : selectedChainId === 'atomone-1'
                          ? 'uatone'
                          : selectedChainId.startsWith('bitcoin')
                            ? 'sat'
                            : 'wei';
                  const vdlDenom = 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl';

                  const sortedAssets = [...assetsWithBalances].sort((a, b) => {
                    const aBalance = parseInt(a.amount);
                    const bBalance = parseInt(b.amount);
                    const aHasBalance = aBalance > 0;
                    const bHasBalance = bBalance > 0;

                    // Native asset with balance comes first
                    if (a.denom === nativeDenom && aHasBalance) return -1;
                    if (b.denom === nativeDenom && bHasBalance) return 1;

                    // VDL with balance comes second (only for beezee)
                    if (selectedChainId === 'beezee-1') {
                      if (a.denom === vdlDenom && aHasBalance) return -1;
                      if (b.denom === vdlDenom && bHasBalance) return 1;
                    }

                    // Assets with balance come before zero balance
                    if (aHasBalance && !bHasBalance) return -1;
                    if (!aHasBalance && bHasBalance) return 1;

                    // Sort by balance amount (descending) for assets with balance
                    if (aHasBalance && bHasBalance) {
                      return bBalance - aBalance;
                    }

                    return 0;
                  });

                  // Filter based on toggle - but always show native asset
                  const displayAssets = showZeroBalances
                    ? sortedAssets
                    : sortedAssets.filter((a) => parseInt(a.amount) > 0 || a.denom === nativeDenom);

                  if (displayAssets.length === 0) {
                    return (
                      <Text color="gray.500" textAlign="center" py={4}>
                        {showZeroBalances ? 'No tokens configured' : 'No tokens with balance'}
                      </Text>
                    );
                  }

                  return displayAssets.map((b) => {
                    const config = getTokenConfig(b.denom);
                    const amount = parseInt(b.amount) / Math.pow(10, config.decimals);
                    const usdValue = amount * config.priceUsd;
                    const isUpdating = updatingTokens.has(b.denom);
                    const isZeroBalance = parseInt(b.amount) === 0;

                    return (
                      <Box
                        key={b.denom}
                        bg="#141414"
                        borderRadius="xl"
                        p={4}
                        position="relative"
                        opacity={isUpdating ? 0.7 : isZeroBalance ? 0.5 : 1}
                        transition="opacity 0.2s"
                      >
                        <HStack justify="space-between">
                          <VStack align="start" spacing={0}>
                            <HStack spacing={2}>
                              <Text fontWeight="semibold">{config.symbol}</Text>
                              <Text color="gray.500" fontSize="sm">
                                {config.name}
                              </Text>
                              {isUpdating && <Spinner size="xs" color="cyan.400" />}
                            </HStack>
                            <Text
                              fontSize="lg"
                              fontWeight="medium"
                              color={isZeroBalance ? 'gray.600' : 'white'}
                            >
                              {amount < 0.001 && amount > 0
                                ? amount.toFixed(6)
                                : amount.toLocaleString(undefined, {
                                    minimumFractionDigits: 3,
                                    maximumFractionDigits: 6,
                                  })}
                            </Text>
                          </VStack>
                          <VStack align="end" spacing={0}>
                            <Text color={isZeroBalance ? 'gray.600' : 'gray.400'} fontSize="sm">
                              ${usdValue.toFixed(3)}
                            </Text>
                            {isUpdating && (
                              <Text color="cyan.400" fontSize="xs">
                                updating...
                              </Text>
                            )}
                          </VStack>
                        </HStack>
                      </Box>
                    );
                  });
                })()
              )}
            </VStack>
          </Box>
        </VStack>
      </Box>

      {/* Floating Settings Button */}
      <Button
        position="absolute"
        bottom={4}
        right={4}
        size="sm"
        bg="#1a1a1a"
        color="gray.400"
        border="1px solid"
        borderColor="#2a2a2a"
        _hover={{ bg: '#222222', color: 'white', borderColor: '#3a3a3a' }}
        borderRadius="lg"
        fontSize="xs"
        fontWeight="normal"
        onClick={onNavigateToSettings}
      >
        Settings
      </Button>

      {/* Send Modal */}
      <SendModal
        isOpen={isSendOpen}
        onClose={onSendClose}
        chainId={selectedChainId}
        chainConfig={selectedChainConfig}
        networkType={selectedNetworkType}
        bitcoinAddress={bitcoinAddress}
        evmAddress={evmAddress}
      />

      {/* Swap Modal */}
      <SwapModal
        isOpen={isSwapOpen}
        onClose={onSwapClose}
        chainId={selectedChainId}
        chainConfig={selectedChainConfig}
        onSwapSuccess={handleSwapSuccess}
      />

      {/* Network Manager Modal */}
      <NetworkManagerModal
        isOpen={isNetworkManagerOpen}
        onClose={onNetworkManagerClose}
        onNetworkChange={() => {
          // Force re-render when networks change
          loadPreferences();
        }}
      />
    </Box>
  );
};

export default Dashboard;
