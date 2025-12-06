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

// 引用・署名の開始位置を検出
const findFooterStart = (text: string): number => {
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 署名パターン
    if (/^--\s*$/.test(line) || /^_{3,}/.test(line)) {
      return lines.slice(0, i).join('\n').length;
    }
    if (/^Sent from my /i.test(line) || /^iPhoneから送信/.test(line)) {
      return lines.slice(0, i).join('\n').length;
    }

    // 引用パターン: > で始まる行
    if (line.startsWith('>')) {
      return lines.slice(0, i).join('\n').length;
    }
  }

  return -1;
};

const MAX_LENGTH = 500;

// URLを検出してリンク化
const linkifyText = (text: string, isSent: boolean) => {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-all ${isSent ? 'text-white/90 hover:text-white' : 'text-primary hover:text-primary-hover'}`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export function MessageItem({ message, onAttachmentClick }: MessageItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isSent = message.isSent;

  const displayName = isSent
    ? (message.toEmail || '宛先不明')
    : (message.fromName || message.fromEmail);

  const fullBody = (message.bodyText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const footerStart = findFooterStart(fullBody);
  const hasFooter = footerStart !== -1 && footerStart > 0;
  const mainBody = hasFooter ? fullBody.slice(0, footerStart).trim() : fullBody;
  const needsTruncation = mainBody.length > MAX_LENGTH || hasFooter;
  const displayContent = isExpanded
    ? fullBody
    : mainBody.length > MAX_LENGTH
      ? mainBody.slice(0, MAX_LENGTH) + '...'
      : mainBody;

  // 送信メッセージ（右側・緑）
  if (isSent) {
    return (
      <div className="flex justify-end px-2 py-2 overflow-hidden">
        <div className="max-w-[85%] min-w-0 flex flex-col items-end">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs text-text-sub">{formatTime(message.receivedAt)}</span>
            <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>

          {message.subject && (
            <div className="text-xs text-text-sub mb-1 text-right truncate w-full">
              {message.subject}
            </div>
          )}

          <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2 overflow-hidden w-full">
            <p className="text-sm whitespace-pre-wrap break-all overflow-hidden">
              {linkifyText(displayContent, true)}
            </p>

            {needsTruncation && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-white/70 hover:text-white mt-1 underline"
              >
                {isExpanded ? t('chat.collapse') : t('chat.expand')}
              </button>
            )}
          </div>

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1 justify-end">
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
      </div>
    );
  }

  // 受信メッセージ（左側・グレー）
  return (
    <div className={`flex justify-start px-2 py-2 overflow-hidden ${!message.isRead ? 'bg-selected/20' : ''}`}>
      <div className="max-w-[85%] min-w-0 flex flex-col items-start">
        <div className="flex items-center gap-1.5 mb-1 max-w-full">
          <svg className="w-3.5 h-3.5 text-text-sub flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span className="text-xs font-medium text-text truncate">{displayName}</span>
          <span className="text-xs text-text-sub flex-shrink-0">{formatTime(message.receivedAt)}</span>
        </div>

        {message.subject && (
          <div className="text-xs text-text-sub mb-1 truncate w-full">
            {message.subject}
          </div>
        )}

        <div className="bg-gray-100 text-text rounded-2xl rounded-tl-sm px-4 py-2 overflow-hidden w-full">
          <p className="text-sm whitespace-pre-wrap break-all overflow-hidden">
            {linkifyText(displayContent, false)}
          </p>

          {needsTruncation && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-primary hover:text-primary-hover mt-1 underline"
            >
              {isExpanded ? t('chat.collapse') : t('chat.expand')}
            </button>
          )}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
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
    </div>
  );
}
