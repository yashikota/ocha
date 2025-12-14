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
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm(value);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm, value]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
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
          />
        </div>
        <div className="px-6 py-4 bg-bg border-t border-border flex justify-end gap-3">
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
    </div>
  );
}
