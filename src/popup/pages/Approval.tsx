import React, { useEffect, useState } from 'react';
import { Box, VStack, HStack, Text, Button, Spinner, Badge, Code, Divider } from '@chakra-ui/react';
import { CheckIcon, CloseIcon, ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import browser from 'webextension-polyfill';
import { MessageType } from '@/types/messages';
import { parseSignDoc } from '@/lib/cosmos/tx-parser';
import type { ApprovalUiState } from '@/types/flows';

interface ApprovalProps {
  approvalId: string;
  onComplete?: () => void; // Optional callback when approval is done
}

const Approval: React.FC<ApprovalProps> = ({ approvalId, onComplete }) => {
  const [ui, setUi] = useState<ApprovalUiState>({ status: 'loading' });

  // Fetch approval details
  useEffect(() => {
    const fetchApproval = async () => {
      try {
        const response = await browser.runtime.sendMessage({
          type: MessageType.GET_APPROVAL,
          payload: { approvalId },
        });

        if (response.success && response.data) {
          setUi({
            status: 'ready',
            approval: response.data,
            responding: false,
            showRawTx: false,
            txParse: { status: 'idle' },
          });
        } else {
          setUi({ status: 'error', message: response.error || 'Approval not found' });
        }
      } catch {
        setUi({ status: 'error', message: 'Failed to load approval request' });
      }
    };

    fetchApproval();
  }, [approvalId]);

  // Parse transaction once when a ready transaction approval loads
  const readyApproval = ui.status === 'ready' ? ui.approval : null;
  const txParseStatus = ui.status === 'ready' ? ui.txParse.status : null;
  useEffect(() => {
    if (!readyApproval || readyApproval.type !== 'transaction' || !readyApproval.data?.signDoc) {
      return;
    }
    if (txParseStatus !== 'idle') return;

    let cancelled = false;
    setUi((prev) =>
      prev.status === 'ready' ? { ...prev, txParse: { status: 'parsing' } } : prev
    );

    const parseTx = async () => {
      try {
        const signDoc = readyApproval.data.signDoc;
        const chainId = signDoc.chain_id || signDoc.chainId || 'beezee-1';
        const parsed = await parseSignDoc(chainId, signDoc);
        if (cancelled) return;
        setUi((prev) =>
          prev.status === 'ready' ? { ...prev, txParse: { status: 'done', parsed } } : prev
        );
      } catch (err) {
        console.error('Failed to parse transaction:', err);
        if (cancelled) return;
        setUi((prev) =>
          prev.status === 'ready' ? { ...prev, txParse: { status: 'failed' } } : prev
        );
      }
    };

    void parseTx();
    return () => {
      cancelled = true;
    };
  }, [readyApproval, txParseStatus]);

  const handleResponse = async (approved: boolean) => {
    if (ui.status !== 'ready') return;
    setUi({ ...ui, responding: true });
    try {
      await browser.runtime.sendMessage({
        type: MessageType.RESOLVE_APPROVAL,
        payload: { approvalId, approved },
      });

      if (onComplete) {
        onComplete();
      } else {
        window.close();
      }
    } catch {
      setUi({ status: 'error', message: 'Failed to send response' });
    }
  };

  if (ui.status === 'loading') {
    return (
      <Box minH="100vh" bg="#0a0a0a" color="white" p={6}>
        <VStack spacing={4} justify="center" h="full" minH="400px">
          <Spinner size="xl" color="orange.400" />
          <Text color="gray.400">Loading approval request...</Text>
        </VStack>
      </Box>
    );
  }

  if (ui.status === 'error') {
    return (
      <Box minH="100vh" bg="#0a0a0a" color="white" p={6}>
        <VStack spacing={4} justify="center" h="full" minH="400px">
          <Text color="red.400">{ui.message}</Text>
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

  const { approval, responding, showRawTx, txParse } = ui;
  const parsingTx = txParse.status === 'parsing';
  const parsedTx = txParse.status === 'done' ? txParse.parsed : null;

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

                <Button
                  variant="ghost"
                  size="xs"
                  color="gray.500"
                  leftIcon={<ViewIcon />}
                  onClick={() => setUi({ ...ui, showRawTx: true })}
                  alignSelf="center"
                >
                  Show Raw Transaction
                </Button>
              </>
            ) : (
              <>
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
                    onClick={() => setUi({ ...ui, showRawTx: false })}
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
