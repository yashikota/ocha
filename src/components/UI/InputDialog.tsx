import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

import { Modal } from './Modal';

export function InputDialog({
  isOpen,
  title,
  message,
  placeholder,
  defaultValue = '',
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm(value);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} className="max-w-sm">
      <div className="flex flex-col h-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-text mb-2">{title}</h3>
          {message && <p className="text-sm text-text-sub mb-4">{message}</p>}
          <input
            ref={inputRef}
            type="text"
            className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-text bg-bg-input"
            placeholder={placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="px-6 py-4 bg-bg border-t border-border flex justify-end gap-3 mt-auto">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-text-sub hover:bg-hover rounded-lg transition-colors"
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            onClick={() => onConfirm(value)}
            disabled={!value.trim()}
            className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
