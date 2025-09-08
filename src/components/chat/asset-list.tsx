export type AssetItem = {
  id: string;
  url?: string;
  thumbUrl?: string;
  folder?: string;
  createdAt?: string;
  format?: string;
  width?: number;
  height?: number;
};

export function AssetList({ items }: { items: AssetItem[] }) {
  return (
    <div className='grid grid-cols-1 gap-3'>
      {items.map((a) => (
        <div
          key={a.id}
          className='flex items-center gap-3 rounded-xl bg-secondary p-3'
        >
          {/* Thumb */}
          {a.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.thumbUrl}
              alt={a.id}
              width={56}
              height={56}
              className='h-14 w-14 rounded-md object-cover'
            />
          ) : (
            <div className='h-14 w-14 rounded-md bg-muted' />
          )}

          {/* Meta */}
          <div className='min-w-0 flex-1'>
            <div className='truncate font-medium'>{a.id}</div>
            <div className='text-xs text-muted-foreground'>
              {a.folder ? (
                <span>Folder, {a.folder}</span>
              ) : (
                <span>No folder</span>
              )}
              {a.format && <span> · {a.format}</span>}
              {a.width && a.height && (
                <span>
                  {' '}
                  · {a.width}×{a.height}
                </span>
              )}
            </div>
          </div>

          {/* Link */}
          {a.url && (
            <a
              href={a.url}
              target='_blank'
              rel='noopener noreferrer'
              className='text-sm font-medium text-primary underline underline-offset-2'
            >
              Open
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
