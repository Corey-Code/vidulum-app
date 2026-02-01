import React, { useState } from 'react';
import { Box, Text, Button, VStack, Icon } from '@chakra-ui/react';
import { MoonPayProvider, MoonPayBuyWidget, MoonPaySellWidget } from '@moonpay/moonpay-react';

interface MoonPaySDKWidgetProps {
  flow: 'buy' | 'sell';
  cryptoCode?: string;
  walletAddress?: string;
  amount?: string;
  colorCode?: string;
  onClose?: () => void;
}

// MoonPay API Key - only from environment variable
const MOONPAY_API_KEY = import.meta.env.VITE_MOONPAY_API_KEY || '';

/**
 * MoonPay SDK Widget for Web App
 *
 * Uses the official @moonpay/moonpay-react SDK with overlay variant.
 * This opens as a popup/modal over the app.
 * This component is ONLY used in the web app build, NOT in the extension.
 */
const MoonPaySDKWidget: React.FC<MoonPaySDKWidgetProps> = ({
  flow,
  cryptoCode = 'usdc_base',
  walletAddress,
  colorCode = '#3182CE',
  onClose,
}) => {
  const [showWidget, setShowWidget] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);

  const handleWidgetClose = () => {
    setShowWidget(false);
    onClose?.();
  };

  const handleOpenWidget = () => {
    if (!MOONPAY_API_KEY) {
      setShowMaintenance(true);
      return;
    }
    setShowWidget(true);
  };

  const isBuy = flow === 'buy';
  const colorScheme = isBuy ? 'teal' : 'orange';

  // Show maintenance message if no API key
  if (showMaintenance) {
    return (
      <VStack spacing={4} align="stretch">
        <Box
          bg="#141414"
          borderRadius="xl"
          p={6}
          borderWidth="1px"
          borderColor="#2a2a2a"
          textAlign="center"
        >
          <Text fontSize="2xl" mb={3}>
            🔧
          </Text>
          <Text fontSize="lg" fontWeight="bold" color="white" mb={2}>
            Under Maintenance
          </Text>
          <Text fontSize="sm" color="gray.400" mb={4}>
            {isBuy ? 'Buy' : 'Sell'} functionality is temporarily unavailable. Please check back
            later.
          </Text>
          <Text fontSize="xs" color="gray.500">
            We apologize for any inconvenience.
          </Text>
        </Box>
        <Button variant="outline" colorScheme="gray" onClick={() => setShowMaintenance(false)}>
          Go Back
        </Button>
      </VStack>
    );
  }

  // Common configuration - using overlay variant for popup experience
  const commonConfig = {
    apiKey: MOONPAY_API_KEY,
    variant: 'overlay' as const,
    colorCode: colorCode.replace('#', ''),
    language: 'en',
  };

  // Buy widget configuration
  const buyConfig = {
    ...commonConfig,
    defaultCurrencyCode: cryptoCode,
    walletAddress: walletAddress || undefined,
    baseCurrencyCode: 'usd',
  };

  // Sell widget configuration
  const sellConfig = {
    ...commonConfig,
    defaultBaseCurrencyCode: cryptoCode,
    refundWalletAddress: walletAddress || undefined,
    quoteCurrencyCode: 'usd',
  };

  return (
    <MoonPayProvider apiKey={MOONPAY_API_KEY || 'placeholder'}>
      <VStack spacing={4} align="stretch">
        <Box bg="#141414" borderRadius="xl" p={4} borderWidth="1px" borderColor="#2a2a2a">
          <Text fontSize="sm" color="gray.300" mb={2}>
            {isBuy
              ? 'Buy crypto with credit card, debit card, or bank transfer.'
              : 'Sell crypto and receive funds to your bank account.'}
          </Text>
          <Text fontSize="xs" color="gray.500">
            Powered by MoonPay • Secure & Fast
          </Text>
        </Box>

        <Button colorScheme={colorScheme} size="lg" onClick={handleOpenWidget}>
          {isBuy ? 'Buy Crypto' : 'Sell Crypto'}
        </Button>

        {/* Render the widget (it shows as overlay when visible) */}
        {showWidget && MOONPAY_API_KEY && (
          <>
            {isBuy ? (
              <MoonPayBuyWidget
                {...buyConfig}
                visible={showWidget}
                onCloseOverlay={handleWidgetClose}
              />
            ) : (
              <MoonPaySellWidget
                {...sellConfig}
                visible={showWidget}
                onCloseOverlay={handleWidgetClose}
              />
            )}
          </>
        )}
      </VStack>
    </MoonPayProvider>
  );
};

export default MoonPaySDKWidget;
