import React, { useState } from 'react';
import { Box, Button, Input, Text, VStack } from '@chakra-ui/react';
import type { VdlSwapMode } from '@/lib/swap/vdlSwapConfig';
import { demoTxHash } from '@/lib/demo/session';

interface Props {
  mode: VdlSwapMode;
}

const DemoSwap: React.FC<Props> = ({ mode }) => {
  const [amount, setAmount] = useState('1');
  const [done, setDone] = useState<{ hash: string; paid: string; received: string } | null>(null);

  const pay = mode === 'buy' ? 'BZE' : 'VDL';
  const receive = mode === 'buy' ? 'VDL' : 'BZE';
  const quoted = (Number(amount) * (mode === 'buy' ? 0.89 : 1.19)).toFixed(4);

  const finish = () => {
    if (!amount || Number(amount) <= 0) return;
    setDone({
      hash: demoTxHash(),
      paid: `${amount} ${pay}`,
      received: `${quoted} ${receive}`,
    });
  };

  if (done) {
    return (
      <VStack align="stretch" spacing={4} p={4} bg="#141414" borderRadius="xl">
        <Text fontWeight="semibold">Demo swap complete</Text>
        <Text color="gray.300" fontSize="sm">
          Paid {done.paid}. Received {done.received}. Nothing was sent.
        </Text>
        <Text fontFamily="mono" fontSize="xs" color="gray.500" wordBreak="break-all">
          {done.hash}
        </Text>
        <Button variant="ghost" onClick={() => setDone(null)}>
          Go again
        </Button>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={4} p={4}>
      <Box bg="#141414" borderRadius="xl" p={4}>
        <Text fontSize="sm" color="gray.400" mb={2}>
          Pay {pay}
        </Text>
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          bg="#0a0a0a"
          border="none"
          borderRadius="xl"
          size="lg"
        />
      </Box>
      <Box bg="#141414" borderRadius="xl" p={4}>
        <Text fontSize="sm" color="gray.400" mb={1}>
          Receive {receive}
        </Text>
        <Text fontSize="2xl">{quoted}</Text>
        <Text fontSize="xs" color="gray.500">
          on BeeZee. Demo quote only.
        </Text>
      </Box>
      <Button bg="cyan.500" color="white" _hover={{ bg: 'cyan.600' }} borderRadius="xl" onClick={finish}>
        Swap
      </Button>
    </VStack>
  );
};

export default DemoSwap;
