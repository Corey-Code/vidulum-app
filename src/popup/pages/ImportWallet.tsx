import React, { useState } from 'react';
import {
  Box,
  Button,
  Input,
  VStack,
  Text,
  useToast,
  Textarea,
  InputGroup,
  InputRightElement,
  IconButton,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, DownloadIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';
import { MnemonicManager } from '@/lib/crypto/mnemonic';

interface Props {
  onSuccess: () => void;
  onSwitchToCreate: () => void;
}

const ImportWallet: React.FC<Props> = ({ onSuccess, onSwitchToCreate }) => {
  const [mnemonic, setMnemonic] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { importWallet } = useWalletStore();
  const toast = useToast();

  const handleImport = async () => {
    // Validate password first
    if (password.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    const normalizedMnemonic = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');

    if (!normalizedMnemonic) {
      toast({
        title: 'Recovery phrase required',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    const isValid = MnemonicManager.validateMnemonic(normalizedMnemonic);

    if (!isValid) {
      toast({
        title: 'Invalid recovery phrase',
        description: 'Please check your mnemonic. Must be 12 or 24 words.',
        status: 'error',
        duration: 5000,
      });
      return;
    }

    setLoading(true);
    try {
      await importWallet(normalizedMnemonic, password);
      toast({
        title: 'Wallet imported',
        status: 'success',
        duration: 3000,
      });
      onSuccess();
    } catch (error) {
      toast({
        title: 'Failed to import',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const wordCount = mnemonic.trim() ? mnemonic.trim().split(/\s+/).length : 0;

  return (
    <Box h="full" bg="#0a0a0a" p={6} overflowY="auto">
      <VStack spacing={6} align="stretch">
        {/* Icon and Title */}
        <VStack spacing={4}>
          <Box
            w={16}
            h={16}
            borderRadius="2xl"
            bg="#141414"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <DownloadIcon boxSize={7} color="cyan.400" />
          </Box>
          <VStack spacing={1}>
            <Text fontSize="2xl" fontWeight="semibold" color="white">
              Import Wallet
            </Text>
            <Text color="gray.500" fontSize="sm" textAlign="center">
              Enter your secret recovery phrase
            </Text>
          </VStack>
        </VStack>

        {/* Recovery Phrase */}
        <Box bg="#141414" borderRadius="xl" p={4}>
          <Textarea
            placeholder="Enter your 12 or 24 word recovery phrase"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            rows={4}
            fontFamily="mono"
            fontSize="sm"
            bg="transparent"
            border="none"
            resize="none"
            _placeholder={{ color: 'gray.500' }}
            _focus={{ outline: 'none' }}
          />
          {mnemonic && (
            <Text fontSize="xs" color={wordCount === 12 || wordCount === 24 ? 'cyan.400' : 'gray.500'} mt={2}>
              {wordCount} words
            </Text>
          )}
        </Box>

        {/* Password Fields */}
        <VStack spacing={3}>
          <InputGroup>
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              size="lg"
              bg="#141414"
              border="none"
              borderRadius="xl"
              _placeholder={{ color: 'gray.500' }}
              _focus={{ ring: 2, ringColor: 'cyan.400' }}
            />
            <InputRightElement h="full">
              <IconButton
                aria-label="Toggle password"
                icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                onClick={() => setShowPassword(!showPassword)}
                variant="ghost"
                size="sm"
                color="gray.500"
                _hover={{ color: 'white' }}
              />
            </InputRightElement>
          </InputGroup>

          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            size="lg"
            bg="#141414"
            border="none"
            borderRadius="xl"
            _placeholder={{ color: 'gray.500' }}
            _focus={{ ring: 2, ringColor: 'cyan.400' }}
          />
        </VStack>

        {/* Buttons */}
        <VStack spacing={3}>
          <Button
            w="full"
            size="lg"
            bg="cyan.500"
            color="white"
            _hover={{ bg: 'cyan.600' }}
            borderRadius="xl"
            onClick={handleImport}
            isLoading={loading}
            isDisabled={!mnemonic || !password || !confirmPassword}
          >
            Import Wallet
          </Button>

          <Button
            variant="ghost"
            color="gray.500"
            _hover={{ color: 'white' }}
            onClick={onSwitchToCreate}
            size="sm"
          >
            Create new wallet
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
};

export default ImportWallet;
