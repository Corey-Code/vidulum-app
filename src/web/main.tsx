import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, extendTheme, Box, Flex, HStack, Link, Icon } from '@chakra-ui/react';
import App from '@/popup/App';

// GitHub icon (simple SVG path)
const GitHubIcon: React.FC<{ boxSize?: string | number }> = ({ boxSize = 5 }) => (
  <Icon viewBox="0 0 24 24" boxSize={boxSize} fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </Icon>
);

// Twitter/X icon (old bird logo as requested)
const TwitterIcon: React.FC<{ boxSize?: string | number }> = ({ boxSize = 5 }) => (
  <Icon viewBox="0 0 24 24" boxSize={boxSize} fill="currentColor">
    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
  </Icon>
);

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  colors: {
    brand: {
      50: '#ffe5e5',
      100: '#ffb8b8',
      200: '#ff8a8a',
      300: '#ff5c5c',
      400: '#ff2e2e',
      500: '#e60000',
      600: '#b30000',
      700: '#800000',
      800: '#4d0000',
      900: '#1a0000',
    },
  },
});

/**
 * Web-specific wrapper that makes the app look like a native app embedded in a page.
 * Adds a subtle gradient background and frames the app in a card with rounded corners + shadow.
 */
const WebAppFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Flex
    minH="100vh"
    w="100%"
    direction="column"
    align="center"
    justify="flex-start"
    bg="linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)"
    pt={{ base: 0, md: 8 }}
    px={{ base: 0, md: 6 }}
    pb={{ base: 0, md: 6 }}
  >
    {/* Social Links */}
    <HStack spacing={4} mb={4} display={{ base: 'none', md: 'flex' }}>
      <Link
        href="https://github.com/corey-code/vidulum-app"
        isExternal
        color="white"
        opacity={0.7}
        _hover={{ opacity: 1 }}
        aria-label="GitHub"
      >
        <GitHubIcon boxSize={6} />
      </Link>
      <Link
        href="https://x.com/VidulumApp"
        isExternal
        color="white"
        opacity={0.7}
        _hover={{ opacity: 1 }}
        aria-label="Twitter"
      >
        <TwitterIcon boxSize={6} />
      </Link>
    </HStack>

    {/* App Card */}
    <Flex
      direction="column"
      w="100%"
      maxW="400px"
      minH={{ base: '100vh', md: '700px' }}
      maxH={{ base: '100vh', md: '85vh' }}
      overflow="auto"
      borderRadius={{ base: 0, md: 'xl' }}
      boxShadow={{ base: 'none', md: '0 25px 50px -12px rgba(0, 0, 0, 0.6)' }}
      border={{ base: 'none', md: '1px solid rgba(255, 255, 255, 0.1)' }}
      bg="#0a0a0a"
    >
      {children}
    </Flex>
  </Flex>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      <WebAppFrame>
        <App />
      </WebAppFrame>
    </ChakraProvider>
  </React.StrictMode>
);
