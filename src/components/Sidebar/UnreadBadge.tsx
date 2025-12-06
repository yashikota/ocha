interface UnreadBadgeProps {
  count: number;
}

export function UnreadBadge({ count }: UnreadBadgeProps) {
  if (count <= 0) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium text-white bg-unread rounded-full">
      {count > 99 ? '99+' : count}
    </span>
  );
}

