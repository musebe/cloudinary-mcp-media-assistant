export function Footer() {
  return (
    <footer className='border-t'>
      <div className='mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground'>
        <div className='flex flex-col items-center justify-between gap-2 md:flex-row'>
          <p>&copy; {new Date().getFullYear()} Cloudinary MCP Chat</p>
          <p className='text-xs'>Demo app using Next.js 15.5 and shadcn/ui</p>
        </div>
      </div>
    </footer>
  );
}
