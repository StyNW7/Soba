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

export const supportTriggerPhrase = 'I can feel my chest getting tight and I cannot slow down.'

export const safetyResponse =
  'Thank you for telling me that. I want to make sure you are not carrying this alone right now. I am not able to be the only support here, and I would rather help you reach someone who can be with you properly.'

export const supportResponse =
  'That sounds like a lot happening in your body at once. Before we keep talking, would it help to slow your breathing with me for two minutes? We can come back to the rest afterwards.'

/** Markers that move the conversation into Support Mode (F3). */
export const supportMarkers = [
  'cannot breathe',
  'can not breathe',
  'chest',
  'panic',
  'shaking',
  'cannot slow down',
  'racing',
  'heart is pounding',
  'overwhelmed',
]

/** Markers that move the conversation into Safety Mode (F3). */
export const riskMarkers = [
  'do not want to be here',
  "don't want to be here",
  'want to die',
  'end my life',
  'hurt myself',
  'no reason to go on',
  'not worth being here',
]

/** Replies weighted toward listening, used when listen-first is enabled. */
export const listeningReplies = [
  'I hear you. Can you say a little more about what that felt like?',
  'Thank you for saying that out loud. You do not have to have it figured out here.',
  'I am listening. Take whatever time you need.',
  'That makes sense given everything you have described. What part of it is sitting heaviest right now?',
]

/** Replies that offer a next step, used when suggestions are preferred. */
export const suggestingReplies = [
  'It sounds like today asked a lot of you. Would it help to slow down for a moment before we keep going?',
  'That is worth putting somewhere you can come back to. Would you like to keep a reflection at the end?',
  'One thing that sometimes helps here is naming the smallest next step. Does anything come to mind?',
  'Would it help to try a short grounding exercise, or would you rather keep talking?',
]

export const pastSessions = [
  { id: 's1', title: 'Evening conversation', date: '8 Sep 2026', duration: '14 min', saved: true },
  { id: 's2', title: 'Short check-in', date: '6 Sep 2026', duration: '6 min', saved: true },
  { id: 's3', title: 'Late night talk', date: '28 Aug 2026', duration: '21 min', saved: false },
]
