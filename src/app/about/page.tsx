import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AboutPage() {
  return (
    // Main container to center the content on the page
    <div className='container mx-auto max-w-3xl py-12 px-4'>
      <Card>
        <CardHeader className='text-center'>
          <CardTitle className='text-3xl font-bold tracking-tight'>
            About Cloudinary MCP Chat
          </CardTitle>
          <CardDescription>
            A demo application for interacting with the Cloudinary API using
            natural language.
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-8 text-muted-foreground'>
          {/* Introduction Section */}
          <div className='space-y-4'>
            <h2 className='text-xl font-semibold text-foreground'>
              What is this?
            </h2>
            <p>
              This project is a proof-of-concept demonstrating the power of the{' '}
              <strong>Cloudinary Media Control Plane (MCP)</strong>. Instead of
              writing complex API calls, you can manage your media assets by
              simply talking to a chat assistant.
            </p>
            <p>
              You can ask it to perform tasks like listing your latest images,
              uploading new ones, and even renaming assets directly from the
              chat interface.
            </p>
          </div>

          {/* Technology Stack Section */}
          <div className='space-y-4'>
            <h2 className='text-xl font-semibold text-foreground'>
              Technology Stack
            </h2>
            <p>
              This application was built with a modern, server-centric approach
              using the following technologies:
            </p>
            <ul className='list-disc list-inside space-y-2'>
              <li>
                <strong>Next.js:</strong> For the full-stack React framework.
              </li>
              <li>
                <strong>Server Actions:</strong> To handle all backend logic
                without creating separate API routes.
              </li>
              <li>
                <strong>React Hooks:</strong> Using `useActionState` and
                `useOptimistic` for advanced, real-time UI state management.
              </li>
              <li>
                <strong>Cloudinary MCP:</strong> The core AI engine that
                translates natural language into Cloudinary API calls.
              </li>
              <li>
                <strong>Tailwind CSS & shadcn/ui:</strong> For a clean,
                responsive, and accessible design system.
              </li>
            </ul>
          </div>

          {/* Back to Chat Button */}
          <div className='text-center pt-4'>
            <Button asChild>
              <Link href='/'>Back to the Chat</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
