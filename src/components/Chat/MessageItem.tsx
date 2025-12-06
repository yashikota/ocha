import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCard } from './AttachmentCard';
import type { Message } from '../../types';

interface MessageItemProps {
  message: Message;
  previousBodies?: string[];
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

// テキストを正規化（比較用）
const normalizeText = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^>\s?/gm, '') // 引用の > を除去
    .replace(/\s+/g, ' ')   // 空白を統一
    .trim()
    .toLowerCase();
};

// 前のメッセージの引用部分を検出
const findQuotedContent = (body: string, previousBodies: string[]): number => {
  if (!previousBodies || previousBodies.length === 0) return -1;

  const normalized = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  // 各行について、前のメッセージの内容が含まれているかチェック
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNorm = normalizeText(line);

    // 短すぎる行は無視
    if (lineNorm.length < 10) continue;

    // 前のメッセージのいずれかに含まれているかチェック
    for (const prevBody of previousBodies) {
      const prevNorm = normalizeText(prevBody);
      if (prevNorm.length < 10) continue;

      // この行が前のメッセージに含まれているか
      if (prevNorm.includes(lineNorm)) {
        // この行より前の位置を返す
        const pos = lines.slice(0, i).join('\n').length;
        return pos > 0 ? pos : 0;
      }
    }
  }

  return -1;
};

// 署名パターンを検出
const findSignatureStart = (text: string): number => {
  const patterns = [
    /\n--\s*\n/,
    /\n_{3,}/,
    /\nSent from my /i,
    /\niPhoneから送信/,
  ];

  for (const pattern of patterns) {
    const match = text.search(pattern);
    if (match !== -1) return match;
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

export function MessageItem({ message, previousBodies = [], onAttachmentClick }: MessageItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const isSent = message.isSent;

  const displayName = isSent
    ? (message.toEmail || '宛先不明')
    : (message.fromName || message.fromEmail);

  const rawBody = message.bodyText || '';
  const fullBody = rawBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 引用または署名の開始位置を検出
  const quoteStart = findQuotedContent(fullBody, previousBodies);
  const sigStart = findSignatureStart(fullBody);

  // より早い位置を使う
  let footerStart = -1;
  if (quoteStart !== -1 && sigStart !== -1) {
    footerStart = Math.min(quoteStart, sigStart);
  } else if (quoteStart !== -1) {
    footerStart = quoteStart;
  } else if (sigStart !== -1) {
    footerStart = sigStart;
  }

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
      <div className="flex justify-end px-2 py-2 overflow-hidden">
        <div className="max-w-[85%] min-w-0 flex flex-col items-end">
          <span className="text-xs text-text-sub mb-1">{formatTime(message.receivedAt)}</span>

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
        <div className="flex items-center gap-2 mb-1 max-w-full">
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
