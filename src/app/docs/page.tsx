import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Responsive command row
function CommandEntry({
  command,
  children,
}: {
  command: string;
  children: React.ReactNode;
}) {
  return (
    <div className='grid grid-cols-1 sm:[grid-template-columns:auto_1fr] items-start gap-2 sm:gap-x-6'>
      <code className='inline-block max-w-full overflow-x-auto whitespace-nowrap rounded bg-secondary px-2 py-1 text-xs sm:text-sm font-semibold text-secondary-foreground'>
        {command}
      </code>
      <div className='min-w-0 text-sm text-muted-foreground'>{children}</div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className='container mx-auto max-w-4xl py-12 px-4'>
      {/* Main card owns height. Header/footer fixed. Body scrolls. */}
      <Card className='relative flex h-[85vh] min-h-0 max-h-[85vh] flex-col overflow-hidden'>
        <CardHeader className='shrink-0 border-b text-center'>
          <CardTitle className='text-3xl font-bold tracking-tight'>
            Documentation
          </CardTitle>
          <CardDescription>
            How to use the Cloudinary MCP Chat application.
          </CardDescription>
        </CardHeader>

        {/* Body scroll area */}
        <div className='flex-1 min-h-0'>
          <ScrollArea className='h-full'>
            <CardContent className='p-4 sm:p-6 lg:p-8'>
              <div className='space-y-8'>
                {/* Basic Commands */}
                <section className='space-y-4'>
                  <h2 className='text-xl font-semibold text-foreground'>
                    Basic Commands
                  </h2>
                  <div className='space-y-4 rounded-lg border bg-card/50 p-4 sm:p-6'>
                    <CommandEntry command='list images'>
                      <p>
                        Shows recent images in your Cloudinary account. Aliases
                        like <code>show images</code> also work.
                      </p>
                    </CommandEntry>
                    <CommandEntry command='hello'>
                      <p>Returns a list of available tools.</p>
                    </CommandEntry>
                  </div>
                </section>

                {/* Asset Management */}
                <section className='space-y-4'>
                  <h2 className='text-xl font-semibold text-foreground'>
                    Asset Management
                  </h2>
                  <div className='space-y-4 rounded-lg border bg-card/50 p-4 sm:p-6'>
                    <div>
                      <h3 className='font-semibold text-foreground'>
                        Uploading an Image
                      </h3>
                      <p className='text-sm text-muted-foreground'>
                        Click the paperclip icon in the chat input. Files upload
                        to the <code>chat_uploads</code> folder.
                      </p>
                    </div>

                    <hr />

                    <CommandEntry command='rename [old] to [new]'>
                      <p>
                        Renames an asset. Needs the full <code>public_id</code>.
                      </p>
                      <p className='mt-1 text-xs'>
                        <strong>Example:</strong>{' '}
                        <code>
                          rename chat_uploads/image1 to photos/new_name
                        </code>
                      </p>
                    </CommandEntry>

                    <CommandEntry command='rename the above image to [new]'>
                      <p>Renames the last image shown in chat.</p>
                      <p className='mt-1 text-xs'>
                        <strong>Example:</strong>{' '}
                        <code>
                          rename the above image to my-favourite-photo
                        </code>
                      </p>
                    </CommandEntry>

                    <hr />

                    <CommandEntry command='delete [public_id]'>
                      <p>
                        Deletes an asset by its full <code>public_id</code>.
                      </p>
                      <p className='mt-1 text-xs'>
                        <strong>Example:</strong>{' '}
                        <code>delete photos/new_name</code>
                      </p>
                    </CommandEntry>

                    <CommandEntry command='delete the above image'>
                      <p>Deletes the last image shown in chat.</p>
                    </CommandEntry>

                    <hr />

                    <CommandEntry command='tag [id] with [tags]'>
                      <p>Add tags. Use commas or spaces.</p>
                      <p className='mt-1 text-xs'>
                        <strong>Example:</strong>{' '}
                        <code>tag my-favourite-photo with summer, beach</code>
                      </p>
                    </CommandEntry>

                    <CommandEntry command='tag the above image with [tags]'>
                      <p>Tags the last image shown in chat.</p>
                      <p className='mt-1 text-xs'>
                        <strong>Example:</strong>{' '}
                        <code>tag the above image with event, 2025</code>
                      </p>
                    </CommandEntry>
                  </div>
                </section>

                {/* Folder Management */}
                <section className='space-y-4'>
                  <h2 className='text-xl font-semibold text-foreground'>
                    Folder Management
                  </h2>
                  <div className='space-y-4 rounded-lg border bg-card/50 p-4 sm:p-6'>
                    <CommandEntry command='create folder [path]'>
                      <p>Creates a folder. Nested paths allowed.</p>
                      <p className='mt-1 text-xs'>
                        <strong>Example:</strong>{' '}
                        <code>create folder campaigns/summer-2025</code>
                      </p>
                    </CommandEntry>

                    <CommandEntry command='move [id] to [folder]'>
                      <p>Moves an asset by renaming it to that folder.</p>
                      <p className='mt-1 text-xs'>
                        <strong>Example:</strong>{' '}
                        <code>
                          move my-favourite-photo to campaigns/summer-2025
                        </code>
                      </p>
                    </CommandEntry>

                    <CommandEntry command='move the above image to [folder]'>
                      <p>Moves the last image to a folder.</p>
                      <p className='mt-1 text-xs'>
                        <strong>Example:</strong>{' '}
                        <code>move the above image to archived/2024</code>
                      </p>
                    </CommandEntry>
                  </div>
                </section>

                {/* Tips Section */}
                <section className='space-y-4'>
                  <h2 className='text-xl font-semibold text-foreground'>
                    General Tips
                  </h2>
                  <div className='rounded-lg border bg-card/50 p-4 sm:p-6'>
                    <ul className='list-disc space-y-2 pl-6 text-sm'>
                      <li>
                        Use folder paths with slashes, for example{' '}
                        <code>folder/subfolder/name</code>.
                      </li>
                      <li>Public IDs do not include file extensions.</li>
                      <li>
                        Avoid spaces in IDs and folders. Use hyphens or
                        underscores.
                      </li>
                      <li>Tags can be separated by commas or spaces.</li>
                      <li>
                        The chat remembers the last asset for contextual
                        commands.
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Spacer so last item is not hidden by footer */}
                <div className='pb-4' />
              </div>
            </CardContent>
            <ScrollBar orientation='vertical' />
          </ScrollArea>
        </div>

        {/* Centered button inside the card */}
        <CardFooter className='shrink-0 border-t p-4'>
          <div className='mx-auto'>
            <Button asChild>
              <Link href='/'>Back to the Chat</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
