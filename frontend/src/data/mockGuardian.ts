import type { CoachModule, SafetyAlert } from '../types'

export const guardianTrend = [
  { date: 'Mon', score: 72 },
  { date: 'Tue', score: 64 },
  { date: 'Wed', score: 61 },
  { date: 'Thu', score: 58 },
  { date: 'Fri', score: 70 },
  { date: 'Sat', score: 76 },
  { date: 'Sun', score: 69 },
]

export const guardianMonthlyTrend = [
  { week: 'Week 1', score: 66 },
  { week: 'Week 2', score: 71 },
  { week: 'Week 3', score: 63 },
  { week: 'Week 4', score: 69 },
]

export const guardianCheckins = [
  { day: 'Mon', count: 1 },
  { day: 'Tue', count: 1 },
  { day: 'Wed', count: 0 },
  { day: 'Thu', count: 1 },
  { day: 'Fri', count: 1 },
  { day: 'Sat', count: 0 },
  { day: 'Sun', count: 1 },
]

export const safetyAlerts: SafetyAlert[] = [
  {
    id: 'a1',
    date: '2 Sep 2026',
    isoDate: '2026-09-02',
    title: 'Elevated distress signal',
    description:
      'Soba detected a period of elevated distress and suggested reaching out. No conversation content is shared.',
    severity: 'elevated',
    status: 'resolved',
  },
  {
    id: 'a2',
    date: '21 Aug 2026',
    isoDate: '2026-08-21',
    title: 'Connection suggested',
    description: 'Soba recommended a check-in after several difficult days in a row.',
    severity: 'info',
    status: 'resolved',
  },
  {
    id: 'a3',
    date: '4 Aug 2026',
    isoDate: '2026-08-04',
    title: 'Connection suggested',
    description: 'A gentle prompt was sent recommending a conversation this week.',
    severity: 'info',
    status: 'resolved',
  },
]

export const coachModules: CoachModule[] = [
  {
    id: 'cm1',
    title: 'Starting a Conversation',
    duration: '5 min read',
    category: 'Starting a Conversation',
    summary: 'How to open a conversation without making it feel like an interrogation.',
    body: [
      'Openings matter more than the questions that follow. A conversation that begins with an accusation rarely recovers.',
      'Choose a moment where neither of you has to hold eye contact the whole time. A car ride, a walk, or cooking together often works better than sitting across a table.',
      'Try naming what you noticed rather than what you concluded. "You have seemed quieter this week" invites a response. "What is wrong with you lately" closes one.',
    ],
  },
  {
    id: 'cm2',
    title: 'Listening Without Fixing',
    duration: '6 min read',
    category: 'Listening Without Fixing',
    summary: 'Why the urge to solve can end a conversation earlier than you intended.',
    body: [
      'When someone shares something painful, the instinct to solve it is an act of love. It can also be experienced as being rushed past.',
      'Before offering a solution, ask whether they want help thinking it through or just want to be heard. Both answers are valid.',
      'Silence after someone speaks is not a failure of the conversation. It is often where the real thing gets said.',
    ],
  },
  {
    id: 'cm3',
    title: 'When They Do Not Want to Talk',
    duration: '4 min read',
    category: 'When They Do Not Want to Talk',
    summary: 'Staying available without applying pressure.',
    body: [
      'A closed door today is not a permanent answer. Repeated pressure usually makes the door heavier.',
      'Say clearly that you are available, then let it rest. "I am not going to push. When you want to talk, I am here" does more than five follow-up questions.',
      'Keep ordinary contact going. Shared routines often reopen conversation more reliably than direct questions.',
    ],
  },
  {
    id: 'cm4',
    title: 'Responding to Distress',
    duration: '7 min read',
    category: 'Responding to Distress',
    summary: 'What to do first when something feels serious.',
    body: [
      'Stay calm and stay present. Your steadiness gives them something to hold onto.',
      'Ask directly and without euphemism whether they are safe right now. Direct questions do not create risk; they open a door.',
      'If there is immediate danger, contact emergency services. Soba is not an emergency service and does not replace one.',
    ],
  },
  {
    id: 'cm5',
    title: 'Supporting Without Invading Privacy',
    duration: '5 min read',
    category: 'Supporting Without Invading Privacy',
    summary: 'Why access to everything usually costs you access to anything.',
    body: [
      'Privacy is not the opposite of safety. For young people it is often the precondition for honesty.',
      'Soba shares wellbeing patterns and safety signals with you, never the private conversation itself. That boundary is what makes the conversation possible.',
      'If you learn something through a pattern rather than a conversation, name the pattern, not the surveillance.',
    ],
  },
  {
    id: 'cm6',
    title: 'Encouraging Professional Help',
    duration: '6 min read',
    category: 'Encouraging Professional Help',
    summary: 'How to raise professional support without it sounding like a verdict.',
    body: [
      'Frame professional support as added capacity, not as evidence that something is broken.',
      'Offer to handle the logistics. The administrative weight of booking is often the real barrier.',
      'Let them keep control over the choice of professional wherever possible.',
    ],
  },
]

export const guardianConnectionStatus = [
  { label: 'Primary Guardian', value: 'Maria (Mother)', status: 'active' as const },
  { label: 'Secondary Trusted Contact', value: 'Daniel (Brother)', status: 'active' as const },
  { label: 'Professional Support', value: 'Not currently shared', status: 'not-shared' as const },
  { label: 'Safety Plan', value: 'Created by Nara, sharing enabled', status: 'active' as const },
]

export const guardianConsent = [
  { scope: 'Wellbeing pulse', shared: true, description: 'A high-level view of how the week has felt overall.' },
  { scope: 'Mood trend', shared: true, description: 'Aggregated mood direction over time. No topics or entries.' },
  { scope: 'Safety alerts', shared: true, description: 'Notifications when Soba detects a serious wellbeing signal.' },
  { scope: 'Journal entries', shared: false, description: 'Private reflections. Never shared by default.' },
  { scope: 'Conversation transcripts', shared: false, description: 'Private conversations. Never shared by default.' },
]
