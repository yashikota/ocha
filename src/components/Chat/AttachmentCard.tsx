import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Attachment } from '../../types';
import { downloadAttachment, openAttachment } from '../../hooks/useTauri';

interface AttachmentCardProps {
  attachment: Attachment;
  onOpen?: (localPath: string) => void;
  onDownloaded?: (attachmentId: number, localPath: string) => void;
}

const getFileIcon = (mimeType: string | undefined): string => {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  return '📄';
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// スピナーコンポーネント
function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ダウンロードアイコン
function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

// 開くアイコン（フォルダオープン）
function OpenIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
      />
    </svg>
  );
}

// チェックアイコン
function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function AttachmentCard({ attachment, onOpen, onDownloaded }: AttachmentCardProps) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const [localPath, setLocalPath] = useState(attachment.localPath);
  const [error, setError] = useState<string | null>(null);

  const icon = getFileIcon(attachment.mimeType ?? undefined);
  const isDownloaded = !!localPath;

  const handleClick = async () => {
    setError(null);

    if (isDownloading) return;

    if (isDownloaded && localPath) {
      // 既にダウンロード済み → ファイルを開く
      try {
        await openAttachment(attachment.id);
      } catch (err) {
        console.error('Failed to open attachment:', err);
        setError(t('chat.downloadError'));
      }
      return;
    }

    // ダウンロード開始
    setIsDownloading(true);
    try {
      const path = await downloadAttachment(attachment.id);
      setLocalPath(path);
      onDownloaded?.(attachment.id, path);
      // ダウンロード完了後、自動的にファイルを開く
      await openAttachment(attachment.id);
    } catch (err) {
      console.error('Failed to download attachment:', err);
      setError(t('chat.downloadError'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDownloading}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left max-w-xs
        ${isDownloaded
          ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
          : 'bg-bg border-border hover:bg-hover'
        }
        ${isDownloading ? 'opacity-70 cursor-wait' : 'cursor-pointer'}
        ${error ? 'border-red-300' : ''}
      `}
      title={isDownloaded ? t('chat.openFile') : t('chat.downloadFile')}
    >
      {/* ファイルアイコン + ダウンロード済みバッジ */}
      <div className="relative flex-shrink-0">
        <span className="text-xl">{icon}</span>
        {isDownloaded && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center">
            <CheckIcon />
          </span>
        )}
      </div>

      {/* ファイル情報 */}
      <div className="min-w-0 flex-1">
        <div className={`text-sm truncate ${isDownloaded ? 'text-primary font-medium' : 'text-text'}`}>
          {attachment.filename}
        </div>
        <div className="text-xs text-text-sub flex items-center gap-1">
          {formatFileSize(attachment.size)}
          {isDownloaded && (
            <span className="text-primary">• {t('chat.downloaded')}</span>
          )}
          {error && (
            <span className="text-red-500">• {error}</span>
          )}
        </div>
      </div>

      {/* アクションアイコン */}
      <div className={`flex-shrink-0 ${isDownloaded ? 'text-primary' : 'text-text-sub'}`}>
        {isDownloading ? (
          <Spinner />
        ) : isDownloaded ? (
          <OpenIcon />
        ) : (
          <DownloadIcon />
        )}
      </div>
    </button>
  );
}
