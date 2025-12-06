import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageItem } from './MessageItem';
import type { Message } from '../../types';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  onAttachmentClick?: (attachmentId: number) => void;
}

export function MessageList({ messages, loading, onAttachmentClick }: MessageListProps) {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);

  // 新しいメッセージが来たら一番下にスクロール
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  // 前のメッセージの本文を集める（引用検出用）
  const previousBodies = messages.map((_, index) =>
    messages.slice(0, index).map(m => m.bodyText || '')
  );

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
      <div className="divide-y divide-border">
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            previousBodies={previousBodies[index]}
            onAttachmentClick={onAttachmentClick}
          />
        ))}
      </div>
    </div>
  );
}
