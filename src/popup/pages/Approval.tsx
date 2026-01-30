import React, { useEffect, useState } from 'react';
import { Box, VStack, HStack, Text, Button, Spinner, Badge, Code, Divider } from '@chakra-ui/react';
import { CheckIcon, CloseIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import browser from 'webextension-polyfill';
import { MessageType } from '@/types/messages';
import { parseTransaction } from '@/lib/cosmos/tx-parser';

interface ApprovalData {
  id: string;
  type: 'connection' | 'transaction' | 'signing';
  origin: string;
  data: any;
}

interface ApprovalProps {
  approvalId: string;
  onComplete?: () => void; // Optional callback when approval is done
}

const Approval: React.FC<ApprovalProps> = ({ approvalId, onComplete }) => {
  const [approval, setApproval] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);
  const [showRawTransaction, setShowRawTransaction] = useState(false);

  // Fetch approval details
  useEffect(() => {
    const fetchApproval = async () => {
      try {
        const response = await browser.runtime.sendMessage({
          type: MessageType.GET_APPROVAL,
          payload: { approvalId },
        });

        if (response.success && response.data) {
          setApproval(response.data);
        } else {
          setError(response.error || 'Approval not found');
        }
      } catch (err) {
        setError('Failed to load approval request');
      } finally {
        setLoading(false);
      }
    };

    fetchApproval();
  }, [approvalId]);

  const handleResponse = async (approved: boolean) => {
    setResponding(true);
    try {
      await browser.runtime.sendMessage({
        type: MessageType.RESOLVE_APPROVAL,
        payload: { approvalId, approved },
      });

      // If we have a callback (normal popup), use it to navigate
      // Otherwise close the window (separate popup window)
      if (onComplete) {
        onComplete();
      } else {
        window.close();
      }
    } catch (err) {
      setError('Failed to send response');
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <Box minH="100vh" bg="#0a0a0a" color="white" p={6}>
        <VStack spacing={4} justify="center" h="full" minH="400px">
          <Spinner size="xl" color="orange.400" />
          <Text color="gray.400">Loading approval request...</Text>
        </VStack>
      </Box>
    );
  }

  if (error || !approval) {
    return (
      <Box minH="100vh" bg="#0a0a0a" color="white" p={6}>
        <VStack spacing={4} justify="center" h="full" minH="400px">
          <Text color="red.400">{error || 'Approval not found'}</Text>
          <Button
            onClick={() => (onComplete ? onComplete() : window.close())}
            variant="ghost"
            color="gray.400"
          >
            Close
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="#0a0a0a" color="white" p={4}>
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <HStack justify="center" mb={2}>
          <Text fontSize="lg" fontWeight="bold">
            {approval.type === 'connection' && 'Connection Request'}
            {approval.type === 'transaction' && 'Transaction Approval'}
            {approval.type === 'signing' && 'Signing Request'}
          </Text>
        </HStack>

        {/* Origin */}
        <Box bg="#141414" borderRadius="lg" p={3} borderWidth="1px" borderColor="#2a2a2a">
          <Text fontSize="xs" color="gray.500" mb={1}>
            Requesting Site
          </Text>
          <Text fontSize="sm" color="orange.400" wordBreak="break-all">
            {approval.origin || 'Unknown Origin'}
          </Text>
        </Box>

        <Divider borderColor="#2a2a2a" />

        {/* Connection Request Details */}
        {approval.type === 'connection' && (
          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" color="gray.300" textAlign="center">
              This site wants to connect to your wallet
            </Text>

            <Box bg="#141414" borderRadius="lg" p={3} borderWidth="1px" borderColor="#2a2a2a">
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.400">
                  Chain
                </Text>
                <Badge colorScheme="orange">{approval.data?.chainId}</Badge>
              </HStack>
            </Box>

            <Box bg="orange.900" borderRadius="lg" p={3} borderWidth="1px" borderColor="orange.700">
              <Text fontSize="xs" color="orange.200">
                This will allow the site to:
              </Text>
              <VStack align="start" mt={2} spacing={1}>
                <Text fontSize="xs" color="orange.100">
                  • View your wallet address
                </Text>
                <Text fontSize="xs" color="orange.100">
                  • Request transaction signatures
                </Text>
              </VStack>
            </Box>
          </VStack>
        )}

        {/* Transaction Approval Details */}
        {approval.type === 'transaction' && (
          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" color="gray.300" textAlign="center">
              Review and approve this transaction
            </Text>

            {!showRawTransaction ? (
              /* Parsed Transaction View */
              <>
                {(() => {
                  try {
                    // Check if signDoc exists before parsing
                    if (!approval.data?.signDoc) {
                      throw new Error('No transaction data');
                    }
                    
                    const parsed = parseTransaction(approval.data.signDoc);
                    return (
                      <>
                        {/* Messages */}
                        <VStack spacing={2} align="stretch">
                          {parsed.messages.map((msg, index) => (
                            <Box
                              key={index}
                              bg="#141414"
                              borderRadius="lg"
                              p={3}
                              borderWidth="1px"
                              borderColor="#2a2a2a"
                            >
                              <HStack justify="space-between" align="start">
                                <VStack align="start" spacing={1} flex={1}>
                                  <Badge colorScheme="blue" fontSize="xs">
                                    {msg.type}
                                  </Badge>
                                  <Text fontSize="sm" color="gray.200">
                                    {msg.summary}
                                  </Text>
                                </VStack>
                              </HStack>
                            </Box>
                          ))}
                        </VStack>

                        {/* Fee */}
                        <Box
                          bg="#141414"
                          borderRadius="lg"
                          p={3}
                          borderWidth="1px"
                          borderColor="#2a2a2a"
                        >
                          <HStack justify="space-between">
                            <Text fontSize="sm" color="gray.400">
                              Transaction Fee
                            </Text>
                            <Text fontSize="sm" color="orange.400" fontWeight="medium">
                              {parsed.fee}
                            </Text>
                          </HStack>
                        </Box>

                        {/* Memo (if present) */}
                        {parsed.memo && (
                          <Box
                            bg="#141414"
                            borderRadius="lg"
                            p={3}
                            borderWidth="1px"
                            borderColor="#2a2a2a"
                          >
                            <Text fontSize="xs" color="gray.500" mb={1}>
                              Memo
                            </Text>
                            <Text fontSize="sm" color="gray.300" wordBreak="break-word">
                              {parsed.memo}
                            </Text>
                          </Box>
                        )}
                      </>
                    );
                  } catch (err) {
                    // Fallback to raw view if parsing fails
                    return (
                      <Box
                        bg="#141414"
                        borderRadius="lg"
                        p={3}
                        borderWidth="1px"
                        borderColor="#2a2a2a"
                        maxH="200px"
                        overflow="auto"
                      >
                        <Text fontSize="xs" color="gray.500" mb={2}>
                          Transaction Details (parsing error)
                        </Text>
                        <Code
                          fontSize="xs"
                          bg="transparent"
                          color="gray.300"
                          whiteSpace="pre-wrap"
                          display="block"
                        >
                          {JSON.stringify(approval.data?.signDoc, null, 2)}
                        </Code>
                      </Box>
                    );
                  }
                })()}
              </>
            ) : (
              /* Raw Transaction View */
              <Box
                bg="#141414"
                borderRadius="lg"
                p={3}
                borderWidth="1px"
                borderColor="#2a2a2a"
                maxH="200px"
                overflow="auto"
              >
                <Text fontSize="xs" color="gray.500" mb={2}>
                  Transaction Details
                </Text>
                <Code
                  fontSize="xs"
                  bg="transparent"
                  color="gray.300"
                  whiteSpace="pre-wrap"
                  display="block"
                >
                  {JSON.stringify(approval.data?.signDoc, null, 2)}
                </Code>
              </Box>
            )}

            {/* Toggle Button */}
            <Button
              size="sm"
              variant="ghost"
              color="gray.400"
              leftIcon={showRawTransaction ? <ViewOffIcon /> : <ViewIcon />}
              onClick={() => setShowRawTransaction(!showRawTransaction)}
            >
              {showRawTransaction ? 'Show Parsed Transaction' : 'Show Raw Transaction'}
            </Button>

            <Box bg="red.900" borderRadius="lg" p={3} borderWidth="1px" borderColor="red.700">
              <Text fontSize="xs" color="red.200">
                Warning: This transaction will use your funds. Review carefully before approving.
              </Text>
            </Box>
          </VStack>
        )}

        {/* Signing Request Details */}
        {approval.type === 'signing' && (
          <VStack spacing={3} align="stretch">
            <Text fontSize="sm" color="gray.300" textAlign="center">
              Sign this message
            </Text>

            <Box
              bg="#141414"
              borderRadius="lg"
              p={3}
              borderWidth="1px"
              borderColor="#2a2a2a"
              maxH="150px"
              overflow="auto"
            >
              <Text fontSize="xs" color="gray.500" mb={2}>
                Message
              </Text>
              <Text fontSize="sm" color="gray.300" wordBreak="break-all">
                {typeof approval.data?.message === 'string'
                  ? approval.data.message
                  : JSON.stringify(approval.data?.message)}
              </Text>
            </Box>
          </VStack>
        )}

        {/* Action Buttons */}
        <VStack spacing={3} pt={4}>
          <Button
            w="full"
            colorScheme="green"
            leftIcon={<CheckIcon />}
            onClick={() => handleResponse(true)}
            isLoading={responding}
            loadingText="Approving..."
          >
            Approve
          </Button>
          <Button
            w="full"
            colorScheme="red"
            variant="outline"
            leftIcon={<CloseIcon />}
            onClick={() => handleResponse(false)}
            isLoading={responding}
            loadingText="Rejecting..."
          >
            Reject
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
};

export default Approval;
