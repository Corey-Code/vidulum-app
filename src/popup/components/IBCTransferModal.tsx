import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Input,
  InputGroup,
  InputRightElement,
  FormControl,
  FormLabel,
  FormHelperText,
  useToast,
  Box,
  Divider,
  Spinner,
  Badge,
  Image,
} from '@chakra-ui/react';
import { ChevronRightIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { useChainStore } from '@/store/chainStore';
import { RegistryAsset } from '@/lib/assets/chainRegistry';
import { IBCChannel, fetchIBCConnections, getChainDisplayName } from '@/lib/cosmos/ibc-connections';
import { COSMOS_REGISTRY_CHAINS } from '@/lib/networks/cosmos-registry';

interface IBCTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceChainId: string;
  asset: RegistryAsset;
  balance: string;
  onSuccess?: () => void;
}

const IBCTransferModal: React.FC<IBCTransferModalProps> = ({
  isOpen,
  onClose,
  sourceChainId,
  asset,
  balance,
  onSuccess,
}) => {
  const {
    getAddressForChain,
    signAndBroadcast,
    signAndBroadcastWithPassword,
    hasMnemonicInMemory,
    selectedAccount,
  } = useWalletStore();
  const { fetchBalance } = useChainStore();
  const toast = useToast();

  // Check if the current account is an imported account (has its own mnemonic)
  const isImportedAccount = selectedAccount?.id?.startsWith('imported-') ?? false;

  const [step, setStep] = useState<'select-destination' | 'input-amount' | 'confirm' | 'password'>(
    'select-destination'
  );
  const [ibcConnections, setIbcConnections] = useState<IBCChannel[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState<IBCChannel | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

  // Get source chain config
  const sourceChain = COSMOS_REGISTRY_CHAINS.find((c) => c.id === sourceChainId);
  const sourceAddress = sourceChain ? getAddressForChain(sourceChain.bech32Prefix) : null;

  // Calculate available balance
  const availableBalance = parseInt(balance) / Math.pow(10, asset.decimals);

  // Load IBC connections when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingConnections(true);
      fetchIBCConnections(sourceChainId)
        .then((connections) => {
          setIbcConnections(connections);
        })
        .catch((error) => {
          console.error('Failed to fetch IBC connections:', error);
          setIbcConnections([]);
        })
        .finally(() => {
          setLoadingConnections(false);
        });
    }
  }, [isOpen, sourceChainId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('select-destination');
      setSelectedDestination(null);
      setAmount('');
      setPassword('');
    }
  }, [isOpen]);

  // Get destination chain logo
  const getChainLogo = (chainId: string): string | undefined => {
    const chain = COSMOS_REGISTRY_CHAINS.find((c) => c.id === chainId);
    return chain?.logoUrl;
  };

  // Get destination address for the recipient chain
  const getDestinationAddress = (): string | null => {
    if (!selectedDestination) return null;
    const destChain = COSMOS_REGISTRY_CHAINS.find((c) => c.id === selectedDestination.destChainId);
    if (!destChain) return null;
    return getAddressForChain(destChain.bech32Prefix);
  };

  // Handle destination selection
  const handleSelectDestination = (connection: IBCChannel) => {
    setSelectedDestination(connection);
    setStep('input-amount');
  };

  // Calculate estimated fee for display and max amount calculation
  const getEstimatedFee = () => {
    const gasLimit = 250000;
    const gasPrice = parseFloat(sourceChain?.gasPrice || '0.025');
    const feeDenom = sourceChain?.feeDenom || '';
    // Determine decimals based on the fee denom, not the transferred asset.
    // Most Cosmos SDK chains use 6 decimals for micro/atto denoms (starting with 'u' or 'a'),
    // and 18 decimals otherwise.
    const decimals =
      feeDenom.startsWith('u') || feeDenom.startsWith('a') ? 6 : 18;
    const feeAmount = Math.ceil(gasLimit * gasPrice * 1.5);
    return feeAmount / Math.pow(10, decimals);
  };

  // Handle max amount
  const handleMaxAmount = () => {
    // Leave buffer for fees if sending native token
    const isNativeToken = asset.denom === sourceChain?.feeDenom;
    const estimatedFee = getEstimatedFee();
    if (isNativeToken && availableBalance > estimatedFee) {
      setAmount((availableBalance - estimatedFee).toFixed(6));
    } else {
      setAmount(availableBalance.toFixed(6));
    }
  };

  // Validate amount
  const isValidAmount = (): boolean => {
    const amountNum = parseFloat(amount);
    return !isNaN(amountNum) && amountNum > 0 && amountNum <= availableBalance;
  };

  // Handle IBC transfer
  const handleTransfer = async (usePassword: boolean = false) => {
    if (!selectedDestination || !sourceAddress) return;

    const destAddress = getDestinationAddress();
    if (!destAddress) {
      toast({
        title: 'Error',
        description: 'Could not determine destination address',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Check if we need password for cross-chain signing
    // Imported accounts always need password since their mnemonic is stored separately
    if (!usePassword && (isImportedAccount || !hasMnemonicInMemory())) {
      setStep('password');
      return;
    }

    setLoading(true);

    try {
      const amountNum = parseFloat(amount);
      const amountInSmallestUnit = Math.floor(amountNum * Math.pow(10, asset.decimals)).toString();

      // Build MsgTransfer
      // Timeout: 10 minutes from now in nanoseconds
      const timeoutTimestampNs = BigInt(Date.now() + 10 * 60 * 1000) * BigInt(1_000_000);

      const msgTransfer = {
        typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
        value: {
          sourcePort: selectedDestination.sourcePort,
          sourceChannel: selectedDestination.sourceChannelId,
          token: {
            denom: asset.denom,
            amount: amountInSmallestUnit,
          },
          sender: sourceAddress,
          receiver: destAddress,
          timeoutHeight: {
            revisionNumber: BigInt(0),
            revisionHeight: BigInt(0),
          },
          timeoutTimestamp: timeoutTimestampNs,
          memo: '',
        },
      };

      // Calculate fee based on chain's gas price
      // IBC transfers typically use ~250000 gas
      const gasLimit = 250000;
      const gasPrice = parseFloat(sourceChain?.gasPrice || '0.025');
      // Add 50% buffer to gas price to ensure transaction succeeds
      const feeAmount = Math.ceil(gasLimit * gasPrice * 1.5);

      const fee = {
        amount: [{ denom: sourceChain?.feeDenom || 'ubze', amount: feeAmount.toString() }],
        gas: gasLimit.toString(),
      };

      // Sign and broadcast (with password if needed)
      let txHash: string;
      if (usePassword) {
        txHash = await signAndBroadcastWithPassword(sourceChainId, [msgTransfer], password, fee);
      } else {
        txHash = await signAndBroadcast(sourceChainId, [msgTransfer], fee);
      }

      toast({
        title: 'IBC Transfer Submitted',
        description: `Transaction hash: ${txHash.slice(0, 16)}...`,
        status: 'success',
        duration: 5000,
      });

      // Refresh balances on both chains
      if (sourceAddress) {
        fetchBalance(sourceChainId, sourceAddress);
      }
      if (destAddress) {
        fetchBalance(selectedDestination.destChainId, destAddress);
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('IBC transfer failed:', error);
      toast({
        title: 'Transfer Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent bg="#1a1a1a" borderColor="#2a2a2a" borderWidth="1px">
        <ModalHeader color="white" borderBottomWidth="1px" borderColor="#2a2a2a">
          <HStack spacing={2}>
            <Text>IBC Transfer</Text>
            <Badge colorScheme="purple" fontSize="xs">
              {asset.symbol}
            </Badge>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="gray.500" />

        <ModalBody py={4}>
          {/* Step 1: Select Destination */}
          {step === 'select-destination' && (
            <VStack spacing={4} align="stretch">
              <Text color="gray.400" fontSize="sm">
                Select destination network for your {asset.symbol}
              </Text>

              {loadingConnections ? (
                <HStack justify="center" py={8}>
                  <Spinner color="cyan.400" />
                  <Text color="gray.500">Loading IBC connections...</Text>
                </HStack>
              ) : ibcConnections.length === 0 ? (
                <Box textAlign="center" py={8}>
                  <Text color="gray.500">No IBC connections available</Text>
                  <Text color="gray.600" fontSize="sm" mt={2}>
                    This chain may not have active IBC channels to other enabled networks
                  </Text>
                </Box>
              ) : (
                <VStack spacing={2} align="stretch">
                  {ibcConnections.map((connection) => (
                    <Box
                      key={connection.destChainId}
                      bg="#141414"
                      borderRadius="lg"
                      p={3}
                      cursor="pointer"
                      border="1px solid"
                      borderColor="#2a2a2a"
                      _hover={{ borderColor: 'purple.500', bg: '#1a1a1a' }}
                      onClick={() => handleSelectDestination(connection)}
                    >
                      <HStack justify="space-between">
                        <HStack spacing={3}>
                          {getChainLogo(connection.destChainId) ? (
                            <Image
                              src={getChainLogo(connection.destChainId)}
                              boxSize="32px"
                              borderRadius="full"
                              fallback={
                                <Box
                                  boxSize="32px"
                                  borderRadius="full"
                                  bg="purple.900"
                                  display="flex"
                                  alignItems="center"
                                  justifyContent="center"
                                >
                                  <Text fontSize="xs" color="purple.300">
                                    {getChainDisplayName(connection.destChainId).slice(0, 2)}
                                  </Text>
                                </Box>
                              }
                            />
                          ) : (
                            <Box
                              boxSize="32px"
                              borderRadius="full"
                              bg="purple.900"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                            >
                              <Text fontSize="xs" color="purple.300">
                                {getChainDisplayName(connection.destChainId).slice(0, 2)}
                              </Text>
                            </Box>
                          )}
                          <VStack align="start" spacing={0}>
                            <Text fontWeight="medium" color="white">
                              {getChainDisplayName(connection.destChainId)}
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              Channel: {connection.sourceChannelId}
                            </Text>
                          </VStack>
                        </HStack>
                        <HStack>
                          {connection.status === 'ACTIVE' && (
                            <Badge colorScheme="green" size="sm">
                              Active
                            </Badge>
                          )}
                          <ChevronRightIcon color="gray.500" />
                        </HStack>
                      </HStack>
                    </Box>
                  ))}
                </VStack>
              )}
            </VStack>
          )}

          {/* Step 2: Input Amount */}
          {step === 'input-amount' && selectedDestination && (
            <VStack spacing={4} align="stretch">
              {/* Transfer Route */}
              <Box bg="#141414" borderRadius="lg" p={3}>
                <HStack justify="space-between">
                  <VStack align="start" spacing={0}>
                    <Text color="gray.500" fontSize="xs">
                      From
                    </Text>
                    <Text color="white" fontWeight="medium">
                      {getChainDisplayName(sourceChainId)}
                    </Text>
                  </VStack>
                  <ChevronRightIcon color="purple.400" boxSize={5} />
                  <VStack align="end" spacing={0}>
                    <Text color="gray.500" fontSize="xs">
                      To
                    </Text>
                    <Text color="white" fontWeight="medium">
                      {getChainDisplayName(selectedDestination.destChainId)}
                    </Text>
                  </VStack>
                </HStack>
              </Box>

              {/* Amount Input */}
              <FormControl>
                <FormLabel color="gray.400" fontSize="sm">
                  Amount
                </FormLabel>
                <InputGroup>
                  <Input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    type="number"
                    bg="#0a0a0a"
                    borderColor="#3a3a3a"
                    color="white"
                    _hover={{ borderColor: '#4a4a4a' }}
                    _focus={{ borderColor: 'purple.500', boxShadow: 'none' }}
                  />
                  <InputRightElement width="auto" pr={2}>
                    <HStack spacing={2}>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="purple.400"
                        onClick={handleMaxAmount}
                        _hover={{ bg: 'whiteAlpha.100' }}
                      >
                        MAX
                      </Button>
                      <Text color="gray.500">{asset.symbol}</Text>
                    </HStack>
                  </InputRightElement>
                </InputGroup>
                <FormHelperText color="gray.500">
                  Available:{' '}
                  {availableBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}{' '}
                  {asset.symbol}
                </FormHelperText>
              </FormControl>

              {/* Destination Address Preview */}
              <Box bg="#141414" borderRadius="lg" p={3}>
                <Text color="gray.500" fontSize="xs" mb={1}>
                  Recipient Address
                </Text>
                <Text color="white" fontSize="sm" fontFamily="mono" wordBreak="break-all">
                  {getDestinationAddress() || 'Could not derive address'}
                </Text>
              </Box>
            </VStack>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedDestination && (
            <VStack spacing={4} align="stretch">
              <Text color="gray.400" fontSize="sm">
                Review your IBC transfer
              </Text>

              <Box bg="#141414" borderRadius="lg" p={4}>
                <VStack spacing={3} align="stretch">
                  <HStack justify="space-between">
                    <Text color="gray.500">Amount</Text>
                    <Text color="white" fontWeight="medium">
                      {parseFloat(amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}{' '}
                      {asset.symbol}
                    </Text>
                  </HStack>
                  <Divider borderColor="#2a2a2a" />
                  <HStack justify="space-between">
                    <Text color="gray.500">From</Text>
                    <Text color="white">{getChainDisplayName(sourceChainId)}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.500">To</Text>
                    <Text color="white">
                      {getChainDisplayName(selectedDestination.destChainId)}
                    </Text>
                  </HStack>
                  <Divider borderColor="#2a2a2a" />
                  <HStack justify="space-between">
                    <Text color="gray.500">Channel</Text>
                    <Text color="gray.400" fontSize="sm">
                      {selectedDestination.sourceChannelId}
                    </Text>
                  </HStack>
                  <Divider borderColor="#2a2a2a" />
                  <VStack align="start" spacing={0}>
                    <Text color="gray.500" fontSize="sm">
                      Recipient
                    </Text>
                    <Text color="white" fontSize="xs" fontFamily="mono" wordBreak="break-all">
                      {getDestinationAddress()}
                    </Text>
                  </VStack>
                </VStack>
              </Box>

              <Box
                bg="rgba(128, 90, 213, 0.1)"
                borderRadius="lg"
                p={3}
                border="1px solid"
                borderColor="purple.800"
              >
                <Text color="purple.300" fontSize="sm">
                  ⏱ IBC transfers typically take 30 seconds to a few minutes to complete
                </Text>
              </Box>
            </VStack>
          )}

          {/* Step 4: Password (only shown when mnemonic not in memory) */}
          {step === 'password' && selectedDestination && (
            <VStack spacing={4} align="stretch">
              <Text color="gray.400" fontSize="sm">
                Enter your password to sign this cross-chain transfer
              </Text>

              <Box
                bg="rgba(128, 90, 213, 0.1)"
                borderRadius="lg"
                p={3}
                border="1px solid"
                borderColor="purple.800"
              >
                <Text color="purple.300" fontSize="sm">
                  🔐 Your password is required to sign transactions on other Cosmos chains
                </Text>
              </Box>

              <FormControl>
                <FormLabel color="gray.400" fontSize="sm">
                  Password
                </FormLabel>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your wallet password"
                  bg="#0a0a0a"
                  borderColor="#3a3a3a"
                  color="white"
                  _hover={{ borderColor: '#4a4a4a' }}
                  _focus={{ borderColor: 'purple.500', boxShadow: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && password) {
                      handleTransfer(true);
                    }
                  }}
                />
              </FormControl>

              {/* Transfer Summary */}
              <Box bg="#141414" borderRadius="lg" p={3}>
                <VStack spacing={2} align="stretch">
                  <HStack justify="space-between">
                    <Text color="gray.500" fontSize="sm">
                      Amount
                    </Text>
                    <Text color="white" fontSize="sm" fontWeight="medium">
                      {parseFloat(amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })}{' '}
                      {asset.symbol}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="gray.500" fontSize="sm">
                      Route
                    </Text>
                    <Text color="white" fontSize="sm">
                      {getChainDisplayName(sourceChainId)} →{' '}
                      {getChainDisplayName(selectedDestination.destChainId)}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter borderTopWidth="1px" borderColor="#2a2a2a">
          {step === 'select-destination' && (
            <Button variant="ghost" color="gray.500" onClick={onClose}>
              Cancel
            </Button>
          )}

          {step === 'input-amount' && (
            <HStack spacing={3} w="full">
              <Button
                variant="ghost"
                color="gray.500"
                onClick={() => setStep('select-destination')}
              >
                Back
              </Button>
              <Button
                flex={1}
                colorScheme="purple"
                onClick={() => setStep('confirm')}
                isDisabled={!isValidAmount()}
              >
                Continue
              </Button>
            </HStack>
          )}

          {step === 'confirm' && (
            <HStack spacing={3} w="full">
              <Button
                variant="ghost"
                color="gray.500"
                onClick={() => setStep('input-amount')}
                isDisabled={loading}
              >
                Back
              </Button>
              <Button
                flex={1}
                colorScheme="purple"
                onClick={() => handleTransfer(false)}
                isLoading={loading}
                loadingText="Transferring..."
              >
                Confirm Transfer
              </Button>
            </HStack>
          )}

          {step === 'password' && (
            <HStack spacing={3} w="full">
              <Button
                variant="ghost"
                color="gray.500"
                onClick={() => {
                  setStep('confirm');
                  setPassword('');
                }}
                isDisabled={loading}
              >
                Back
              </Button>
              <Button
                flex={1}
                colorScheme="purple"
                onClick={() => handleTransfer(true)}
                isLoading={loading}
                loadingText="Transferring..."
                isDisabled={!password}
              >
                Sign & Transfer
              </Button>
            </HStack>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default IBCTransferModal;
