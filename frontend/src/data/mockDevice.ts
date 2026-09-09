import type { MemoryItem, SobaDevice } from '../types'

export const sobaDevice: SobaDevice = {
  id: 'dev_bedroom',
  name: 'Soba Bedroom',
  status: 'connected',
  battery: 82,
  wifi: 'Rumah-2.4G',
  lastSync: 'Today, 08:14',
  firmware: '1.4.2',
  firmwareUpdatedAt: '28 Aug 2026',
  micEnabled: true,
  volume: 55,
  listeningMode: 'push-to-talk',
  hapticGuidance: true,
  nightMode: false,
  voicePersonality: 'calm',
}

export const deviceActivity = [
  { id: 'd1', event: 'Conversation session', detail: '12 minutes', time: 'Today, 07:52' },
  { id: 'd2', event: 'Memory sync', detail: '2 items reviewed', time: 'Today, 08:14' },
  { id: 'd3', event: 'Grounding guidance', detail: 'Slow breathing', time: 'Yesterday, 22:31' },
  { id: 'd4', event: 'Firmware check', detail: 'Up to date', time: '28 Aug, 09:05' },
]

export const memoryItems: MemoryItem[] = [
  { id: 'mem1', text: 'Presentation on Thursday', category: 'context', createdAt: '6 Sep 2026' },
  {
    id: 'mem2',
    text: 'Prefers to be listened to before receiving suggestions',
    category: 'preference',
    createdAt: '20 Aug 2026',
  },
  { id: 'mem3', text: 'Studies late in the evening on weekdays', category: 'routine', createdAt: '14 Aug 2026' },
  { id: 'mem4', text: 'Finds slow breathing more helpful than counting', category: 'preference', createdAt: '2 Aug 2026' },
]
