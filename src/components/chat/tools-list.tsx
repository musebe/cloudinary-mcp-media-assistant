// src/components/chat/tools-list.tsx

export function ToolsList({ tools }: { tools: string[] }) {
  if (!tools?.length) return null;
  return (
    <div className='space-y-2'>
      <h4 className='text-[15px] font-semibold'>Available tools</h4>
      {/* ✨ Add list-disc and list-inside for semantic bullet points */}
      <ul className='grid grid-cols-1 sm:grid-cols-2 gap-2 list-disc list-inside'>
        {tools.map((t) => (
          // ✨ Removed the manual '•' character from here
          <li key={t} className='rounded-lg bg-secondary px-3 py-2 text-sm'>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
