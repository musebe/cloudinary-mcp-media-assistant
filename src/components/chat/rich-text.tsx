'use client';

import React from 'react';

function linkify(text: string) {
  const parts = text.split(
    /(https?:\/\/[^\s)]+)|(www\.[^\s)]+)|(\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}\b)/
  );
  return parts.map((part, i) => {
    if (!part) return null;
    const url = part.startsWith('http')
      ? part
      : part.startsWith('www.')
      ? `https://${part}`
      : null;
    if (url) {
      return (
        <a
          key={i}
          href={url}
          target='_blank'
          rel='noopener noreferrer'
          className='underline underline-offset-2 break-words'
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function RichText({ text }: { text: string }) {
  return (
    <div className='whitespace-pre-wrap break-words leading-relaxed'>
      {linkify(text)}
    </div>
  );
}
