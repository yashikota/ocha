import { useTranslation } from 'react-i18next';
import type { Attachment } from '../../types';

interface AttachmentCardProps {
  attachment: Attachment;
  onClick?: () => void;
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

export function AttachmentCard({ attachment, onClick }: AttachmentCardProps) {
  const { t } = useTranslation();
  const icon = getFileIcon(attachment.mimeType ?? undefined);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-bg rounded-lg border border-border hover:bg-hover transition-colors text-left max-w-xs"
      title={t('chat.attachment')}
    >
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-text truncate">{attachment.filename}</div>
        <div className="text-xs text-text-sub">{formatFileSize(attachment.size)}</div>
      </div>
      <svg className="w-4 h-4 text-text-sub flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </button>
  );
}
