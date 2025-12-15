import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onCancel} className="max-w-sm">
      <div className="flex flex-col h-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
          <p className="text-sm text-text-sub leading-relaxed">{message}</p>
        </div>
        <div className="px-6 py-4 bg-bg border-t border-border flex justify-end gap-3 mt-auto">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-text-sub hover:bg-hover rounded-lg transition-colors"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${isDestructive
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-primary hover:bg-primary-hover'
              }`}
          >
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
