import React, { useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import { useWalletStore } from '@/store/walletStore';
import Unlock from './pages/Unlock';
import Dashboard from './pages/Dashboard';
import CreateWallet from './pages/CreateWallet';
import ImportWallet from './pages/ImportWallet';
import Staking from './pages/Staking';
import Settings from './pages/Settings';
import Earn from './pages/Earn';
import Deposit from './pages/Deposit';
import Withdraw from './pages/Withdraw';

type View = 'loading' | 'create' | 'import' | 'unlock' | 'dashboard' | 'staking' | 'settings' | 'earn' | 'deposit' | 'withdraw';

const App: React.FC = () => {
  const [view, setView] = useState<View>('loading');
  const [isReady, setIsReady] = useState(false);
  const { isInitialized, isLocked, initialize } = useWalletStore();

  // Initialize on mount
  useEffect(() => {
    initialize().then(() => {
      setIsReady(true);
    });
  }, [initialize]);

  // Update view when state changes (after initialization)
  useEffect(() => {
    if (!isReady) return;

    if (!isInitialized) {
      setView('create');
    } else if (isLocked) {
      setView('unlock');
    } else {
      setView('dashboard');
    }
  }, [isReady, isInitialized, isLocked]);

  const handleCreateSuccess = () => {
    setView('dashboard');
  };

  const handleImportSuccess = () => {
    setView('dashboard');
  };

  const handleUnlockSuccess = () => {
    setView('dashboard');
  };

  const switchToImport = () => {
    setView('import');
  };

  const switchToCreate = () => {
    setView('create');
  };

  const navigateToStaking = () => {
    setView('staking');
  };

  const navigateToSettings = () => {
    setView('settings');
  };

  const navigateToEarn = () => {
    setView('earn');
  };

  const navigateToDeposit = () => {
    setView('deposit');
  };

  const navigateToWithdraw = () => {
    setView('withdraw');
  };

  const navigateToDashboard = () => {
    setView('dashboard');
  };

  return (
    <Box w="375px" h="600px" bg="#0a0a0a" color="white">
      {view === 'loading' && (
        <Box
          p={8}
          textAlign="center"
          h="full"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          Loading...
        </Box>
      )}
      {view === 'create' && (
        <CreateWallet onSuccess={handleCreateSuccess} onSwitchToImport={switchToImport} />
      )}
      {view === 'import' && (
        <ImportWallet onSuccess={handleImportSuccess} onSwitchToCreate={switchToCreate} />
      )}
      {view === 'unlock' && <Unlock onSuccess={handleUnlockSuccess} />}
      {view === 'dashboard' && (
        <Dashboard
          onNavigateToStaking={navigateToStaking}
          onNavigateToSettings={navigateToSettings}
          onNavigateToEarn={navigateToEarn}
          onNavigateToDeposit={navigateToDeposit}
          onNavigateToWithdraw={navigateToWithdraw}
        />
      )}
      {view === 'staking' && <Staking onBack={navigateToDashboard} />}
      {view === 'settings' && <Settings onBack={navigateToDashboard} />}
      {view === 'earn' && <Earn onBack={navigateToDashboard} />}
      {view === 'deposit' && <Deposit onBack={navigateToDashboard} />}
      {view === 'withdraw' && <Withdraw onBack={navigateToDashboard} />}
    </Box>
  );
};

export default App;
