import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCard } from './AttachmentCard';
import type { Message } from '../../types';

interface MessageItemProps {
  message: Message;
  onAttachmentClick?: (attachmentId: number) => void;
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isYesterday) {
    return `昨日 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 省略するかどうかの閾値（文字数）
const MAX_LENGTH = 500;

export function MessageItem({ message, onAttachmentClick }: MessageItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isSent = message.isSent;

  // 表示名の決定
  const displayName = isSent
    ? (message.toEmail || '宛先不明')
    : (message.fromName || message.fromEmail);
  const initial = displayName.charAt(0).toUpperCase();

  // 本文を取得
  const bodyContent = message.bodyText || '';
  const needsTruncation = bodyContent.length > MAX_LENGTH;
  const displayContent = isExpanded || !needsTruncation
    ? bodyContent
    : bodyContent.slice(0, MAX_LENGTH) + '...';

  // 展開/折りたたみボタン
  const ExpandButton = () => needsTruncation && (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="text-xs text-primary hover:text-primary-hover mt-1 underline"
    >
      {isExpanded ? t('chat.collapse') : t('chat.expand')}
    </button>
  );

  // 送信メッセージは右側、受信メッセージは左側
  if (isSent) {
    return (
      <article className="flex gap-3 p-4 hover:bg-hover transition-colors justify-end overflow-hidden">
        <div className="flex flex-col items-end min-w-0" style={{ maxWidth: '70%' }}>
          {/* ヘッダー */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs text-text-sub flex-shrink-0">{formatTime(message.receivedAt)}</span>
            <span className="font-semibold text-text">自分</span>
          </div>

          {/* 件名 */}
          {message.subject && (
            <div className="text-sm font-medium text-text mb-1 text-right truncate w-full">
              {message.subject || t('chat.noSubject')}
            </div>
          )}

          {/* 本文 - 送信メッセージの吹き出し */}
          <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-full">
            <div
              className="text-sm break-all"
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere'
              }}
            >
              {displayContent}
            </div>
            {needsTruncation && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-white/80 hover:text-white mt-1 underline"
              >
                {isExpanded ? t('chat.collapse') : t('chat.expand')}
              </button>
            )}
          </div>

          {/* 添付ファイル */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 justify-end">
              {message.attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onClick={() => onAttachmentClick?.(attachment.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 自分のアバター */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-dark flex items-center justify-center text-white font-medium text-xs">
          Me
        </div>
      </article>
    );
  }

  // 受信メッセージ（従来の表示）
  return (
    <article className={`flex gap-3 p-4 hover:bg-hover transition-colors overflow-hidden ${!message.isRead ? 'bg-selected/30' : ''}`}>
      {/* 相手のアバター */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
        {initial}
      </div>

      <div className="flex flex-col min-w-0" style={{ maxWidth: '70%' }}>
        {/* ヘッダー */}
        <div className="flex items-baseline gap-2 mb-1 min-w-0">
          <span className="font-semibold text-text truncate">{displayName}</span>
          <span className="text-xs text-text-sub flex-shrink-0">{formatTime(message.receivedAt)}</span>
        </div>

        {/* 件名 */}
        {message.subject && (
          <div className="text-sm font-medium text-text mb-1 truncate">
            {message.subject || t('chat.noSubject')}
          </div>
        )}

        {/* 本文 - 受信メッセージの吹き出し */}
        <div className="bg-bg-sidebar border border-border rounded-2xl rounded-tl-sm px-4 py-2 max-w-full">
          <div
            className="text-sm text-text break-all"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere'
            }}
          >
            {displayContent}
          </div>
          {needsTruncation && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-primary hover:text-primary-hover mt-1 underline"
            >
              {isExpanded ? t('chat.collapse') : t('chat.expand')}
            </button>
          )}
        </div>

        {/* 添付ファイル */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <AttachmentCard
                key={attachment.id}
                attachment={attachment}
                onClick={() => onAttachmentClick?.(attachment.id)}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
