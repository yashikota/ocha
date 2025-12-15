import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { Message } from '../../types';
import { MessageItem } from './MessageItem';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId?: number; // If provided, search is local to this group
  onJumpToMessage: (groupId: number, messageId: number) => void;
}

import { Modal } from '../UI';

export function SearchModal({ isOpen, onClose, groupId, onJumpToMessage }: SearchModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state on open
      setResults([]);
      setQuery('');
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, groupId]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const msgs = await invoke<Message[]>('search_messages', {
        query: query.trim(),
        groupId: groupId || null
      });
      setResults(msgs);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl max-h-[80vh]">
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>🔍</span>
              {groupId
                ? t('search.localTitle', 'グループ内検索')
                : t('search.globalTitle', '全体検索')
              }
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
            >
              <span className="text-xl">✖️</span>
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder', '検索キーワードを入力...')}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-bg-sidebar-input"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✖️
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
            >
              {loading ? t('common.loading', '検索中...') : t('search.action', '検索')}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : results.length === 0 && query ? (
            <div className="text-center text-text-sub py-12">
              {t('search.noResults', '一致するメッセージは見つかりませんでした')}
            </div>
          ) : !query && results.length === 0 ? (
            <div className="text-center text-text-sub py-12">
              {t('search.start', 'キーワードを入力して検索してください')}
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-white rounded border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow relative group"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, a')) return;
                    if (msg.groupId !== undefined && msg.groupId !== null) {
                      onJumpToMessage(msg.groupId, msg.id);
                      onClose();
                    }
                  }}
                >
                  <div className="bg-gray-50 px-3 py-1 text-xs text-text-sub flex justify-between items-center border-b border-gray-100">
                    <span className="flex items-center gap-2">
                      {/* Show group name if global search logic existed */}
                      {new Date(msg.receivedAt).toLocaleString()}
                    </span>
                    <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      {t('bookmark.jump', '移動')}
                    </span>
                  </div>
                  <MessageItem
                    message={msg}
                    onBookmarkChange={() => { }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
