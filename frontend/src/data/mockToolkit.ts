import type { ToolkitActivity } from '../types'

export const toolkitActivities: ToolkitActivity[] = [
  {
    id: 't1',
    title: '5-4-3-2-1 Grounding',
    category: 'Grounding',
    durationMinutes: 4,
    description:
      'Bring attention back to the room by naming what you can notice through each of your senses.',
    steps: [
      { title: 'Five things you can see', instruction: 'Look around and name five things you can see. Take your time with each one.', seconds: 50 },
      { title: 'Four things you can feel', instruction: 'Notice four things touching you right now. The chair, your clothes, the floor.', seconds: 45 },
      { title: 'Three things you can hear', instruction: 'Listen for three separate sounds, near or far.', seconds: 40 },
      { title: 'Two things you can smell', instruction: 'Notice two scents. If there are none, name two you like.', seconds: 35 },
      { title: 'One thing you can taste', instruction: 'Notice one taste, or take a sip of water.', seconds: 30 },
    ],
  },
  {
    id: 't2',
    title: '2-Minute Slow Breathing',
    category: 'Breathing',
    durationMinutes: 2,
    description: 'A short paced breathing sequence to let your body settle before you continue.',
    steps: [
      { title: 'Settle', instruction: 'Let your shoulders drop. There is nothing to get right here.', seconds: 20 },
      { title: 'Breathe in', instruction: 'In through your nose for four counts.', seconds: 30 },
      { title: 'Hold gently', instruction: 'Pause for two counts, without straining.', seconds: 25 },
      { title: 'Breathe out', instruction: 'Out slowly for six counts. Repeat at your own pace.', seconds: 45 },
    ],
  },
  {
    id: 't3',
    title: 'Pause & Notice',
    category: 'Reflection',
    durationMinutes: 3,
    description: 'A brief reflective pause to name what you are carrying right now, without solving it.',
    steps: [
      { title: 'Name it', instruction: 'What is the feeling closest to the surface right now?', seconds: 45 },
      { title: 'Locate it', instruction: 'Where do you notice it in your body?', seconds: 45 },
      { title: 'Let it be', instruction: 'You do not need to fix it. Just let it be there for a moment.', seconds: 60 },
    ],
  },
  {
    id: 't4',
    title: 'Evening Reset',
    category: 'Wind Down',
    durationMinutes: 6,
    description: 'A slower sequence for the end of the day, when the mind keeps replaying things.',
    steps: [
      { title: 'Close the day', instruction: 'Name one thing that happened today. Not the best or worst, just one thing.', seconds: 60 },
      { title: 'Release the loop', instruction: 'If a conversation keeps replaying, say to yourself: this can wait until tomorrow.', seconds: 90 },
      { title: 'Soften', instruction: 'Slow your breathing. Let the exhale be longer than the inhale.', seconds: 120 },
      { title: 'Rest', instruction: 'Let your attention rest wherever it wants to go.', seconds: 90 },
    ],
  },
  {
    id: 't5',
    title: 'Before Something Difficult',
    category: 'Mindful Break',
    durationMinutes: 3,
    description: 'A short preparation for a moment you are dreading, whether it is a talk, a test, or a call.',
    steps: [
      { title: 'Feet on the ground', instruction: 'Press both feet into the floor. Notice the support underneath you.', seconds: 40 },
      { title: 'One breath at a time', instruction: 'You only have to get through the next breath, not the whole thing.', seconds: 60 },
      { title: 'What is already done', instruction: 'Name one thing you have already prepared or already survived.', seconds: 60 },
    ],
  },
  {
    id: 't6',
    title: 'Morning Check-in',
    category: 'Reflection',
    durationMinutes: 2,
    description: 'A gentle way to notice how you are arriving at the day before it fills up.',
    steps: [
      { title: 'How am I arriving', instruction: 'Before anything else, notice how you feel right now.', seconds: 45 },
      { title: 'One kind thing', instruction: 'Name one small thing you can do for yourself today.', seconds: 45 },
      { title: 'Set the pace', instruction: 'Choose one word for how you want to move through today.', seconds: 30 },
    ],
  },
]

export const toolkitCategories = [
  'All',
  'Grounding',
  'Breathing',
  'Reflection',
  'Wind Down',
  'Mindful Break',
] as const
