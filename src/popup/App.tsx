import React, { useEffect, useState } from 'react';
import { Box } from '@chakra-ui/react';
import browser from 'webextension-polyfill';
import { useWalletStore } from '@/store/walletStore';
import { MessageType } from '@/types/messages';
import Unlock from './pages/Unlock';
import Dashboard from './pages/Dashboard';
import CreateWallet from './pages/CreateWallet';
import ImportWallet from './pages/ImportWallet';
import Staking from './pages/Staking';
import Settings from './pages/Settings';
import Earn from './pages/Earn';
import Deposit from './pages/Deposit';
import Withdraw from './pages/Withdraw';
import Approval from './pages/Approval';

type View =
  | 'loading'
  | 'create'
  | 'import'
  | 'unlock'
  | 'dashboard'
  | 'staking'
  | 'settings'
  | 'earn'
  | 'deposit'
  | 'withdraw'
  | 'approval';

// Check for approval ID in URL query params
function getApprovalIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('approval');
}

// Check for pending approvals from background
async function checkPendingApprovals(): Promise<string | null> {
  try {
    const response = await browser.runtime.sendMessage({
      type: MessageType.GET_APPROVAL,
      payload: {},
    });
    if (response?.success && response.data?.id) {
      return response.data.id;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

const App: React.FC = () => {
  const [view, setView] = useState<View>('loading');
  const [isReady, setIsReady] = useState(false);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const { isInitialized, isLocked, initialize } = useWalletStore();

  // Check for approval request on mount
  useEffect(() => {
    const initApp = async () => {
      // Always initialize wallet state first
      await initialize();

      // First check URL params (for popup window approach)
      const approvalIdFromUrl = getApprovalIdFromUrl();
      if (approvalIdFromUrl) {
        setApprovalId(approvalIdFromUrl);
        setView('approval');
        setIsReady(true);
        return;
      }

      // Check for pending approvals from background storage
      const pendingApprovalId = await checkPendingApprovals();
      if (pendingApprovalId) {
        setApprovalId(pendingApprovalId);
        setView('approval');
        setIsReady(true);
        return;
      }

      // Normal flow
      setIsReady(true);
    };

    initApp();
  }, [initialize]);

  // Update view when state changes (after initialization)
  useEffect(() => {
    if (!isReady) return;
    // Don't change view if we're showing an approval
    if (approvalId) return;

    if (!isInitialized) {
      setView('create');
    } else if (isLocked) {
      setView('unlock');
    } else {
      setView('dashboard');
    }
  }, [isReady, isInitialized, isLocked, approvalId]);

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

  const handleApprovalComplete = async () => {
    setApprovalId(null);

    // Re-check if there are more pending approvals
    const nextApprovalId = await checkPendingApprovals();
    if (nextApprovalId) {
      setApprovalId(nextApprovalId);
      setView('approval');
      return;
    }

    // No more approvals - determine correct view based on wallet state
    if (!isInitialized) {
      setView('create');
    } else if (isLocked) {
      setView('unlock');
    } else {
      setView('dashboard');
    }
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
      {view === 'approval' && approvalId && (
        <Approval approvalId={approvalId} onComplete={handleApprovalComplete} />
      )}
    </Box>
  );
};

export default App;
