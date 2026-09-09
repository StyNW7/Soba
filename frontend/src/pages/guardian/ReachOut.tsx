import { useState } from 'react'
import { Copy, MessageCircle, PhoneCall, Video } from 'lucide-react'
import { PageHeader } from '../../components/ui/Feedback'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Field'
import { cn } from '../../lib/cn'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const openers = [
  'You don’t have to explain everything. I just wanted to check in and let you know I’m here.',
  'No agenda, no questions. I just wanted to say hello and see how your week has been.',
  'I have been thinking about you. Would you want company later, even if we don’t talk about anything in particular?',
]

const channels = [
  { key: 'call', icon: PhoneCall, title: 'Call', detail: 'Opens your phone app. Soba does not place the call.' },
  { key: 'message', icon: MessageCircle, title: 'Message', detail: 'Opens your messaging app with the text you choose.' },
  { key: 'video', icon: Video, title: 'Video call', detail: 'Opens your usual video app. Nothing is recorded.' },
]

export default function ReachOut() {
  const { user } = useAuth()
  const { toast } = useToast()
  const subject = user?.subjectName ?? 'Nara'
  const [channel, setChannel] = useState('message')
  const [message, setMessage] = useState(openers[0])

  return (
    <>
      <PageHeader
        title="Reach Out"
        description={`Ways to contact ${subject}. Everything here opens your own apps, so the conversation stays between you.`}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          {channels.map((item) => {
            const active = channel === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setChannel(item.key)}
                aria-pressed={active}
                className={cn(
                  'w-full rounded-3xl border p-5 text-left transition-all duration-200',
                  active
                    ? 'border-apricot bg-apricot-soft/50 shadow-soft'
                    : 'border-line bg-surface hover:border-apricot/40 hover:bg-cream/40',
                )}
              >
                <div className="flex items-start gap-3.5">
                  <span
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors',
                      active ? 'bg-apricot text-white' : 'bg-cream text-brown',
                    )}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-brown-dark">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{item.detail}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <Card padding="lg">
          <h2 className="text-[17px] font-semibold tracking-headline text-brown-dark">
            {channel === 'message' ? 'What you might say' : 'Before you start'}
          </h2>
          <p className="mt-1 text-sm text-ink-secondary">
            A suggestion, not medical advice. Change anything that does not sound like you.
          </p>

          <div className="mt-5 space-y-2.5">
            {openers.map((opener) => (
              <button
                key={opener}
                type="button"
                onClick={() => setMessage(opener)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3.5 text-left text-sm leading-relaxed transition-colors',
                  message === opener
                    ? 'border-apricot/40 bg-cream text-brown-dark'
                    : 'border-line bg-muted/40 text-ink-secondary hover:bg-cream/60',
                )}
              >
                {opener}
              </button>
            ))}
          </div>

          <div className="mt-5">
            <Textarea
              label="Your message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={600}
            />
          </div>

          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <Button
              fullWidth
              onClick={() =>
                toast(
                  channel === 'call'
                    ? `Opening your phone to call ${subject}`
                    : channel === 'video'
                      ? 'Opening your video app'
                      : `Opening a message to ${subject}`,
                  { tone: 'info' },
                )
              }
            >
              {channel === 'call' ? 'Open phone' : channel === 'video' ? 'Open video call' : 'Open message'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard?.writeText(message)
                toast('Copied to clipboard')
              }}
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy
            </Button>
          </div>

          <p className="mt-5 rounded-2xl bg-muted px-4 py-3 text-xs leading-relaxed text-ink-secondary">
            Soba does not send this for you and does not attach any wellbeing information. What you
            write here is only ever seen by {subject}.
          </p>
        </Card>
      </div>

      <Card tone="cream" padding="lg" className="mt-5">
        <h2 className="text-base font-semibold text-brown-dark">If the conversation gets difficult</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            'Stay calm and let silences sit. They are not a failure.',
            'Ask what would help rather than offering a solution first.',
            'It is fine to say you do not know what to say.',
            'If there is immediate danger, contact emergency services on 112.',
          ].map((tip) => (
            <li key={tip} className="rounded-2xl bg-surface px-4 py-3.5 text-sm leading-relaxed text-ink-secondary">
              {tip}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
