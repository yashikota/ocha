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

// 署名を検出して分離する
const separateSignature = (text: string): { body: string; signature: string | null } => {
  // 一般的な署名区切りパターン
  const signaturePatterns = [
    /\n--\s*\n/,           // -- (標準)
    /\n_{3,}\s*\n/,        // ___
    /\nSent from my /i,    // Sent from my iPhone等
    /\niPhoneから送信/,     // 日本語iPhone
    /\n--\s*$/,            // 末尾の--
  ];

  for (const pattern of signaturePatterns) {
    const match = text.search(pattern);
    if (match !== -1) {
      return {
        body: text.slice(0, match).trim(),
        signature: text.slice(match).trim(),
      };
    }
  }

  return { body: text, signature: null };
};

// 省略するかどうかの閾値（文字数）
const MAX_LENGTH = 500;

export function MessageItem({ message, onAttachmentClick }: MessageItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const isSent = message.isSent;

  // 表示名の決定
  const displayName = isSent
    ? (message.toEmail || '宛先不明')
    : (message.fromName || message.fromEmail);
  const initial = displayName.charAt(0).toUpperCase();

  // 本文と署名を分離
  const rawBody = message.bodyText || '';
  const { body: bodyWithoutSignature, signature } = separateSignature(rawBody);

  // 表示する本文
  const bodyContent = bodyWithoutSignature;
  const needsTruncation = bodyContent.length > MAX_LENGTH;
  const displayContent = isExpanded || !needsTruncation
    ? bodyContent
    : bodyContent.slice(0, MAX_LENGTH) + '...';

  // GmailのURLを生成
  const gmailUrl = message.messageId
    ? `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(message.messageId)}`
    : null;

  // Gmailで開くボタン
  const OpenInGmailButton = () => gmailUrl && (
    <a
      href={gmailUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-text-sub hover:text-primary ml-2"
      title={t('chat.openInGmail')}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );

  // 送信メッセージは右側
  if (isSent) {
    return (
      <article className="flex gap-3 p-4 hover:bg-hover transition-colors justify-end">
        <div className="flex flex-col items-end min-w-0 max-w-[70%]">
          {/* ヘッダー */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-text-sub">{formatTime(message.receivedAt)}</span>
            <span className="font-semibold text-text">自分</span>
            <OpenInGmailButton />
          </div>

          {/* 件名 */}
          {message.subject && (
            <div className="text-sm font-medium text-text mb-1 text-right w-full overflow-hidden text-ellipsis whitespace-nowrap">
              {message.subject}
            </div>
          )}

          {/* 本文 */}
          <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2 w-full">
            <p className="text-sm whitespace-pre-wrap break-words overflow-hidden">
              {displayContent}
            </p>

            {/* 展開/折りたたみ */}
            {needsTruncation && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-white/80 hover:text-white mt-2 underline block"
              >
                {isExpanded ? t('chat.collapse') : t('chat.expand')}
              </button>
            )}

            {/* 署名表示トグル */}
            {signature && (
              <button
                onClick={() => setShowSignature(!showSignature)}
                className="text-xs text-white/60 hover:text-white/80 mt-2 block"
              >
                {showSignature ? t('chat.hideSignature') : t('chat.showSignature')}
              </button>
            )}
            {signature && showSignature && (
              <div className="mt-2 pt-2 border-t border-white/20 text-xs text-white/70 whitespace-pre-wrap break-words">
                {signature}
              </div>
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

  // 受信メッセージは左側
  return (
    <article className={`flex gap-3 p-4 hover:bg-hover transition-colors ${!message.isRead ? 'bg-selected/30' : ''}`}>
      {/* アバター */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
        {initial}
      </div>

      <div className="flex flex-col min-w-0 max-w-[70%]">
        {/* ヘッダー */}
        <div className="flex items-center gap-2 mb-1 min-w-0">
          <span className="font-semibold text-text truncate">{displayName}</span>
          <span className="text-xs text-text-sub flex-shrink-0">{formatTime(message.receivedAt)}</span>
          <OpenInGmailButton />
        </div>

        {/* 件名 */}
        {message.subject && (
          <div className="text-sm font-medium text-text mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {message.subject}
          </div>
        )}

        {/* 本文 */}
        <div className="bg-bg-sidebar border border-border rounded-2xl rounded-tl-sm px-4 py-2 w-full">
          <p className="text-sm text-text whitespace-pre-wrap break-words overflow-hidden">
            {displayContent}
          </p>

          {/* 展開/折りたたみ */}
          {needsTruncation && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-primary hover:text-primary-hover mt-2 underline block"
            >
              {isExpanded ? t('chat.collapse') : t('chat.expand')}
            </button>
          )}

          {/* 署名表示トグル */}
          {signature && (
            <button
              onClick={() => setShowSignature(!showSignature)}
              className="text-xs text-text-sub hover:text-text mt-2 block"
            >
              {showSignature ? t('chat.hideSignature') : t('chat.showSignature')}
            </button>
          )}
          {signature && showSignature && (
            <div className="mt-2 pt-2 border-t border-border text-xs text-text-sub whitespace-pre-wrap break-words">
              {signature}
            </div>
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
