import React, { useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Input,
  VStack,
  Text,
  useToast,
  InputGroup,
  InputRightElement,
  IconButton,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon, LockIcon } from '@chakra-ui/icons';
import { useWalletStore } from '@/store/walletStore';

interface Props {
  onSuccess: () => void;
  onReset: () => void;
}

const Unlock: React.FC<Props> = ({ onSuccess, onReset }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { unlock, resetWallet } = useWalletStore();
  const toast = useToast();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast({
        title: 'Password required',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setLoading(true);
    try {
      await unlock(password);
      toast({
        title: 'Wallet unlocked',
        status: 'success',
        duration: 2000,
      });
      onSuccess();
    } catch (error) {
      toast({
        title: 'Failed to unlock wallet',
        description: 'Invalid password',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetWallet();
      setResetOpen(false);
      onReset();
    } catch (error) {
      toast({
        title: 'Could not reset wallet',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setResetting(false);
    }
  };

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
            <LockIcon boxSize={7} color="cyan.400" />
          </Box>
          <VStack spacing={1}>
            <Text fontSize="2xl" fontWeight="semibold" color="white">
              Welcome Back
            </Text>
            <Text color="gray.500" fontSize="sm">
              Enter your password to unlock
            </Text>
          </VStack>
        </VStack>

        {/* Form */}
        <form onSubmit={handleUnlock}>
          <VStack spacing={4}>
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
                autoFocus
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

            <Button
              type="submit"
              w="full"
              size="lg"
              bg="cyan.500"
              color="white"
              _hover={{ bg: 'cyan.600' }}
              borderRadius="xl"
              isLoading={loading}
              isDisabled={!password}
            >
              Unlock
            </Button>

            <Button
              type="button"
              variant="ghost"
              color="gray.500"
              _hover={{ color: 'white' }}
              size="sm"
              onClick={() => setResetOpen(true)}
            >
              Forgot password?
            </Button>
          </VStack>
        </form>

        <AlertDialog
          isOpen={resetOpen}
          leastDestructiveRef={cancelRef}
          onClose={() => setResetOpen(false)}
          isCentered
        >
          <AlertDialogOverlay>
            <AlertDialogContent bg="#141414" color="white" mx={4}>
              <AlertDialogHeader fontSize="lg" fontWeight="semibold">
                Reset this wallet?
              </AlertDialogHeader>
              <AlertDialogBody>
                <Text color="gray.300" fontSize="sm">
                  This removes the wallet saved in this browser. Your coins stay on the chain. You
                  need your recovery phrase to import it and choose a new password. Without that
                  phrase, this copy cannot be restored.
                </Text>
              </AlertDialogBody>
              <AlertDialogFooter>
                <Button
                  ref={cancelRef}
                  variant="ghost"
                  onClick={() => setResetOpen(false)}
                  isDisabled={resetting}
                >
                  Cancel
                </Button>
                <Button
                  bg="red.500"
                  color="white"
                  _hover={{ bg: 'red.600' }}
                  ml={3}
                  onClick={handleReset}
                  isLoading={resetting}
                >
                  Reset wallet
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </VStack>
    </Box>
  );
};

export default Unlock;
