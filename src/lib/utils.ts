// src/lib/utils.ts

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;

  // Set locale to 'en-KE' for Kenya
  return new Intl.DateTimeFormat('en-KE', {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}