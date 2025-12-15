import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { Message } from '../../types';
import { MessageItem } from './MessageItem';

interface BookmarkListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJumpToMessage: (groupId: number, messageId: number) => void;
}

export function BookmarkListModal({ isOpen, onClose, onJumpToMessage }: BookmarkListModalProps) {
  const { t } = useTranslation();
  const [bookmarks, setBookmarks] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadBookmarks();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadBookmarks = async () => {
    setLoading(true);
    try {
      const msgs = await invoke<Message[]>('get_bookmarked_messages');
      setBookmarks(msgs);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBookmark = async (message: Message) => {
    try {
      await invoke('toggle_message_bookmark', { messageId: message.id });
      // リストから削除
      setBookmarks(prev => prev.filter(m => m.id !== message.id));
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>📌</span>
            {t('bookmark.title', 'ブックマーク')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <span className="text-xl">✖️</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center text-text-sub py-12">
              {t('bookmark.empty', 'ブックマークされたメッセージはありません')}
            </div>
          ) : (
            <div className="space-y-4">
              {bookmarks.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow relative group"
                  onClick={(e) => {
                    // リンクやボタンのクリック時はジャンプしない
                    if ((e.target as HTMLElement).closest('button, a')) return;

                    if (msg.groupId !== undefined && msg.groupId !== null) {
                      onJumpToMessage(msg.groupId, msg.id);
                      onClose();
                    }
                  }}
                >
                  <div className="bg-gray-50 px-3 py-1 text-xs text-text-sub flex justify-between items-center border-b border-gray-100">
                    <span>{new Date(msg.receivedAt).toLocaleString()}</span>
                    <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('bookmark.jump', '移動')}
                    </span>
                  </div>
                  <MessageItem
                    message={msg}
                    onBookmarkChange={() => handleRemoveBookmark(msg)}
                  />
                  {/* ホバー時のオーバーレイヒント（オプション） */}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
