import React, { useState } from 'react';
import { Box, Spinner, Text } from '@chakra-ui/react';

interface MoonPayWidgetProps {
  flow: 'buy' | 'sell';
  cryptoCode: string;
  walletAddress: string;
  amount?: string;
  colorCode?: string;
}

// MoonPay API Key
const MOONPAY_API_KEY =
  import.meta.env.VITE_MOONPAY_API_KEY || 'pk_test_pKULLlqQbOAEd7usXz7yUiVCc8yNBNGY';

/**
 * MoonPay Widget using iframe embedding
 * 
 * Note: Chrome extension Manifest V3 prohibits loading remote scripts,
 * so we use iframe-based embedding instead of the MoonPay Web SDK.
 */
const MoonPayWidget: React.FC<MoonPayWidgetProps> = ({
  flow,
  cryptoCode,
  walletAddress,
  amount,
  colorCode = '#3182CE',
}) => {
  const [loading, setLoading] = useState(true);

  // Build the MoonPay iframe URL
  const buildIframeUrl = (): string => {
    const baseUrl = flow === 'buy' 
      ? 'https://buy.moonpay.com' 
      : 'https://sell.moonpay.com';
    
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
