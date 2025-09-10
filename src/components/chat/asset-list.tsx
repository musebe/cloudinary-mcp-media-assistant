// components/chat/asset-list.tsx
import Image from 'next/image';
import { useMemo } from 'react';
import { formatDate } from '@/lib/utils';
import { AssetItem } from '@/types';

// Optional shape extensions, keep API stable
type WithTags = { tags?: string[] };
type WithRT = { resourceType?: 'image' | 'video' | 'raw' };

// Props for the main list component
type AssetListProps = {
  items: AssetItem[];
  onOpen?: (item: AssetItem) => void;
  emptyText?: string;
};

// Props for the individual item component
type AssetListItemProps = {
  item: AssetItem;
  onOpen?: (item: AssetItem) => void;
};

// Helpers
function deriveFolderFromId(id: string | undefined) {
  if (!id || !id.includes('/')) return undefined;
  const parts = id.split('/');
  parts.pop();
  return parts.join('/');
}

function mediaEmoji(item: AssetItem & WithRT) {
  if (item.resourceType === 'video') return '🎞️';
  if ((item.format || '').toLowerCase() === 'gif') return '🌀';
  return '🖼️';
}

// Sub-component for rendering a single asset item
function AssetListItem({ item, onOpen }: AssetListItemProps) {
  const tags = (item as AssetItem & WithTags).tags;

  // Memoize the calculation of the metadata string for performance
  const meta = useMemo(() => {
    const details: string[] = [];
    const folder = item.folder ?? deriveFolderFromId(item.id);
    details.push(folder ? `Folder, ${folder}` : 'No folder');
    if (item.format) details.push(item.format.toUpperCase());
    if (item.width && item.height) details.push(`${item.width}×${item.height}`);
    const dateLabel = formatDate(item.createdAt);
    if (dateLabel) details.push(dateLabel);
    return details.join(' · ');
  }, [item]);

  return (
    <div className='flex items-start gap-3 rounded-xl bg-secondary p-3'>
      {/* Optimized Image Component */}
      {item.thumbUrl ? (
        <Image
          src={item.thumbUrl}
          alt={`Thumbnail for ${item.id}`}
          width={56}
          height={56}
          className='h-14 w-14 rounded-md object-cover'
        />
      ) : (
        <div
          aria-hidden
          className='h-14 w-14 flex-shrink-0 rounded-md bg-muted'
        />
      )}

      {/* Metadata Section */}
      <div className='min-w-0 flex-1'>
        <div className='truncate font-medium' title={item.id}>
          <span className='mr-1'>{mediaEmoji(item as AssetItem & WithRT)}</span>
          {item.id}
        </div>
        <div className='text-xs text-muted-foreground'>{meta}</div>

        {/* Tags */}
        {tags && tags.length > 0 ? (
          <div className='mt-2 flex flex-wrap gap-1.5'>
            {tags.map((t) => (
              <span
                key={t}
                className='inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
                title={t}
              >
                <span className='mr-1'>🏷️</span>
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Actions Section */}
      <div className='flex-shrink-0'>
        {onOpen ? (
          <button
            type='button'
            onClick={() => onOpen(item)}
            className='text-sm font-medium text-primary underline-offset-2 hover:underline'
          >
            Open
          </button>
        ) : item.url ? (
          <a
            href={item.url}
            target='_blank'
            rel='noopener noreferrer'
            className='text-sm font-medium text-primary underline-offset-2 hover:underline'
          >
            Open
          </a>
        ) : null}
      </div>
    </div>
  );
}

// Main list component
export function AssetList({
  items,
  onOpen,
  emptyText = 'No assets yet.',
}: AssetListProps) {
  if (!items?.length) {
    return (
      <div className='rounded-xl border border-dashed p-6 text-sm text-muted-foreground'>
        {emptyText}
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 gap-3'>
      {items.map((item) => (
        <AssetListItem key={item.id} item={item} onOpen={onOpen} />
      ))}
    </div>
  );
}
