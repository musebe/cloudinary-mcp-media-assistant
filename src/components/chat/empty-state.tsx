// components/chat/empty-state.tsx

import { MessageSquare } from 'lucide-react'; // A popular icon library

export function EmptyState() {
  return (
    <div className='mx-auto my-16 flex max-w-md flex-col items-center gap-4 text-center text-sm text-muted-foreground'>
      {/* ✨ Optional: Add an icon for better visual communication */}
      <MessageSquare className='h-10 w-10' />

      <div className='space-y-2'>
        <p className='font-medium'>Your chat session is empty.</p>
        <p>
          Start a conversation, upload a file, or try asking for your assets.
        </p>
      </div>

      {/* ✨ Optional: Give the user a concrete example to try */}
      <div className='mt-4'>
        <p>Try saying:</p>
        <code className='mt-1 inline-block rounded bg-secondary px-2 py-1 text-secondary-foreground'>
          list images
        </code>
      </div>
    </div>
  );
}
