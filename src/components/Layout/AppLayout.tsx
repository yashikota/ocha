import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../Sidebar';
import { ChatView } from '../Chat';
import { SettingsModal } from '../Settings';
import { GroupEditModal } from '../Group';
import { ConfirmDialog } from '../UI';
import { useMessages } from '../../hooks/useMessages';
import { useGroups } from '../../hooks/useGroups';
import { useAuth } from '../../hooks/useAuth';

import { useAtom } from 'jotai';
import { settingsAtom } from '../../atoms/settingsAtom';
import { onAction } from '@tauri-apps/plugin-notification';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { syncingAtom } from '../../atoms/uiAtom';

// ...

export function AppLayout() {
  const { t } = useTranslation();
  const { startWatching, syncMessages, fetchMessages } = useMessages();
  const { fetchGroups, fetchUnreadCounts, selectedGroupId, selectGroup } = useGroups();
  const { logout } = useAuth();
  const [settings] = useAtom(settingsAtom);
  const [isSyncing] = useAtom(syncingAtom);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);

  // 全データを同期・リフレッシュ
  const refreshAll = useCallback(async () => {
    setSyncError(null);
    try {
      // メールを同期 (syncingAtomはここで管理される)
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
      const errorMsg = String(error);
      if (errorMsg.includes('AUTH_REQUIRED')) {
        setIsAuthError(true);
      } else {
        setSyncError(errorMsg);
      }
    }
  }, [syncMessages, fetchGroups, fetchUnreadCounts, fetchMessages, selectedGroupId]);

  useEffect(() => {
    // 初回同期
    refreshAll();

    // IMAP監視を開始
    startWatching().catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ポーリング（定期同期）
  useEffect(() => {
    if (settings.syncIntervalMinutes <= 0) return;

    const intervalId = setInterval(() => {
      if (!isSyncing) {
        console.log('Polling: Executing periodic sync...');
        refreshAll();
      }
    }, settings.syncIntervalMinutes * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [settings.syncIntervalMinutes, isSyncing, refreshAll]);

  // 通知クリックのハンドリング (Rustからのイベント経由)
  useEffect(() => {
    let unlisten: () => void;

    const setupListener = async () => {
      unlisten = await listen<{ groupId: number }>('notification_clicked', (event) => {
        console.log('Notification clicked (event):', event);
        const win = getCurrentWindow();
        win.show();
        win.setFocus();

        if (event.payload.groupId) {
          console.log('Navigating to group (event):', event.payload.groupId);
          selectGroup(event.payload.groupId);
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [selectGroup]);

  // 通知クリックのハンドリング (プラグイン直接) - フォールバック
  useEffect(() => {
    let unlisten: Awaited<ReturnType<typeof onAction>> | undefined;

    const setupListener = async () => {
      unlisten = await onAction((notification) => {
        console.log('Notification clicked (plugin):', notification);
        const win = getCurrentWindow();
        win.show();
        win.setFocus();

        // ペイロードまたはactionTypeIdからgroupIdを取得して遷移
        // @ts-ignore
        const data = notification.data || notification.payload;

        let groupId: number | null = null;

        if (data && data.groupId) {
          groupId = parseInt(data.groupId, 10);
        } else if (notification.actionTypeId && notification.actionTypeId.startsWith('group_')) {
          groupId = parseInt(notification.actionTypeId.replace('group_', ''), 10);
        }

        if (groupId !== null && !isNaN(groupId)) {
          console.log('Navigating to group (plugin):', groupId);
          selectGroup(groupId);
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        // PluginListenerの型定義と実体の不整合を回避するため、unknown経由でチェック
        const listener = unlisten as unknown;
        if (typeof listener === 'function') {
          (listener as () => void)();
        }
      }
    };
  }, [selectGroup]);

  const handleAuthErrorConfirm = async () => {
    setIsAuthError(false);
    await logout();
  };

  return (
    <div className="h-screen flex bg-bg overflow-hidden">
      {/* 同期中の表示 */}


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

      <ConfirmDialog
        isOpen={isAuthError}
        title={t('auth.errors.sessionExpired.title')}
        message={t('auth.errors.sessionExpired.message')}
        confirmLabel="OK"
        onConfirm={handleAuthErrorConfirm}
        onCancel={() => { }} // キャンセル不可（強制ログアウト）
        isDestructive={false}
      />
    </div>
  );
}
