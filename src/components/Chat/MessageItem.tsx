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

export function MessageItem({ message, onAttachmentClick }: MessageItemProps) {
  const { t } = useTranslation();
  const isSent = message.isSent;
  
  // 表示名の決定
  const displayName = isSent 
    ? (message.toEmail || '宛先不明')
    : (message.fromName || message.fromEmail);
  const initial = displayName.charAt(0).toUpperCase();

  // 本文を取得
  const bodyContent = message.bodyText || '';

  // 送信メッセージは右側、受信メッセージは左側
  if (isSent) {
    return (
      <article className={`flex gap-3 p-4 hover:bg-hover transition-colors justify-end`}>
        <div className="flex-1 min-w-0 max-w-[75%]">
          {/* ヘッダー */}
          <div className="flex items-baseline gap-2 mb-1 justify-end">
            <span className="text-xs text-text-sub flex-shrink-0">{formatTime(message.receivedAt)}</span>
            <span className="font-semibold text-text truncate">自分</span>
          </div>

          {/* 件名 */}
          {message.subject && (
            <div className="text-sm font-medium text-text mb-1 text-right">
              {message.subject || t('chat.noSubject')}
            </div>
          )}

          {/* 本文 - 送信メッセージの吹き出し */}
          <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-2 ml-auto w-fit max-w-full">
            <div className="text-sm whitespace-pre-wrap break-words line-clamp-6">
              {bodyContent}
            </div>
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
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-dark flex items-center justify-center text-white font-medium">
          Me
        </div>
      </article>
    );
  }

  // 受信メッセージ（従来の表示）
  return (
    <article className={`flex gap-3 p-4 hover:bg-hover transition-colors ${!message.isRead ? 'bg-selected/30' : ''}`}>
      {/* 相手のアバター */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-medium">
        {initial}
      </div>

      <div className="flex-1 min-w-0 max-w-[75%]">
        {/* ヘッダー */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-semibold text-text truncate">{displayName}</span>
          <span className="text-xs text-text-sub flex-shrink-0">{formatTime(message.receivedAt)}</span>
        </div>

        {/* 件名 */}
        {message.subject && (
          <div className="text-sm font-medium text-text mb-1">
            {message.subject || t('chat.noSubject')}
          </div>
        )}

        {/* 本文 - 受信メッセージの吹き出し */}
        <div className="bg-bg-sidebar border border-border rounded-2xl rounded-tl-sm px-4 py-2 w-fit max-w-full">
          <div className="text-sm text-text whitespace-pre-wrap break-words line-clamp-6">
            {bodyContent}
          </div>
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
