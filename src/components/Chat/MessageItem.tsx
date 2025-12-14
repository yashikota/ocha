import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AttachmentCard } from './AttachmentCard';
import type { Message } from '../../types';

import { ContextMenu } from '../Sidebar/ContextMenu';

interface MessageItemProps {
  message: Message;
  onAttachmentDownloaded?: (attachmentId: number, localPath: string) => void;
  onBookmarkChange?: (message: Message) => void;
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
    if (/^--\s*$/.test(line)) {
      return lines.slice(0, i).join('\n').length;
    }
    // 区切り線パターン（3文字以上の連続）
    if (/^[_\-=]{3,}\s*$/.test(line)) {
      return lines.slice(0, i).join('\n').length;
    }
    // モバイル署名
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

export function MessageItem({ message, onAttachmentDownloaded, onBookmarkChange }: MessageItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const isSent = message.isSent;

  const displayName = isSent
    ? (message.toEmail || '宛先不明')
    : (message.fromName || message.fromEmail);

  const displayEmail = !isSent && message.fromName ? message.fromEmail : null;

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
      <div
        id={`message-${message.id}`}
        className="flex justify-end px-2 py-2 overflow-hidden"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="max-w-[85%] min-w-0 flex flex-col items-end">
          <span className="text-xs text-text-sub mb-1">{formatTime(message.receivedAt)}</span>

          {message.subject && (
            <div className="text-xs text-text-sub mb-1 text-right truncate w-full flex items-center justify-end gap-1">
              {message.isBookmarked && (
                <span title={t('bookmark.bookmarked', 'ブックマーク済み')}>📌</span>
              )}
              {message.subject}
            </div>
          )}

          <div className={`bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2 overflow-hidden w-full ${message.isBookmarked ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}>
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
                  onDownloaded={onAttachmentDownloaded}
                />
              ))}
            </div>
          )}
        </div>
        {
          contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              items={[
                {
                  label: message.isBookmarked ? t('bookmark.remove', 'ブックマークを解除') : t('bookmark.add', 'ブックマークに追加'),
                  onClick: () => {
                    if (onBookmarkChange) {
                      onBookmarkChange(message);
                    }
                  },
                },
              ]}
            />
          )
        }
      </div>
    );
  }

  // 受信メッセージ（左側・グレー）
  return (
    <div
      id={`message-${message.id}`}
      className={`flex justify-start px-2 py-2 overflow-hidden ${!message.isRead ? 'bg-selected/20' : ''}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="max-w-[85%] min-w-0 flex flex-col items-start">
        <div className="flex flex-col mb-1 max-w-full">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text truncate">{displayName}</span>
            <span className="text-xs text-text-sub flex-shrink-0">{formatTime(message.receivedAt)}</span>
            {message.isBookmarked && (
              <span title={t('bookmark.bookmarked', 'ブックマーク済み')}>📌</span>
            )}
          </div>
          {displayEmail && (
            <span className="text-xs text-text-sub truncate">&lt;{displayEmail}&gt;</span>
          )}
        </div>

        {message.subject && (
          <div className="text-xs text-text-sub mb-1 truncate w-full">
            {message.subject}
          </div>
        )}

        <div className={`bg-gray-100 text-text rounded-2xl rounded-tl-sm px-4 py-2 overflow-hidden w-full ${message.isBookmarked ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}>
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
                onDownloaded={onAttachmentDownloaded}
              />
            ))}
          </div>
        )}
      </div>
      {
        contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[
              {
                label: message.isBookmarked ? t('bookmark.remove', 'ブックマークを解除') : t('bookmark.add', 'ブックマークに追加'),
                onClick: () => {
                  if (onBookmarkChange) {
                    onBookmarkChange(message);
                  }
                },
              },
            ]}
          />
        )
      }
    </div>
  );
}
