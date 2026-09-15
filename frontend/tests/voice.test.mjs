import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { VoiceConnection } from '../src/api/voice.ts'
import { resetSession } from '../src/api/client.ts'
let contexts, socket, worklet, stopped, microphoneCalls
const events = new EventTarget()
globalThis.window = {
  location: { origin: 'http://localhost:5174' },
  dispatchEvent: (e) => events.dispatchEvent(e),
  setTimeout,
  clearTimeout,
}
class TestAudioContext {
  constructor({ sampleRate }) {
    this.sampleRate = sampleRate
    this.state = 'running'
    this.currentTime = 0
    this.destination = {}
    this.audioWorklet = { addModule: async () => {} }
    contexts.push(this)
  }
  async resume() {}
  async close() {
    this.state = 'closed'
  }
  createMediaStreamSource() {
    return { connect() {} }
  }
  createBuffer(channels, count) {
    return {
      duration: count / 24000,
      getChannelData: () => new Float32Array(count),
    }
  }
  createBufferSource() {
    return { connect() {}, start() {}, stop() {} }
  }
}
class TestWorklet {
  constructor() {
    this.port = { postMessage() {}, onmessage: null }
    worklet = this
  }
  connect() {}
  disconnect() {}
}
class TestSocket {
  static OPEN = 1
  constructor() {
    this.readyState = 1
    this.sent = []
    this.bufferedAmount = 0
    socket = this
  }
  send(value) {
    this.sent.push(value)
  }
  close() {
    this.readyState = 3
  }
  event(value) {
    this.onmessage({ data: JSON.stringify(value) })
  }
}
beforeEach(() => {
  contexts = []
  stopped = 0
  microphoneCalls = 0
  resetSession()
  globalThis.AudioContext = TestAudioContext
  globalThis.AudioWorkletNode = TestWorklet
  globalThis.WebSocket = TestSocket
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          microphoneCalls++
          return {
            getTracks: () => [
              {
                stop() {
                  stopped++
                },
              },
            ],
          }
        },
      },
    },
  })
  globalThis.fetch = async (path) =>
    new Response(
      JSON.stringify(
        path.endsWith('/csrf')
          ? { token: 'csrf' }
          : { ticket: 'one-use-ticket', websocket_path: '/v1/voice' },
      ),
      { headers: { 'Content-Type': 'application/json' } },
    )
})
test('unavailable provider fails before microphone permission or capture', async () => {
  globalThis.fetch = async (path) =>
    new Response(
      JSON.stringify(
        path.endsWith('/csrf')
          ? { token: 'csrf' }
          : { code: 'dependency_unavailable', message: 'Voice unavailable' },
      ),
      {
        status: path.endsWith('/csrf') ? 200 : 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  const states = []
  const voice = new VoiceConnection(
    (...s) => states.push(s),
    () => {},
    () => {},
  )
  await voice.start('personal')
  assert.equal(microphoneCalls, 0)
  assert.equal(states.at(-1)[0], 'closed')
  assert.ok(contexts.every((c) => c.state === 'closed'))
})
test('ticket stays in the handshake and PCM is sent only after input.ready', async () => {
  const voice = new VoiceConnection(
    () => {},
    () => {},
    () => {},
  )
  await voice.start('personal')
  socket.onopen()
  const start = JSON.parse(socket.sent[0])
  assert.equal(start.type, 'session.start')
  assert.equal(start.ticket, 'one-use-ticket')
  assert.equal(start.sample_rate, 16000)
  worklet.port.onmessage({ data: new Int16Array(320).buffer })
  assert.equal(socket.sent.length, 1)
  socket.event({ type: 'session.ready', session_id: 'session' })
  voice.beginTurn()
  socket.event({ type: 'input.ready', turn_id: 'turn' })
  const samples = new Int16Array(320)
  samples[0] = -1234
  worklet.port.onmessage({ data: samples.buffer })
  const frame = socket.sent.at(-1)
  assert.equal(frame.byteLength, 644)
  assert.equal(new DataView(frame).getUint32(0), 1)
  assert.equal(new DataView(frame).getInt16(4, true), -1234)
  voice.endTurn()
  assert.equal(JSON.parse(socket.sent.at(-1)).last_sequence, 1)
  voice.close()
  assert.equal(stopped, 1)
})
test('late microphone permission is cleaned up after the page closes', async () => {
  let grant
  const permission = new Promise((resolve) => (grant = resolve))
  navigator.mediaDevices.getUserMedia = () => permission
  const voice = new VoiceConnection(
    () => {},
    () => {},
    () => {},
  )
  const start = voice.start('personal')
  await new Promise((resolve) => setImmediate(resolve))
  voice.close()
  grant({
    getTracks: () => [
      {
        stop() {
          stopped++
        },
      },
    ],
  })
  await start
  assert.equal(stopped, 1)
  assert.ok(contexts.every((c) => c.state === 'closed'))
})
test('out-of-order playback stops the connection', async () => {
  const states = []
  const voice = new VoiceConnection(
    (s) => states.push(s),
    () => {},
    () => {},
  )
  await voice.start('personal')
  socket.event({ type: 'response.start', response_sequence: 1 })
  const frame = new ArrayBuffer(10)
  new DataView(frame).setUint32(0, 1)
  new DataView(frame).setUint32(4, 2)
  socket.onmessage({ data: frame })
  assert.equal(states.at(-1), 'closed')
  assert.equal(stopped, 1)
})
test('ending a session discards late playback and waits for the actual review', async () => {
  let reviewed = 0
  const states = []
  const voice = new VoiceConnection(
    (s) => states.push(s),
    () => {},
    () => reviewed++,
  )
  await voice.start('personal')
  socket.event({ type: 'session.ready', session_id: 'session' })
  voice.finish()
  socket.event({ type: 'response.end', status: 'complete' })
  socket.onmessage({ data: new ArrayBuffer(0) })
  assert.equal(states.at(-1), 'finishing')
  assert.equal(reviewed, 0)
  socket.event({ type: 'session.summary_ready' })
  assert.equal(reviewed, 1)
  assert.equal(states.at(-1), 'review')
  assert.equal(stopped, 1)
})

test('browser speech reads the approved reply and stops on close', async () => {
  let spoken, cancelled = 0
  window.speechSynthesis = { speak: (u) => { spoken = u }, cancel: () => { cancelled++ } }
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text } }
  const updates = []
  const voice = new VoiceConnection((...v) => updates.push(v), () => {}, () => {})
  await voice.start('private')
  socket.event({ type: 'response.end', status: 'complete', fallback_text: 'I hear you.' })
  assert.equal(spoken.text, 'I hear you.')
  assert.equal(spoken.lang, 'en-US')
  assert.equal(updates.at(-1)[0], 'speaking')
  voice.close()
  assert.equal(cancelled, 1)
  spoken.onend()
  assert.equal(updates.at(-1)[0], 'speaking')
  delete window.speechSynthesis
})

test('hands-free starts once and waits for actual playback before listening again', async () => {
  const voice = new VoiceConnection(() => {}, () => {}, () => {})
  await voice.start('personal')
  socket.event({ type: 'session.ready', session_id: 'session' })
  const starts = () => socket.sent.filter(v => typeof v === 'string' && JSON.parse(v).type === 'input.start').length
  assert.equal(starts(), 1)
  voice.beginTurn()
  assert.equal(starts(), 1)
  socket.event({ type: 'input.ready', turn_id: 'turn' })
  socket.event({ type: 'transcript.final', text: 'Hello' })
  socket.event({ type: 'response.start', response_sequence: 1 })
  let source
  contexts[1].createBufferSource = () => (source = { connect() {}, start() {}, stop() {} })
  const frame = new ArrayBuffer(488)
  new DataView(frame).setUint32(0, 1)
  socket.onmessage({ data: frame })
  socket.event({ type: 'response.end', status: 'complete' })
  await new Promise(resolve => setTimeout(resolve, 350))
  assert.equal(starts(), 1)
  const sent = socket.sent.length
  worklet.port.onmessage({ data: new Int16Array(320).buffer })
  assert.equal(socket.sent.length, sent)
  source.onended()
  await new Promise(resolve => setTimeout(resolve, 350))
  assert.equal(starts(), 2)
  voice.close()
})

test('mute survives input readiness and reply completion until explicitly unmuted', async () => {
  const track = { enabled: true, stop() {} }
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [track] })
  const voice = new VoiceConnection(() => {}, () => {}, () => {})
  await voice.start('personal')
  assert.equal(track.enabled, true)
  socket.event({ type: 'session.ready', session_id: 'session' })
  voice.setMuted(true)
  socket.event({ type: 'input.ready', turn_id: 'turn' })
  assert.equal(track.enabled, false)
  socket.event({ type: 'transcript.final', text: 'Hello' })
  socket.event({ type: 'response.end', status: 'complete' })
  await new Promise(resolve => setTimeout(resolve, 350))
  const starts = () => socket.sent.filter(v => typeof v === 'string' && JSON.parse(v).type === 'input.start').length
  assert.equal(starts(), 1)
  voice.setMuted(false)
  assert.equal(starts(), 2)
  assert.equal(track.enabled, true)
  socket.event({ type: 'input.ready', turn_id: 'next' })
  assert.equal(track.enabled, true)
  voice.close()
})

test('closing during the restart delay never starts another turn', async () => {
  const voice = new VoiceConnection(() => {}, () => {}, () => {})
  await voice.start('personal')
  socket.event({ type: 'session.ready', session_id: 'session' })
  socket.event({ type: 'input.ready', turn_id: 'turn' })
  socket.event({ type: 'transcript.final', text: 'Hello' })
  socket.event({ type: 'response.end', status: 'complete' })
  const sent = socket.sent.length
  voice.close()
  await new Promise(resolve => setTimeout(resolve, 350))
  assert.equal(socket.sent.length, sent)
})

test('a minute without speech ends the session and disables the microphone', async () => {
  const track = { enabled: true, stop() {} }
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [track] })
  const original = window.setTimeout
  let idle
  window.setTimeout = (callback, delay) => {
    if (delay === 60000) { idle = callback; return 0 }
    return original(callback, delay)
  }
  const voice = new VoiceConnection(() => {}, () => {}, () => {})
  try {
    await voice.start('personal')
    socket.event({ type: 'session.ready', session_id: 'session' })
    socket.event({ type: 'input.ready', turn_id: 'turn' })
    idle()
    assert.equal(track.enabled, false)
    assert.equal(JSON.parse(socket.sent.at(-1)).type, 'session.end')
  } finally {
    voice.close()
    window.setTimeout = original
  }
})

test('an empty transcript resumes listening without waiting for a reply', async () => {
  const voice = new VoiceConnection(() => {}, () => {}, () => {})
  await voice.start('personal')
  socket.event({ type: 'session.ready', session_id: 'session' })
  socket.event({ type: 'input.ready', turn_id: 'turn' })
  socket.event({ type: 'transcript.final', text: '' })
  await new Promise(resolve => setTimeout(resolve, 350))
  assert.equal(socket.sent.filter(v => typeof v === 'string' && JSON.parse(v).type === 'input.start').length, 2)
  voice.close()
})

test('speech during connection is buffered in order, then flushed before input.end', async () => {
 const voice = new VoiceConnection(()=>{},()=>{},()=>{})
 await voice.start('personal')
 socket.event({type:'session.ready',session_id:'s'})
 for(let i=1;i<=12;i++) worklet.port.onmessage({data:new Int16Array(320).fill(i).buffer})
 assert.equal(socket.sent.filter(x=>x instanceof ArrayBuffer).length,0)
 socket.event({type:'input.ready',turn_id:'t'})
 voice.endTurn()
 await new Promise(resolve=>setTimeout(resolve,100))
 const frames=socket.sent.filter(x=>x instanceof ArrayBuffer)
 assert.equal(frames.length,12)
 frames.forEach((x,i)=>{assert.equal(new DataView(x).getUint32(0),i);assert.equal(new DataView(x).getInt16(4,true),i+1)})
 assert.equal(JSON.parse(socket.sent.at(-1)).type,'input.end')
 assert.equal(JSON.parse(socket.sent.at(-1)).last_sequence,11)
 voice.close()
})

test('speech over a reply interrupts playback and reaches the next turn', async () => {
 const voice = new VoiceConnection(()=>{},()=>{},()=>{})
 await voice.start('personal')
 socket.event({type:'session.ready',session_id:'s'})
 socket.event({type:'input.ready',turn_id:'t',response_id:'reply'})
 socket.event({type:'transcript.final',text:'hello'})
 socket.event({type:'response.start',response_sequence:1})
 let stoppedPlayback=false
 contexts[1].createBufferSource=()=>({connect(){},start(){},stop(){stoppedPlayback=true}})
 const audio=new ArrayBuffer(488);new DataView(audio).setUint32(0,1)
 socket.onmessage({data:audio})
 for(let i=0;i<9;i++) worklet.port.onmessage({data:new Int16Array(320).fill(2000).buffer})
 assert.equal(stoppedPlayback,true)
 assert.ok(socket.sent.some(x=>typeof x==='string'&&JSON.parse(x).type==='response.cancel'&&JSON.parse(x).response_id==='reply'))
 assert.equal(socket.sent.filter(x=>x instanceof ArrayBuffer).length,0)
 socket.event({type:'response.end',status:'complete'})
 await new Promise(resolve=>setTimeout(resolve,350))
 socket.event({type:'input.ready',turn_id:'next'})
 await new Promise(resolve=>setTimeout(resolve,50))
 assert.equal(socket.sent.filter(x=>x instanceof ArrayBuffer).length,9)
 voice.close()
})

test('mute discards buffered speech and prevents interruption by queued microphone frames', async () => {
 const voice = new VoiceConnection(()=>{},()=>{},()=>{})
 await voice.start('personal')
 socket.event({type:'session.ready',session_id:'s'})
 worklet.port.onmessage({data:new Int16Array(320).fill(2000).buffer})
 voice.setMuted(true)
 socket.event({type:'input.ready',turn_id:'t'})
 worklet.port.onmessage({data:new Int16Array(320).fill(2000).buffer})
 const frames=socket.sent.filter(x=>x instanceof ArrayBuffer)
 assert.equal(frames.length,1)
 assert.equal(new DataView(frames[0]).getInt16(4,true),0)
 voice.close()
})

test('ninety seconds of audio can be retained and replayed after suspended playback', async () => {
  const states = []
  const voice = new VoiceConnection((s, m) => states.push([s, m]), () => {}, () => {})
  await voice.start('personal')
  socket.event({ type: 'response.start', response_sequence: 1 })
  for (let i = 0; i < 450; i++) {
    const frame = new ArrayBuffer(9608)
    new DataView(frame).setUint32(0, 1)
    new DataView(frame).setUint32(4, i)
    socket.onmessage({ data: frame })
  }
  assert.notEqual(states.at(-1)[0], 'closed')
  contexts[1].state = 'suspended'
  socket.event({ type: 'response.end', status: 'complete' })
  assert.equal(states.at(-1)[0], 'ready')
  assert.match(states.at(-1)[1], /Play reply again/)
  assert.equal(voice.canReplay(), true)
  await voice.replay()
  assert.equal(states.at(-1)[0], 'speaking')
  assert.equal(voice.canReplay(), false)
  voice.close()
  assert.equal(voice.canReplay(), false)
})

test('audio over ninety seconds is rejected', async () => {
  const states = []
  const voice = new VoiceConnection(s => states.push(s), () => {}, () => {})
  await voice.start('personal')
  socket.event({ type: 'response.start', response_sequence: 1 })
  for (let i = 0; i < 451; i++) {
    const frame = new ArrayBuffer(9608)
    new DataView(frame).setUint32(0, 1)
    new DataView(frame).setUint32(4, i)
    socket.onmessage({ data: frame })
  }
  assert.equal(states.at(-1), 'closed')
})

test('long replies and muting during playback do not start the inactivity timeout', async () => {
  const voice = new VoiceConnection(() => {}, () => {}, () => {})
  await voice.start('personal')
  const original = window.setTimeout
  const delays = []
  window.setTimeout = (fn, ms) => { delays.push(ms); return original(fn, ms) }
  try {
    socket.event({ type: 'response.start', response_sequence: 1 })
    voice.setMuted(true)
    assert.equal(delays.includes(60000), false)
  } finally {
    window.setTimeout = original
    voice.close()
  }
})
