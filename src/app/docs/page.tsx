import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DocsPage() {
  return (
    <div className='container mx-auto max-w-3xl py-12 px-4'>
      <Card>
        <CardHeader className='text-center'>
          <CardTitle className='text-3xl font-bold tracking-tight'>
            Documentation
          </CardTitle>
          <CardDescription>
            How to use the Cloudinary MCP Chat application.
          </CardDescription>
        </CardHeader>

        <CardContent className='space-y-8 text-muted-foreground'>
          {/* Basic Commands Section */}
          <div className='space-y-4'>
            <h2 className='text-xl font-semibold text-foreground'>
              Basic Commands
            </h2>
            <p>
              You can interact with the assistant by typing commands in plain
              English.
            </p>
            <ul className='space-y-3'>
              <li>
                <code className='rounded bg-secondary px-2 py-1 text-secondary-foreground'>
                  list images
                </code>
                <p className='pl-4 pt-1'>
                  Shows a list of the most recent images in your Cloudinary
                  account. Aliases like `show images` or `show me my photos`
                  also work.
                </p>
              </li>
              <li>
                <code className='rounded bg-secondary px-2 py-1 text-secondary-foreground'>
                  hello
                </code>
                <p className='pl-4 pt-1'>
                  Any general greeting will prompt the assistant to return a
                  list of all available tools it can use.
                </p>
              </li>
            </ul>
          </div>

          {/* Asset Management Section */}
          <div className='space-y-4'>
            <h2 className='text-xl font-semibold text-foreground'>
              Asset Management
            </h2>

            <div>
              <h3 className='font-semibold text-foreground'>
                Uploading an Image
              </h3>
              <p>
                Click the paperclip icon (📎) in the chat input to open a file
                selector. Choose an image to upload it directly to the
                `chat_uploads` folder in your Cloudinary account.
              </p>
            </div>

            <div>
              <h3 className='font-semibold text-foreground'>
                Renaming an Asset (Direct)
              </h3>
              <p>
                You can rename any asset by specifying its current `public_id`
                and the desired new `public_id`.
              </p>
              <p className='mt-1'>
                <strong>Format:</strong>{' '}
                <code className='text-xs'>
                  rename [old_public_id] to [new_public_id]
                </code>
              </p>
              <p className='mt-1'>
                <strong>Example:</strong>{' '}
                <code className='text-xs'>
                  rename chat_uploads/image1 to chat_uploads/new_image_name
                </code>
              </p>
            </div>

            <div>
              <h3 className='font-semibold text-foreground'>
                Renaming an Asset (Contextual)
              </h3>
              <p>
                After listing or uploading an image, the chat will &quot;remember&quot;
                it. You can then refer to it as &quot;the above image&quot;.
              </p>
              <p className='mt-1'>
                <strong>Format:</strong>{' '}
                <code className='text-xs'>
                  rename the above image to [new_name]
                </code>
              </p>
              <p className='mt-1'>
                <strong>Example:</strong>{' '}
                <code className='text-xs'>
                  rename the above image to my_favourite_photo
                </code>
              </p>
            </div>
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
