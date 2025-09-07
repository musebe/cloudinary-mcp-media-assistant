import { cn } from '@/lib/utils';

export function MessageBubble({
  role,
  text,
}: {
  role: 'user' | 'assistant';
  text: string;
}) {
  const isUser = role === 'user';
  return (
    <div
      className={cn(
        'w-fit max-w-[85%] rounded-xl px-3 py-2 text-sm',
        isUser
          ? 'ml-auto bg-primary text-primary-foreground'
          : 'bg-muted text-foreground'
      )}
    >
      {text}
    </div>
  );
}
