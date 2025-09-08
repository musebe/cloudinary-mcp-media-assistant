// components/chat/asset-list.tsx
import Image from 'next/image';
import { useMemo } from 'react';
import { formatDate } from '@/lib/utils';
import { AssetItem } from '@/types'; // ✨ Import type from the new central file

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

// Sub-component for rendering a single asset item
function AssetListItem({ item, onOpen }: AssetListItemProps) {
  // Memoize the calculation of the metadata string for performance
  const meta = useMemo(() => {
    const details: string[] = [];
    details.push(item.folder ? `Folder, ${item.folder}` : 'No folder');
    if (item.format) details.push(item.format.toUpperCase());
    if (item.width && item.height) details.push(`${item.width}×${item.height}`);
    const dateLabel = formatDate(item.createdAt);
    if (dateLabel) details.push(dateLabel);
    return details.join(' · ');
  }, [item]);

  return (
    <div className='flex items-center gap-3 rounded-xl bg-secondary p-3'>
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
          {item.id}
        </div>
        <div className='text-xs text-muted-foreground'>{meta}</div>
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
