import type { ConversationTurn } from '../types'

export const conversationSeed: ConversationTurn[] = [
  {
    id: 'ct1',
    speaker: 'soba',
    text: 'Hi Nara. I am here whenever you want to start. There is no right way to begin.',
    time: '19:02',
  },
  {
    id: 'ct2',
    speaker: 'user',
    text: 'I have been feeling really overwhelmed today.',
    time: '19:03',
  },
  {
    id: 'ct3',
    speaker: 'soba',
    text: 'That sounds like a lot to carry. Would you like to talk about what made today feel especially heavy, or would you rather slow things down first?',
    time: '19:03',
  },
]

export const suggestedPrompts = [
  'I have been feeling really overwhelmed today.',
  'I could not sleep again last night.',
  'I have a presentation tomorrow and I am dreading it.',
  'Nothing bad happened, I just feel flat.',
]

export const safetyTriggerPhrase = 'I do not want to be here anymore.'

export const safetyResponse =
  'Thank you for telling me that. I want to make sure you are not carrying this alone right now. I am not able to be the only support here, and I would rather help you reach someone who can be with you properly.'

export const sobaReplies = [
  'I hear you. Can you say a little more about what that felt like?',
  'That makes sense given everything you have described. What part of it is sitting heaviest right now?',
  'Thank you for saying that out loud. You do not have to have it figured out here.',
  'It sounds like today asked a lot of you. Would it help to slow down for a moment before we keep going?',
  'I am listening. Take whatever time you need.',
]

export const pastSessions = [
  { id: 's1', title: 'Evening conversation', date: '8 Sep 2026', duration: '14 min', saved: true },
  { id: 's2', title: 'Short check-in', date: '6 Sep 2026', duration: '6 min', saved: true },
  { id: 's3', title: 'Late night talk', date: '28 Aug 2026', duration: '21 min', saved: false },
]
