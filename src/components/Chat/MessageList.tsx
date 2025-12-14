import { useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { targetMessageIdAtom } from '../../atoms/uiAtom';
import { MessageItem } from './MessageItem';
import type { Message } from '../../types';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  onAttachmentDownloaded?: (attachmentId: number, localPath: string) => void;
  onBookmarkChange?: (message: Message) => void;
}

export function MessageList({ messages, loading, onAttachmentDownloaded, onBookmarkChange }: MessageListProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [targetMessageId, setTargetMessageId] = useAtom(targetMessageIdAtom);

  // 新しいメッセージが来たら一番下にスクロール
  // 新しいメッセージが来たら一番下にスクロール（ジャンプ中はしない）
  useEffect(() => {
    if (listRef.current && !targetMessageId) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    // targetMessageIdの変更では発火させない（ジャンプ完了後にリセットされたときに一番下に戻るのを防ぐため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // 指定されたメッセージにジャンプ
  useEffect(() => {
    if (targetMessageId && !loading && messages.length > 0) {

      // メッセージがリストに含まれているか確認
      const isInList = messages.some(m => m.id === targetMessageId);
      if (!isInList) {
        // リストにない場合はスクロールできないので終了
        return;
      }

      let retries = 0;
      const maxRetries = 30; // 3秒間試行

      const scrollInterval = setInterval(() => {
        const el = document.getElementById(`message-${targetMessageId}`);
        const container = listRef.current;

        if (el && container) {
          clearInterval(scrollInterval);


          const elRect = el.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const relativeTop = elRect.top - containerRect.top;
          const currentScroll = container.scrollTop;

          // 画面中央に表示
          const targetScroll = currentScroll + relativeTop - (containerRect.height / 2) + (elRect.height / 2);

          container.scrollTo({ top: targetScroll, behavior: 'auto' });

          // ハイライト効果（より目立つ色に）
          el.classList.add('bg-amber-200', 'transition-colors', 'duration-1000');
          setTimeout(() => el.classList.remove('bg-amber-200'), 2000);

          // 少し待ってからTarget IDをクリア（即座にクリアするとオートスクロールが発火する可能性があるため）
          setTimeout(() => setTargetMessageId(null), 100);
        } else {
          retries++;
          if (retries >= maxRetries) {
            clearInterval(scrollInterval);
            setTargetMessageId(null);
          }
        }
      }, 100);

      return () => clearInterval(scrollInterval);
    }
  }, [targetMessageId, loading, messages, setTargetMessageId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-text-sub">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-text-sub">{t('chat.noMessages')}</p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex-1 overflow-y-auto">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onAttachmentDownloaded={onAttachmentDownloaded}
          onBookmarkChange={onBookmarkChange}
        />
      ))}
    </div>
  );
}
