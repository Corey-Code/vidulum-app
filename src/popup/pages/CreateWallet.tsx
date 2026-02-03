import React, { useState } from 'react';
import {
  Box,
  Button,
  Input,
  VStack,
  Text,
  useToast,
  InputGroup,
  InputRightElement,
  IconButton,
  Textarea,
  Checkbox,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, CopyIcon, AddIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';

interface Props {
  onSuccess: () => void;
  onSwitchToImport: () => void;
}

const CreateWallet: React.FC<Props> = ({ onSuccess, onSwitchToImport }) => {
  const [step, setStep] = useState<'password' | 'mnemonic'>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const { createWallet } = useWalletStore();
  const toast = useToast();

  const handleCreateWallet = async () => {
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

    setLoading(true);
    try {
      const generatedMnemonic = await createWallet(password);
      setMnemonic(generatedMnemonic);
      setStep('mnemonic');
    } catch (error) {
      toast({
        title: 'Failed to create wallet',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyMnemonic = () => {
    navigator.clipboard.writeText(mnemonic);
    toast({
      title: 'Copied to clipboard',
      status: 'success',
      duration: 2000,
    });
  };

  const handleFinish = () => {
    if (confirmed) {
      onSuccess();
    }
  };

  if (step === 'password') {
    return (
      <Box h="full" bg="#0a0a0a" display="flex" alignItems="center" justifyContent="center" p={6}>
        <VStack spacing={8} align="stretch" w="full" maxW="320px">
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
              <AddIcon boxSize={7} color="cyan.400" />
            </Box>
            <VStack spacing={1}>
              <Text fontSize="2xl" fontWeight="semibold" color="white">
                Create Wallet
              </Text>
              <Text color="gray.500" fontSize="sm" textAlign="center">
                Create a password to secure your wallet
              </Text>
            </VStack>
          </VStack>

          {/* Form */}
          <VStack spacing={3}>
            <InputGroup>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
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

            <Button
              w="full"
              size="lg"
              bg="cyan.500"
              color="white"
              _hover={{ bg: 'cyan.600' }}
              borderRadius="xl"
              onClick={handleCreateWallet}
              isLoading={loading}
              isDisabled={!password || !confirmPassword}
            >
              Create Wallet
            </Button>

            <Button
              variant="ghost"
              color="gray.500"
              _hover={{ color: 'white' }}
              onClick={onSwitchToImport}
              size="sm"
            >
              Import existing wallet
            </Button>
          </VStack>
        </VStack>
      </Box>
    );
  }

  return (
    <Box h="full" w="fit-content" bg="#0a0a0a" p={6} overflowY="auto" overflowX="auto">
      <VStack spacing={6} align="stretch">
        <VStack spacing={2}>
          <Text fontSize="xl" fontWeight="semibold" color="white">
            Secret Recovery Phrase
          </Text>
          <Text color="gray.500" fontSize="sm" textAlign="center">
            Write down this phrase and store it safely. Never share it.
          </Text>
        </VStack>

        <Box position="relative" bg="#141414" borderRadius="xl" p={4}>
          <Textarea
            value={mnemonic}
            readOnly
            rows={4}
            fontFamily="mono"
            fontSize="sm"
            bg="transparent"
            border="none"
            resize="none"
            _focus={{ outline: 'none' }}
          />
          <IconButton
            aria-label="Copy"
            icon={<CopyIcon />}
            position="absolute"
            top={3}
            right={3}
            size="sm"
            variant="ghost"
            color="gray.500"
            _hover={{ color: 'white' }}
            onClick={handleCopyMnemonic}
          />
        </Box>

        <Box bg="#141414" borderRadius="xl" p={4}>
          <Checkbox
            isChecked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            colorScheme="cyan"
          >
            <Text fontSize="sm" color="gray.400">
              I have saved my recovery phrase
            </Text>
          </Checkbox>
        </Box>

        <Button
          w="full"
          size="lg"
          bg="cyan.500"
          color="white"
          _hover={{ bg: 'cyan.600' }}
          borderRadius="xl"
          onClick={handleFinish}
          isDisabled={!confirmed}
        >
          Continue
        </Button>
      </VStack>
    </Box>
  );
};

export default CreateWallet;
