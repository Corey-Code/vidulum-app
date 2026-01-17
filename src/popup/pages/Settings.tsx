import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  IconButton,
  Input,
  Divider,
  useToast,
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { EncryptedStorage } from '@/lib/storage/encrypted-storage';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { accounts, autoLockMinutes, setAutoLockMinutes, lock } = useWalletStore();
  const toast = useToast();

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
        </VStack>
      </Box>
    </Box>
  );
};

export default Settings;
