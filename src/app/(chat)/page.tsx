import { Card } from '@/components/ui/card';
import { ChatContainer } from '@/components/chat/chat-container';

export default function Page() {
  return (
    <div className='grid gap-6'>
      <section className='text-center'>
        <h1 className='text-2xl font-semibold tracking-tight'>
          Cloudinary MCP Chat
        </h1>
        <p className='text-sm text-muted-foreground'>
          Demo chat. Clean, fast, responsive.
        </p>
      </section>

      {/* add overflow-hidden so the chat never spills out */}
      <Card className='mx-auto w-full max-w-3xl overflow-hidden p-0'>
        <ChatContainer />
      </Card>
    </div>
  );
}
