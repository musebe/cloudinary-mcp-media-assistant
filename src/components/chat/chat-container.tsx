'use client';

// ✨ Add useState and useEffect
import {
  useRef,
  useOptimistic,
  startTransition,
  useLayoutEffect,
  useActionState,
  useState,
  useEffect,
} from 'react';

import type { ChatMessage } from '@/types';
import { sendMessageAction } from '@/app/(chat)/actions';

// ... (other imports remain the same)
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
  const [messages, formAction, isPending] = useActionState(
    sendMessageAction,
    [] as ChatMessage[]
  );

  const [optimisticMessages, addOptimisticMessage] = useOptimistic<
    ChatMessage[],
    ChatMessage
  >(messages, (state, update) => {
    if (state.some((m) => m.id === update.id)) return state;
    return [...state, update];
  });

  // ✨ 1. Add state to store the last asset's ID
  const [lastAssetId, setLastAssetId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [optimisticMessages, isPending]);

  // ✨ 2. Add an effect to update the last asset ID from new messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && lastMessage.assets?.length) {
      setLastAssetId(lastMessage.assets[0].id);
    }
  }, [messages]);

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
    // ✨ 3. Pass the last asset ID to the server as context
    if (lastAssetId) {
      formData.append('lastAssetId', lastAssetId);
    }

    startTransition(() => {
      addOptimisticMessage(userMessage);
      formAction(formData);
    });
  };

  return (
    // The JSX structure is unchanged to preserve the layout
    <div className='flex h-[70vh] flex-col'>
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
            <div ref={endRef} aria-hidden />
          </div>
        )}
      </ScrollArea>

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
