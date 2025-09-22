// src/components/chat/typing-bubble.tsx

export function TypingBubble() {
  return (
    <div className='w-fit max-w-[92%] md:max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm bg-muted text-foreground'>
      <div className='flex items-center gap-1'>
        <span className='sr-only'>Assistant is typing</span>
        <span className='inline-block h-2 w-2 rounded-full bg-foreground/60 animate-bounce [animation-delay:-0.2s]' />
        <span className='inline-block h-2 w-2 rounded-full bg-foreground/60 animate-bounce' />
        <span className='inline-block h-2 w-2 rounded-full bg-foreground/60 animate-bounce [animation-delay:0.2s]' />
      </div>
    </div>
  );
}
