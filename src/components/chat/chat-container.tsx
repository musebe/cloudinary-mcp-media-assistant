'use client';

import {
  useRef,
  useOptimistic,
  startTransition,
  useLayoutEffect,
  useActionState,
} from 'react';

import type { ChatMessage } from '@/types';
import { sendMessageAction } from '@/app/(chat)/actions';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from './empty-state';
import { MessageBubble } from './message-bubble';
import { ChatInput } from './chat-input';
import { RichText } from './rich-text';
import { AssetList } from './asset-list';
import { ToolsList } from './tools-list';
import { TypingBubble } from './typing-bubble';

export function ChatContainer() {
  // useActionState gives loading as isPending
  const [messages, formAction, isPending] = useActionState(
    sendMessageAction,
    [] as ChatMessage[]
  );

  // Optimistic reducer and de-dupe by id
  const [optimisticMessages, addOptimisticMessage] = useOptimistic<
    ChatMessage[],
    ChatMessage
  >(messages, (state, update) => {
    if (state.some((m) => m.id === update.id)) return state;
    return [...state, update];
  });

  const endRef = useRef<HTMLDivElement>(null);

  // Keep view scrolled to the latest message
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [optimisticMessages, isPending]);

  const handleSend = (data: { text?: string; file?: File }) => {
    if (isPending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: data.text || `Uploading ${data.file?.name}...`,
    };

    const formData = new FormData();
    formData.append('id', userMessage.id);
    if (data.text) formData.append('text', data.text);
    if (data.file) {
      formData.append('file', data.file);
      formData.append('fileName', data.file.name);
    }

    // Do optimistic add and action inside a transition
    startTransition(() => {
      addOptimisticMessage(userMessage);
      formAction(formData);
    });
  };

  return (
    <div className='flex h-[70vh] flex-col'>
      {/* Scrollable messages */}
      <ScrollArea className='flex-1 min-h-0 px-4 py-4'>
        {optimisticMessages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className='mx-auto flex w-full max-w-2xl flex-col gap-4'>
            {optimisticMessages.map((m) => (
              <div key={m.id} className='space-y-3'>
                <MessageBubble role={m.role}>
                  <div className='space-y-3'>
                    <RichText text={m.text} />
                    {m.tools?.length ? <ToolsList tools={m.tools} /> : null}
                    {m.assets?.length ? <AssetList items={m.assets} /> : null}
                    {m.hint ? (
                      <div className='text-xs text-muted-foreground'>
                        {m.hint}
                      </div>
                    ) : null}
                  </div>
                </MessageBubble>
              </div>
            ))}
            {/* Anchor keeps scroll at bottom */}
            <div ref={endRef} aria-hidden />
          </div>
        )}
      </ScrollArea>

      {/* Fixed typing area, stays at bottom */}
      {isPending ? (
        <div className='px-4 pb-2'>
          <div className='mx-auto w-full max-w-2xl'>
            <TypingBubble />
          </div>
        </div>
      ) : null}

      <Separator />
      <ChatInput onSend={handleSend} />
    </div>
  );
}
