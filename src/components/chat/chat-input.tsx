'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue('');
  }

  return (
    <form onSubmit={submit} className='flex gap-2 p-3'>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Type your message'
        className='flex-1'
        aria-label='Message'
      />
      <Button type='submit'>Send</Button>
    </form>
  );
}
