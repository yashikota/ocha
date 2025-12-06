import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../Sidebar';
import { ChatView } from '../Chat';
import { SettingsModal } from '../Settings';
import { GroupEditModal } from '../Group';
import { useMessages } from '../../hooks/useMessages';
import { useGroups } from '../../hooks/useGroups';

export function AppLayout() {
  const { t } = useTranslation();
  const { startWatching, syncMessages, fetchMessages } = useMessages();
  const { fetchGroups, fetchUnreadCounts, selectedGroupId } = useGroups();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 全データを同期・リフレッシュ
  const refreshAll = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      // メールを同期
      await syncMessages();
      // グループ一覧を再取得
      await fetchGroups();
      // 未読数を再取得
      await fetchUnreadCounts();
      // 選択中のグループがあればメッセージを再取得
      if (selectedGroupId !== null) {
        await fetchMessages(selectedGroupId);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncError(String(error));
    } finally {
      setIsSyncing(false);
    }
  }, [syncMessages, fetchGroups, fetchUnreadCounts, fetchMessages, selectedGroupId]);

  useEffect(() => {
    // 初回同期
    refreshAll();

    // IMAP監視を開始
    startWatching().catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      {/* 同期中の表示 */}
      {isSyncing && (
        <div className="fixed top-0 left-0 right-0 bg-primary text-white text-center py-1 text-sm z-50">
          <div className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {t('common.syncing')}
          </div>
        </div>
      )}

      {/* エラー表示 */}
      {syncError && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-1 text-sm z-50">
          {t('common.syncError')}: {syncError}
          <button
            onClick={() => setSyncError(null)}
            className="ml-2 underline"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      <Sidebar onRefresh={refreshAll} />
      <ChatView />
      <SettingsModal />
      <GroupEditModal />
    </div>
  );
}
