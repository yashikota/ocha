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

// 署名・引用ヘッダーの開始位置を検出
const findFooterStart = (text: string): number => {
  // 改行を統一
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // 確実な引用/署名パターン
  const patterns = [
    /\n--\s*\n/,                              // 標準署名区切り
    /\n_{3,}/,                                // アンダースコア区切り
    /\nSent from my /i,                       // iOS署名
    /\niPhoneから送信/,                        // 日本語iOS
    /\nOn \d{4}\/\d{1,2}\/\d{1,2}[^]*?wrote:/i, // Gmail引用 (On 2025/08/20 ... wrote:)
    /\nOn [A-Z][a-z]{2} \d{1,2}, \d{4}[^]*?wrote:/i, // Gmail引用 (On Aug 20, 2024 ... wrote:)
    /\n\d{4}年\d{1,2}月\d{1,2}日[^]*?:/,       // 日本語Gmail引用
    /\n-{3,}.*Original Message/i,            // Outlook引用
    /\n_{3,}.*Original Message/i,            // Outlook引用
    /\nFrom: [^\n]+\nSent: /i,               // Outlook形式引用ヘッダー
    /\n差出人: [^\n]+\n送信日時: /,            // 日本語Outlook
  ];
  
  for (const pattern of patterns) {
    const match = normalized.search(pattern);
    if (match !== -1) {
      return match;
    }
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

  const rawBody = message.bodyText || '';
  const fullBody = rawBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const footerStart = findFooterStart(fullBody);
  const hasFooter = footerStart !== -1;
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
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[75%] flex flex-col items-end">
          <span className="text-xs text-text-sub mb-1">{formatTime(message.receivedAt)}</span>

          {message.subject && (
            <div className="text-xs text-text-sub mb-1 text-right">
              {message.subject}
            </div>
          )}

          <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2">
            <p className="text-sm whitespace-pre-wrap break-words">
              {displayContent}
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
    <div className={`flex justify-start px-4 py-2 ${!message.isRead ? 'bg-selected/20' : ''}`}>
      <div className="max-w-[75%] flex flex-col items-start">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-text">{displayName}</span>
          <span className="text-xs text-text-sub">{formatTime(message.receivedAt)}</span>
        </div>

        {message.subject && (
          <div className="text-xs text-text-sub mb-1">
            {message.subject}
          </div>
        )}

        <div className="bg-gray-100 text-text rounded-2xl rounded-tl-sm px-4 py-2">
          <p className="text-sm whitespace-pre-wrap break-words">
            {displayContent}
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
