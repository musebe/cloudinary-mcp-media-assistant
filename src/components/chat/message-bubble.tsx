// src/components/chat/message-bubble.tsx

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export function MessageBubble({
  role,
  children,
}: {
  role: 'user' | 'assistant';
  children: ReactNode;
}) {
  const isUser = role === 'user';
  return (
    <div
      className={cn(
        // clamp width to container, wrap long text
        'w-fit max-w-[92%] md:max-w-[80%] break-words whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm md:text-[15px] leading-relaxed shadow-sm',
        isUser
          ? 'ml-auto bg-primary text-primary-foreground'
          : 'bg-muted text-foreground'
      )}
    >
      {children}
    </div>
  );
}
