import React, { useEffect, useState } from 'react';
import { Box, VStack, HStack, Text, Button, Spinner, Badge, Code, Divider } from '@chakra-ui/react';
import { CheckIcon, CloseIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import browser from 'webextension-polyfill';
import { MessageType } from '@/types/messages';
import { parseSignDoc, ParsedTransaction } from '@/lib/cosmos/tx-parser';

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
  const [showRawTx, setShowRawTx] = useState(false);
  const [parsedTx, setParsedTx] = useState<{
    messages: ParsedTransaction[];
    chainId: string;
    memo?: string;
  } | null>(null);
  const [parsingTx, setParsingTx] = useState(false);

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

  // Parse transaction when approval is loaded
  useEffect(() => {
    const parseTx = async () => {
      if (!approval || approval.type !== 'transaction' || !approval.data?.signDoc) {
        return;
      }

      setParsingTx(true);
      try {
        const signDoc = approval.data.signDoc;
        const chainId = signDoc.chain_id || signDoc.chainId || 'beezee-1';
        const parsed = await parseSignDoc(chainId, signDoc);
        setParsedTx(parsed);
      } catch (err) {
        console.error('Failed to parse transaction:', err);
        // Fallback to raw display
      } finally {
        setParsingTx(false);
      }
    };

    parseTx();
  }, [approval]);

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
            {parsingTx ? (
              <VStack py={4}>
                <Spinner size="sm" color="orange.400" />
                <Text fontSize="xs" color="gray.500">
                  Parsing transaction...
                </Text>
              </VStack>
            ) : parsedTx && !showRawTx ? (
              <>
                {/* Parsed Transaction Summary */}
                {parsedTx.messages.map((msg, idx) => (
                  <Box
                    key={idx}
                    bg="#141414"
                    borderRadius="lg"
                    p={4}
                    borderWidth="1px"
                    borderColor="#2a2a2a"
                  >
                    <HStack justify="space-between" mb={2}>
                      <Badge colorScheme="cyan">{msg.type}</Badge>
                    </HStack>
                    <Text fontSize="md" color="white" fontWeight="medium" mb={3}>
                      {msg.summary}
                    </Text>
                    <VStack align="stretch" spacing={1}>
                      {Object.entries(msg.details).map(([key, value]) => (
                        <HStack key={key} justify="space-between" fontSize="xs">
                          <Text color="gray.500">{key}</Text>
                          <Text color="gray.300" maxW="200px" isTruncated>
                            {value}
                          </Text>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                ))}

                {/* Fee info */}
                {approval.data?.signDoc?.fee && (
                  <Box bg="#141414" borderRadius="lg" p={3} borderWidth="1px" borderColor="#2a2a2a">
                    <HStack justify="space-between" fontSize="xs">
                      <Text color="gray.500">Network Fee</Text>
                      <Text color="gray.300">
                        {approval.data.signDoc.fee.amount?.[0]?.amount
                          ? `${(parseInt(approval.data.signDoc.fee.amount[0].amount) / 1_000_000).toFixed(6)} ${approval.data.signDoc.fee.amount[0].denom || ''}`
                          : 'Unknown'}
                      </Text>
                    </HStack>
                  </Box>
                )}

                {/* Toggle to show raw */}
                <Button
                  variant="ghost"
                  size="xs"
                  color="gray.500"
                  leftIcon={<ViewIcon />}
                  onClick={() => setShowRawTx(true)}
                  alignSelf="center"
                >
                  Show Raw Transaction
                </Button>
              </>
            ) : (
              <>
                {/* Raw Transaction View */}
                <Text fontSize="sm" color="gray.300" textAlign="center">
                  Review and approve this transaction
                </Text>

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
                    Raw Transaction
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

                {parsedTx && (
                  <Button
                    variant="ghost"
                    size="xs"
                    color="gray.500"
                    leftIcon={<ViewOffIcon />}
                    onClick={() => setShowRawTx(false)}
                    alignSelf="center"
                  >
                    Show Summary
                  </Button>
                )}
              </>
            )}

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
