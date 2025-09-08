export function ToolsList({ tools }: { tools: string[] }) {
  if (!tools?.length) return null;
  return (
    <div className='space-y-2'>
      <h4 className='text-[15px] font-semibold'>Available tools</h4>
      <ul className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
        {tools.map((t) => (
          <li key={t} className='rounded-lg bg-secondary px-3 py-2 text-sm'>
            • {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
