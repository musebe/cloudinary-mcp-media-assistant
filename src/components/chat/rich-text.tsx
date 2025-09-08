'use client';

import React, { useMemo } from 'react';

function linkify(text: string) {
  // Regex to find URLs, www links, and emails
  const urlRegex =
    /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)|(\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (!part) return null;

    // Check if the part is a URL or www link
    if (part.match(/^(https?:\/\/|www\.)/)) {
      const url = part.startsWith('www.') ? `https://${part}` : part;
      return (
        <a
          key={i}
          href={url}
          target='_blank'
          rel='noopener noreferrer'
          className='underline underline-offset-2 break-all'
        >
          {part}
        </a>
      );
    }

    // ✨ FIX: Check if the part is an email and create a mailto link
    if (part.match(/@/)) {
      return (
        <a
          key={i}
          href={`mailto:${part}`}
          className='underline underline-offset-2'
        >
          {part}
        </a>
      );
    }

    // Otherwise, return the text part as is
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function RichText({ text }: { text: string }) {
  // ✨ OPTIMIZATION: Memoize the expensive linkify operation.
  // This ensures it only runs when the 'text' prop changes.
  const linkedText = useMemo(() => linkify(text), [text]);

  return (
    <div className='whitespace-pre-wrap break-words leading-relaxed'>
      {linkedText}
    </div>
  );
}
