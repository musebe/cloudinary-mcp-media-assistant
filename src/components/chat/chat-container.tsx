'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from './empty-state';
import { MessageBubble } from './message-bubble';
import { ChatInput } from './chat-input';
import { RichText } from './rich-text';
import { AssetList, type AssetItem } from './asset-list';
import { ToolsList } from './tools-list';
import { TypingBubble } from './typing-bubble';
import { useRef, useState } from 'react';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actionUrl?: string;
  assets?: AssetItem[];
  tools?: string[];
  hint?: string;
};

export function ChatContainer() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  // We control our own scroll area content and auto-scroll without useEffect.
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  function scrollToBottom(smooth = true) {
    // Use a microtask so DOM updates after setState are applied.
    queueMicrotask(() => {
      endRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      });
    });
  }

  async function handleSend(text: string) {
    // push user message
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text },
    ]);
    scrollToBottom();

    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.reply ?? '',
          actionUrl: data.actionUrl,
          assets: data.assets,
          tools: data.tools,
          hint: data.hint,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Something went wrong. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  return (
    <div className='flex h-[70vh] flex-col overflow-hidden'>
      {/* vertical scroll only, anchor keeps view pinned near bottom when new content arrives */}
      <ScrollArea className='flex-1 overflow-y-auto overflow-x-hidden px-4 py-4'>
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            ref={listRef}
            className='mx-auto flex w-full max-w-2xl flex-col gap-4 [scroll-behavior:smooth]'
            style={{ overflowAnchor: 'auto' }}
          >
            {messages.map((m) => (
              <div key={m.id} className='space-y-3'>
                <MessageBubble role={m.role}>
                  <div className='space-y-3'>
                    <RichText text={m.text} />
                    {m.tools && <ToolsList tools={m.tools} />}
                    {m.assets && m.assets.length > 0 && (
                      <AssetList items={m.assets} />
                    )}
                    {m.hint && (
                      <div className='text-xs text-muted-foreground'>
                        {m.hint}
                      </div>
                    )}
                  </div>
                </MessageBubble>

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

            {/* typing indicator while we wait */}
            {loading && (
              <div className='mt-1'>
                <TypingBubble />
              </div>
            )}

            {/* scroll anchor */}
            <div ref={endRef} aria-hidden />
          </div>
        )}
      </ScrollArea>

      <Separator />
      <ChatInput onSend={handleSend} />
    </div>
  );
}
