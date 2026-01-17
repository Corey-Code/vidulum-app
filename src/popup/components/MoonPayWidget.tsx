import React, { useEffect, useRef, useState } from 'react';
import { Box, Spinner, Text, VStack } from '@chakra-ui/react';

// MoonPay Web SDK types
declare global {
  interface Window {
    MoonPayWebSdk?: {
      init: (config: MoonPayConfig) => MoonPayWidget;
    };
  }
}

interface MoonPayWidget {
  show: () => void;
  close: () => void;
}

interface MoonPayConfig {
  flow: 'buy' | 'sell';
  environment: 'sandbox' | 'production';
  variant: 'embedded' | 'overlay' | 'newTab';
  params: {
    apiKey: string;
    theme?: 'light' | 'dark';
    colorCode?: string;
    // Buy (on-ramp) params
    currencyCode?: string;
    walletAddress?: string;
    baseCurrencyAmount?: string;
    // Sell (off-ramp) params
    baseCurrencyCode?: string;
    defaultBaseCurrencyCode?: string;
    quoteCurrencyCode?: string;
    refundWalletAddress?: string;
  };
  containerNodeSelector?: string;
  handlers?: {
    onTransactionCompleted?: (props: { transactionId: string }) => void;
    onCloseOverlay?: () => void;
  };
}

interface MoonPayWidgetProps {
  flow: 'buy' | 'sell';
  cryptoCode: string;
  walletAddress: string;
  amount?: string;
  colorCode?: string;
}

// MoonPay API Key - Replace with your actual keys
const MOONPAY_API_KEY = import.meta.env.VITE_MOONPAY_API_KEY || '';
const MOONPAY_ENVIRONMENT: 'sandbox' | 'production' =
  import.meta.env.VITE_MOONPAY_ENV === 'production' ? 'production' : 'sandbox';

const MoonPayWidget: React.FC<MoonPayWidgetProps> = ({
  flow,
  cryptoCode,
  walletAddress,
  amount,
  colorCode = '#3182CE',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<MoonPayWidget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  // Load MoonPay SDK script
  useEffect(() => {
    if (window.MoonPayWebSdk) {
      setSdkLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://static.moonpay.com/web-sdk/v1/moonpay-web-sdk.min.js';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setSdkLoaded(true);
    };

    script.onerror = () => {
      setError('Failed to load MoonPay SDK');
      setLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      // Don't remove the script as it might be used by other components
    };
  }, []);

  // Initialize widget when SDK is loaded
  useEffect(() => {
    if (
      !sdkLoaded ||
      !window.MoonPayWebSdk ||
      !containerRef.current ||
      !cryptoCode ||
      !walletAddress
    ) {
      return;
    }

    // Generate a unique container ID
    const containerId = `moonpay-widget-${flow}-${Date.now()}`;
    containerRef.current.id = containerId;

    try {
      const config: MoonPayConfig = {
        flow,
        environment: MOONPAY_ENVIRONMENT,
        variant: 'embedded',
        containerNodeSelector: `#${containerId}`,
        params: {
          apiKey: MOONPAY_API_KEY,
          theme: 'dark',
          colorCode: colorCode.replace('#', ''),
        },
        handlers: {
          onTransactionCompleted: (props) => {
            console.log('MoonPay transaction completed:', props.transactionId);
          },
        },
      };

      // Add flow-specific parameters
      if (flow === 'buy') {
        config.params.currencyCode = cryptoCode;
        config.params.walletAddress = walletAddress;
        if (amount) {
          config.params.baseCurrencyAmount = amount;
        }
      } else {
        // Sell flow
        config.params.baseCurrencyCode = cryptoCode;
        config.params.defaultBaseCurrencyCode = cryptoCode;
        config.params.quoteCurrencyCode = 'usd';
        config.params.refundWalletAddress = walletAddress;
        if (amount) {
          config.params.baseCurrencyAmount = amount;
        }
      }

      widgetRef.current = window.MoonPayWebSdk.init(config);
      widgetRef.current.show();
      setLoading(false);
    } catch (err) {
      console.error('Failed to initialize MoonPay widget:', err);
      setError('Failed to initialize MoonPay widget');
      setLoading(false);
    }

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.close();
        } catch (e) {
          // Widget might already be closed
        }
      }
    };
  }, [sdkLoaded, flow, cryptoCode, walletAddress, amount, colorCode]);

  if (error) {
    return (
      <Box
        bg="#141414"
        borderRadius="xl"
        p={6}
        borderWidth="1px"
        borderColor="red.500"
        textAlign="center"
      >
        <VStack spacing={3}>
          <Text color="red.400" fontSize="sm">
            {error}
          </Text>
          <Text color="gray.500" fontSize="xs">
            Please try again or use the external link option.
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box position="relative" minH="500px" w="100%">
      {loading && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          textAlign="center"
        >
          <Spinner size="lg" color="cyan.400" />
          <Text color="gray.400" fontSize="sm" mt={3}>
            Loading MoonPay...
          </Text>
        </Box>
      )}
      <Box
        ref={containerRef}
        w="100%"
        minH="500px"
        borderRadius="xl"
        overflow="hidden"
        bg="#141414"
        sx={{
          '& iframe': {
            width: '100% !important',
            minHeight: '500px !important',
            border: 'none !important',
            borderRadius: '12px !important',
          },
        }}
      />
    </Box>
  );
};

export default MoonPayWidget;
