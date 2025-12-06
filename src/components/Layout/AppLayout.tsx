import { useEffect } from 'react';
import { Sidebar } from '../Sidebar';
import { ChatView } from '../Chat';
import { SettingsModal } from '../Settings';
import { useMessages } from '../../hooks/useMessages';

export function AppLayout() {
  const { startWatching, syncMessages } = useMessages();

  useEffect(() => {
    // 初回同期
    syncMessages().catch(console.error);
    
    // IMAP監視を開始
    startWatching().catch(console.error);
  }, [syncMessages, startWatching]);

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      <Sidebar />
      <ChatView />
      <SettingsModal />
    </div>
  );
}

