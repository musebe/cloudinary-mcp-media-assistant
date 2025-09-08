'use client';

import { useState, useRef } from 'react';
import { Paperclip } from 'lucide-react'; // A popular icon library
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Prop type updated to handle both text and files
type ChatInputProps = {
  onSend: (data: { text?: string; file?: File }) => void;
};

export function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState('');
  // Ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    // Call onSend with the new object structure
    onSend({ text });
    setValue('');
  }

  // Handler for when a file is selected
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onSend({ file });
      // Reset the input value to allow uploading the same file again
      event.target.value = '';
    }
  }

  return (
    <form onSubmit={submit} className='flex items-center gap-2 p-3'>
      {/* Hidden file input element */}
      <input
        type='file'
        // ✨ FIX: Corrected the typo in the ref name
        ref={fileInputRef}
        onChange={handleFileChange}
        className='hidden'
        accept='image/*' // Restrict to image files
      />

      {/* Button to trigger the file input */}
      <Button
        type='button'
        variant='ghost'
        size='icon'
        onClick={() => fileInputRef.current?.click()}
        aria-label='Attach file'
      >
        <Paperclip className='h-5 w-5' />
      </Button>

      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type 'list images' or upload a file..."
        className='flex-1'
        aria-label='Message'
      />
      <Button type='submit'>Send</Button>
    </form>
  );
}
