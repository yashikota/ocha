import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { useMessages } from '../../hooks/useMessages';
import { selectedGroupAtom } from '../../atoms/groupsAtom';
import { syncingAtom } from '../../atoms/uiAtom';

export function ChatView() {
  const { t } = useTranslation();
  const [selectedGroup] = useAtom(selectedGroupAtom);
  const { messages, loading, syncMessages, updateAttachmentPath, toggleBookmark } = useMessages();
  const [syncing] = useAtom(syncingAtom);

  const handleSync = async () => {
    try {
      await syncMessages();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleAttachmentDownloaded = (attachmentId: number, localPath: string) => {
    // 添付ファイルのlocalPathを更新
    updateAttachmentPath(attachmentId, localPath);
  };

  if (!selectedGroup) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <div className="text-center">
          <div className="text-4xl mb-4">📬</div>
          <p className="text-text-sub">{t('chat.noSelection')}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-white">
      <ChatHeader group={selectedGroup} onSync={handleSync} syncing={syncing} />
      <MessageList
        messages={messages}
        loading={loading}
        onAttachmentDownloaded={handleAttachmentDownloaded}
        onBookmarkChange={(message) => toggleBookmark(message.id)}
      />
    </main>
  );
}
