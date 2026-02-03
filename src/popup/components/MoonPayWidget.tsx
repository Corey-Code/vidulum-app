import React, { useState, lazy, Suspense } from 'react';
import { Box, Spinner, Text, VStack, Button } from '@chakra-ui/react';

// Lazy load SDK widget only for web builds
const MoonPaySDKWidgetLazy = __IS_WEB_BUILD__ ? lazy(() => import('./MoonPaySDKWidget')) : null;

interface MoonPayWidgetProps {
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
 * MoonPay Widget - Universal Component
 *
 * - Web App: Uses @moonpay/moonpay-react SDK for embedded widget experience
 * - Extension: Not used (Deposit/Withdraw pages open MoonPay in new tab instead)
 *
 * Note: This component includes iframe fallback for extension builds, but is
 * currently only utilized by the web app. Extension builds use direct tab navigation
 * for MoonPay transactions to avoid iframe CSP restrictions.
 */
const MoonPayWidget: React.FC<MoonPayWidgetProps> = (props) => {
  const { flow, cryptoCode, walletAddress, amount, colorCode = '#3182CE', onClose } = props;

  // For web builds, use the SDK widget with lazy loading
  if (__IS_WEB_BUILD__ && MoonPaySDKWidgetLazy) {
    return (
      <Suspense
        fallback={
          <Box textAlign="center" py={8}>
            <Spinner size="lg" color={flow === 'buy' ? 'teal.400' : 'orange.400'} />
            <Text color="gray.400" fontSize="sm" mt={3}>
              Loading MoonPay SDK...
            </Text>
          </Box>
        }
      >
        <MoonPaySDKWidgetLazy
          flow={flow}
          cryptoCode={cryptoCode}
          walletAddress={walletAddress}
          amount={amount}
          colorCode={colorCode}
          onClose={onClose}
        />
      </Suspense>
    );
  }

  // Fallback: use iframe-based embedding (not currently used in extension builds)
  return <MoonPayIframeWidget {...props} />;
};

/**
 * Iframe-based MoonPay Widget for Extension
 */
const MoonPayIframeWidget: React.FC<MoonPayWidgetProps> = ({
  flow,
  cryptoCode = 'usdc_base',
  walletAddress = '',
  amount,
  colorCode = '#3182CE',
  onClose,
}) => {
  const [loading, setLoading] = useState(true);

  // Show maintenance message if no API key
  if (!MOONPAY_API_KEY) {
    const isBuy = flow === 'buy';
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
        {onClose && (
          <Button variant="outline" colorScheme="gray" onClick={onClose}>
            Go Back
          </Button>
        )}
      </VStack>
    );
  }

  // Build the MoonPay iframe URL
  const buildIframeUrl = (): string => {
    const baseUrl = flow === 'buy' ? 'https://buy.moonpay.com' : 'https://sell.moonpay.com';

    const params = new URLSearchParams({
      apiKey: MOONPAY_API_KEY,
      theme: 'dark',
      colorCode: colorCode.replace('#', ''),
      language: 'en',
    });

    if (flow === 'buy') {
      params.set('currencyCode', cryptoCode);
      params.set('walletAddress', walletAddress);
      if (amount) {
        params.set('baseCurrencyAmount', amount);
      }
    } else {
      // Sell flow
      params.set('baseCurrencyCode', cryptoCode);
      params.set('defaultBaseCurrencyCode', cryptoCode);
      params.set('quoteCurrencyCode', 'usd');
      params.set('refundWalletAddress', walletAddress);
      if (amount) {
        params.set('baseCurrencyAmount', amount);
      }
    }

    return `${baseUrl}?${params.toString()}`;
  };

  const handleIframeLoad = () => {
    setLoading(false);
  };

  return (
    <Box position="relative" minH="500px" w="100%">
      {loading && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          textAlign="center"
          zIndex={1}
        >
          <Spinner size="lg" color="cyan.400" />
          <Text color="gray.400" fontSize="sm" mt={3}>
            Loading MoonPay...
          </Text>
        </Box>
      )}
      <Box
        as="iframe"
        src={buildIframeUrl()}
        onLoad={handleIframeLoad}
        w="100%"
        h="500px"
        minH="500px"
        borderRadius="xl"
        border="none"
        bg="#141414"
        allow="accelerometer; autoplay; camera; gyroscope; payment; microphone"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
      />
    </Box>
  );
};

export default MoonPayWidget;
