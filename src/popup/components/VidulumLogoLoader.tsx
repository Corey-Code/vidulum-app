import React from 'react';
import { Box, Text } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

/**
 * Animated "Vidulum App" text loader.
 * Shows text immediately with continuous glow pulse.
 */

// Keyframes for continuous glow pulse
const glow = keyframes`
  0%, 100% {
    opacity: 1;
    filter: drop-shadow(0 0 8px rgba(102, 126, 234, 0.6));
  }
  50% {
    opacity: 0.7;
    filter: drop-shadow(0 0 16px rgba(102, 126, 234, 0.9));
  }
`;

const VidulumLogoLoader: React.FC = () => {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center">
      <Text
        fontSize="5xl"
        fontWeight="bold"
        bgGradient="linear(to-r, #4a5568, #667eea, #5a67d8, #4a5568)"
        bgClip="text"
        sx={{
          animation: `${glow} 2s ease-in-out infinite`,
        }}
      >
        Vidulum App
      </Text>
    </Box>
  );
};

export default VidulumLogoLoader;
