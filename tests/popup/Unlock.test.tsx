import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import Unlock from '@/popup/pages/Unlock';

const unlock = jest.fn();
const resetWallet = jest.fn();

jest.mock('@/store/walletStore', () => ({
  useWalletStore: () => ({
    unlock,
    resetWallet,
  }),
}));

function renderUnlock(onReset = jest.fn()) {
  return {
    onReset,
    ...render(
      <ChakraProvider>
        <Unlock onSuccess={jest.fn()} onReset={onReset} />
      </ChakraProvider>
    ),
  };
}

describe('Unlock reset', () => {
  beforeEach(() => {
    unlock.mockReset();
    resetWallet.mockReset();
  });

  it('asks before removing the saved wallet', () => {
    renderUnlock();

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Reset this wallet?');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('recovery phrase');
    expect(resetWallet).not.toHaveBeenCalled();
  });

  it('leaves the wallet in place when reset is cancelled', () => {
    renderUnlock();

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(resetWallet).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toHaveStyle({ opacity: '0' });
  });

  it('removes the saved wallet and continues to import', async () => {
    resetWallet.mockResolvedValue(undefined);
    const { onReset } = renderUnlock();

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset wallet' }));

    await waitFor(() => {
      expect(resetWallet).toHaveBeenCalledTimes(1);
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });
});
