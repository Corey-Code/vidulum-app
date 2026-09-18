import React from 'react';
import { Box, Text, VStack } from '@chakra-ui/react';
import {
  formatCatalogReviewMonth,
  getSupportedNetworkFamilyLabel,
  getSupportedNetworkFamilySummary,
  getSupportedNetworksByFamily,
  SUPPORTED_NETWORK_CATALOG_REVIEWED_AT,
  type SupportedNetworkFamily,
} from '@/lib/networks/supported-catalog';

const FAMILY_ORDER: SupportedNetworkFamily[] = ['cosmos', 'utxo', 'evm', 'svm'];

const SupportedNetworksPanel: React.FC = () => {
  const byFamily = getSupportedNetworksByFamily();
  const reviewedMonth = formatCatalogReviewMonth(SUPPORTED_NETWORK_CATALOG_REVIEWED_AT);

  return (
    <Box>
      <Text fontSize="md" color="white" mb={1} fontWeight="semibold">
        Supported networks
      </Text>
      <Text fontSize="sm" color="gray.400" mb={4} lineHeight="tall">
        This wallet can hold your assets on the network types below. Reviewed {reviewedMonth}.
      </Text>

      <VStack spacing={3} align="stretch">
        {FAMILY_ORDER.map((family) => {
          const networks = byFamily[family];
          const names = networks.map((network) => network.name).join(', ');

          return (
            <Box
              key={family}
              p={3}
              bg="#141414"
              borderRadius="lg"
              border="1px"
              borderColor="#2a2a2a"
            >
              <Text fontSize="sm" color="white" fontWeight="medium">
                {getSupportedNetworkFamilyLabel(family)}
              </Text>
              <Text fontSize="sm" color="gray.400" mt={1} lineHeight="tall">
                {getSupportedNetworkFamilySummary(family)}
              </Text>
              <Text fontSize="sm" color="gray.500" mt={2} lineHeight="tall">
                {names}
              </Text>
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
};

export default SupportedNetworksPanel;
