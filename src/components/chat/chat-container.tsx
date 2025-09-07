'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from './empty-state';
import { MessageBubble } from './message-bubble';
import { ChatInput } from './chat-input';
import { useState } from 'react';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actionUrl?: string;
};

export function ChatContainer() {
  const [messages, setMessages] = useState<Msg[]>([]);

  async function handleSend(text: string) {
    // Add user message
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text },
    ]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      const data = await res.json();

      // Add assistant reply, include optional actionUrl
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.reply,
          actionUrl: data.actionUrl,
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Something went wrong. Please try again.',
        },
      ]);
    }
  }

  return (
    <div className='flex h-[70vh] flex-col'>
      <ScrollArea className='flex-1 p-4'>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className='mx-auto flex w-full max-w-2xl flex-col gap-3'>
            {messages.map((m) => (
              <div key={m.id} className='space-y-2'>
                <MessageBubble role={m.role} text={m.text} />
                {m.actionUrl && m.role === 'assistant' && (
                  <div className='flex justify-start'>
                    <a
                      href={m.actionUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90'
                    >
                      Connect to Cloudinary
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      <Separator />
      <ChatInput onSend={handleSend} />
    </div>
  );
}
