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

// 署名の開始位置を検出
const findSignatureStart = (text: string): number => {
  const patterns = [
    /\n--\s*\n/,
    /\n_{3,}\s*\n/,
    /\nSent from my /i,
    /\niPhoneから送信/,
    /\n--\s*$/,
  ];

  for (const pattern of patterns) {
    const match = text.search(pattern);
    if (match !== -1) return match;
  }
  return -1;
};

const MAX_LENGTH = 500;

export function MessageItem({ message, onAttachmentClick }: MessageItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isSent = message.isSent;

  const displayName = isSent
    ? (message.toEmail || '宛先不明')
    : (message.fromName || message.fromEmail);
  const initial = displayName.charAt(0).toUpperCase();

  const fullBody = message.bodyText || '';
  const signatureStart = findSignatureStart(fullBody);
  const hasSignature = signatureStart !== -1;

  // 署名前の本文のみ（省略表示用）
  const mainBody = hasSignature ? fullBody.slice(0, signatureStart).trim() : fullBody;

  // 省略が必要かどうか（本文が長いか、署名があるか）
  const needsTruncation = mainBody.length > MAX_LENGTH || hasSignature;

  // 表示するコンテンツ
  const displayContent = isExpanded
    ? fullBody  // 展開時は署名含む全文
    : mainBody.length > MAX_LENGTH
      ? mainBody.slice(0, MAX_LENGTH) + '...'
      : mainBody;

  if (isSent) {
    return (
      <article className="flex gap-3 p-4 hover:bg-hover transition-colors justify-end">
        <div className="flex flex-col items-end min-w-0 max-w-[70%]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-text-sub">{formatTime(message.receivedAt)}</span>
            <span className="font-semibold text-text">自分</span>
          </div>

          {message.subject && (
            <div className="text-sm font-medium text-text mb-1 text-right w-full overflow-hidden text-ellipsis whitespace-nowrap">
              {message.subject}
            </div>
          )}

          <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2 w-full">
            <p className="text-sm whitespace-pre-wrap break-words overflow-hidden">
              {displayContent}
            </p>

            {needsTruncation && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-white/80 hover:text-white mt-2 underline block"
              >
                {isExpanded ? t('chat.collapse') : t('chat.expand')}
              </button>
            )}
          </div>

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

        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-dark flex items-center justify-center text-white font-medium text-xs">
          Me
        </div>
      </article>
    );
  }

  return (
    <article className={`flex gap-3 p-4 hover:bg-hover transition-colors ${!message.isRead ? 'bg-selected/30' : ''}`}>
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
        {initial}
      </div>

      <div className="flex flex-col min-w-0 max-w-[70%]">
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <span className="font-semibold text-text truncate">{displayName}</span>
          <span className="text-xs text-text-sub flex-shrink-0">{formatTime(message.receivedAt)}</span>
        </div>

        {message.subject && (
          <div className="text-sm font-medium text-text mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {message.subject}
          </div>
        )}

        <div className="bg-bg-sidebar border border-border rounded-2xl rounded-tl-sm px-4 py-2 w-full">
          <p className="text-sm text-text whitespace-pre-wrap break-words overflow-hidden">
            {displayContent}
          </p>

          {needsTruncation && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-primary hover:text-primary-hover mt-2 underline block"
            >
              {isExpanded ? t('chat.collapse') : t('chat.expand')}
            </button>
          )}
        </div>

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
