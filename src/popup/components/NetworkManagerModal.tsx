import React, { useEffect, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Text,
  Switch,
  Box,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Badge,
  Spinner,
  Checkbox,
  SimpleGrid,
  Icon,
  Button,
  ButtonGroup,
} from '@chakra-ui/react';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { useNetworkStore } from '@/store/networkStore';
import { fetchChainAssets, RegistryAsset } from '@/lib/assets/chainRegistry';
import { NetworkConfig } from '@/lib/networks';

interface NetworkManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNetworkChange?: () => void;
}

interface NetworkItemProps {
  network: NetworkConfig;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const NetworkItem: React.FC<NetworkItemProps> = ({ network, isEnabled, onToggle }) => {
  const [assets, setAssets] = useState<RegistryAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [expandedForAssets, setExpandedForAssets] = useState(false);
  const { isAssetEnabled, setAssetEnabled, setEnabledAssets } = useNetworkStore();

  // Load assets when expanded
  useEffect(() => {
    if (expandedForAssets && isEnabled && assets.length === 0) {
      setLoadingAssets(true);
      fetchChainAssets(network.id)
        .then((a) => setAssets(a))
        .finally(() => setLoadingAssets(false));
    }
  }, [expandedForAssets, isEnabled, network.id, assets.length]);

  const hasAssets = network.type === 'cosmos'; // Cosmos chains have multiple assets

  return (
    <Box
      bg="#1a1a1a"
      borderRadius="lg"
      overflow="hidden"
      borderWidth="1px"
      borderColor={isEnabled ? 'cyan.600' : '#2a2a2a'}
      transition="all 0.2s"
    >
      <HStack
        p={3}
        justify="space-between"
        cursor={hasAssets && isEnabled ? 'pointer' : 'default'}
        onClick={() => {
          if (hasAssets && isEnabled) {
            setExpandedForAssets(!expandedForAssets);
          }
        }}
        _hover={hasAssets && isEnabled ? { bg: '#222' } : undefined}
      >
        <VStack align="start" spacing={0} flex={1}>
          <HStack spacing={2}>
            <Text fontWeight="medium" fontSize="sm">
              {network.name}
            </Text>
            <Badge
              size="sm"
              colorScheme={
                network.type === 'cosmos'
                  ? 'purple'
                  : network.type === 'bitcoin'
                    ? 'orange'
                    : 'blue'
              }
              fontSize="2xs"
            >
              {network.type.toUpperCase()}
            </Badge>
          </HStack>
          <Text fontSize="xs" color="gray.500">
            {network.symbol}
          </Text>
        </VStack>

        <HStack spacing={3}>
          {hasAssets && isEnabled && (
            <Icon
              as={ChevronDownIcon}
              transform={expandedForAssets ? 'rotate(180deg)' : 'rotate(0deg)'}
              transition="transform 0.2s"
              color="gray.500"
              boxSize={4}
            />
          )}
          <Switch
            size="sm"
            colorScheme="cyan"
            isChecked={isEnabled}
            onChange={(e) => {
              e.stopPropagation();
              onToggle(e.target.checked);
            }}
          />
        </HStack>
      </HStack>

      {/* Asset management panel */}
      {hasAssets && isEnabled && expandedForAssets && (
        <Box
          borderTopWidth="1px"
          borderColor="#2a2a2a"
          p={3}
          bg="#141414"
          maxH="250px"
          overflowY="auto"
        >
          {loadingAssets ? (
            <HStack justify="center" py={2}>
              <Spinner size="sm" color="cyan.400" />
              <Text fontSize="xs" color="gray.500">
                Loading assets...
              </Text>
            </HStack>
          ) : assets.length > 0 ? (
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between" align="center">
                <Text fontSize="xs" color="gray.400" fontWeight="medium">
                  Assets ({assets.filter((a) => isAssetEnabled(network.id, a.denom)).length}/
                  {assets.length})
                </Text>
                <ButtonGroup size="xs" spacing={1}>
                  <Button
                    variant="ghost"
                    colorScheme="cyan"
                    fontSize="2xs"
                    h="20px"
                    px={2}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEnabledAssets(
                        network.id,
                        assets.map((asset) => asset.denom)
                      );
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    colorScheme="gray"
                    fontSize="2xs"
                    h="20px"
                    px={2}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEnabledAssets(network.id, []);
                    }}
                  >
                    Clear
                  </Button>
                </ButtonGroup>
              </HStack>
              <SimpleGrid columns={2} spacing={2}>
                {[...assets]
                  .sort((a, b) => a.symbol.localeCompare(b.symbol))
                  .map((asset) => (
                    <Checkbox
                      key={asset.denom}
                      size="sm"
                      colorScheme="cyan"
                      isChecked={isAssetEnabled(network.id, asset.denom)}
                      onChange={(e) => setAssetEnabled(network.id, asset.denom, e.target.checked)}
                    >
                      <Text fontSize="xs">{asset.symbol}</Text>
                    </Checkbox>
                  ))}
              </SimpleGrid>
            </VStack>
          ) : (
            <Text fontSize="xs" color="gray.500" textAlign="center">
              No assets configured
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

const NetworkManagerModal: React.FC<NetworkManagerModalProps> = ({
  isOpen,
  onClose,
  onNetworkChange,
}) => {
  const { loadPreferences, isLoaded, isNetworkEnabled, setNetworkEnabled, getNetworksByType } =
    useNetworkStore();

  // Load preferences on mount
  useEffect(() => {
    if (isOpen && !isLoaded) {
      loadPreferences();
    }
  }, [isOpen, isLoaded, loadPreferences]);

  const cosmosNetworks = getNetworksByType('cosmos');
  const bitcoinNetworks = getNetworksByType('bitcoin');
  const evmNetworks = getNetworksByType('evm');

  const handleToggle = async (networkId: string, enabled: boolean) => {
    await setNetworkEnabled(networkId, enabled);
    onNetworkChange?.();
  };

  const getEnabledCount = (networks: NetworkConfig[]) => {
    return networks.filter((n) => isNetworkEnabled(n.id)).length;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent bg="#0a0a0a" color="white" maxH="80vh">
        <ModalHeader fontSize="lg" pb={2}>
          Manage Networks
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody pb={6}>
          <Text fontSize="sm" color="gray.400" mb={4}>
            Enable or disable networks and manage visible assets.
          </Text>

          <Tabs variant="soft-rounded" colorScheme="cyan" size="sm">
            <TabList mb={4} bg="#141414" p={1} borderRadius="full">
              <Tab
                fontSize="xs"
                px={3}
                borderRadius="full"
                _selected={{ bg: 'purple.600', color: 'white' }}
              >
                Cosmos ({getEnabledCount(cosmosNetworks)}/{cosmosNetworks.length})
              </Tab>
              <Tab
                fontSize="xs"
                px={3}
                borderRadius="full"
                _selected={{ bg: 'orange.600', color: 'white' }}
              >
                UTXO ({getEnabledCount(bitcoinNetworks)}/{bitcoinNetworks.length})
              </Tab>
              <Tab
                fontSize="xs"
                px={3}
                borderRadius="full"
                _selected={{ bg: 'blue.600', color: 'white' }}
              >
                EVM ({getEnabledCount(evmNetworks)}/{evmNetworks.length})
              </Tab>
            </TabList>

            <TabPanels>
              {/* Cosmos Networks */}
              <TabPanel p={0}>
                <VStack spacing={2} align="stretch">
                  {cosmosNetworks.length === 0 ? (
                    <Text color="gray.500" textAlign="center" py={4}>
                      No Cosmos networks available
                    </Text>
                  ) : (
                    cosmosNetworks.map((network) => (
                      <NetworkItem
                        key={network.id}
                        network={network}
                        isEnabled={isNetworkEnabled(network.id)}
                        onToggle={(enabled) => handleToggle(network.id, enabled)}
                      />
                    ))
                  )}
                </VStack>
              </TabPanel>

              {/* Bitcoin/UTXO Networks */}
              <TabPanel p={0}>
                <VStack spacing={2} align="stretch">
                  {bitcoinNetworks.length === 0 ? (
                    <Text color="gray.500" textAlign="center" py={4}>
                      No UTXO networks available
                    </Text>
                  ) : (
                    bitcoinNetworks.map((network) => (
                      <NetworkItem
                        key={network.id}
                        network={network}
                        isEnabled={isNetworkEnabled(network.id)}
                        onToggle={(enabled) => handleToggle(network.id, enabled)}
                      />
                    ))
                  )}
                </VStack>
              </TabPanel>

              {/* EVM Networks */}
              <TabPanel p={0}>
                <VStack spacing={2} align="stretch">
                  {evmNetworks.length === 0 ? (
                    <Text color="gray.500" textAlign="center" py={4}>
                      No EVM networks available
                    </Text>
                  ) : (
                    evmNetworks.map((network) => (
                      <NetworkItem
                        key={network.id}
                        network={network}
                        isEnabled={isNetworkEnabled(network.id)}
                        onToggle={(enabled) => handleToggle(network.id, enabled)}
                      />
                    ))
                  )}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default NetworkManagerModal;
