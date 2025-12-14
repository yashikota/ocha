import { useEffect, useRef } from 'react';

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', onClose);
    window.addEventListener('resize', onClose);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', onClose);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  // 画面外にはみ出さないように位置を調整
  const style: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 1000,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="bg-white rounded-lg shadow-xl border border-gray-100 py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`
            w-full text-left px-4 py-2 text-sm transition-colors
            ${item.danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
