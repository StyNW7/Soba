import { api } from './client.ts'
import type { VoiceTicket } from './schema'

export type VoiceState =
  | 'connecting'
  | 'ready'
  | 'recording'
  | 'processing'
  | 'speaking'
  | 'finishing'
  | 'review'
  | 'closed'
export class VoiceConnection {
  private socket?: WebSocket
  private input?: AudioContext
  private output?: AudioContext
  private stream?: MediaStream
  private capture?: AudioWorkletNode
  private sources = new Set<AudioBufferSourceNode>()
  private session = ''
  private turn = ''
  private response = ''
  private sequence = 0
  private responseSequence = 0
  private chunk = 0
  private nextPlay = 0
  private disposed = false
  private utterance?: SpeechSynthesisUtterance
  private replyAudio: AudioBuffer[] = []
  private replySamples = 0
  private fallbackText = ''
  private muted = false
  private turnPending = false
  private awaitingReply = false
  private responseComplete = false
  private idleTimer?: number
  private queuedAudio: Int16Array[] = []
  private preRoll: Int16Array[] = []
  private speechFrames = 0
  private interrupted = false
  private responseEnded = false
  private flushTimer?: number
  private endingTurn = false
  private recording = false
  private finishing = false
  private bufferedSamples = 0
  private timer?: number
  private update: (state: VoiceState, message?: string) => void
  private transcript: (text: string) => void
  private reviewed: () => void
  constructor(
    update: (state: VoiceState, message?: string) => void,
    transcript: (text: string) => void,
    reviewed: () => void,
  ) {
    this.update = update
    this.transcript = transcript
    this.reviewed = reviewed
  }
  async start(mode: 'personal' | 'private') {
    try {
      this.input = new AudioContext({ sampleRate: 16000 })
      this.output = new AudioContext({ sampleRate: 24000 })
      await Promise.all([this.input.resume(), this.output.resume()])
      const ticket = await api<VoiceTicket>('/v1/voice-tickets', {
        method: 'POST',
        body: { mode },
      })
      if (this.disposed) return
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      if (this.disposed) {
        this.stream.getTracks().forEach((t) => t.stop())
        return
      }
      this.setMicrophone(false)
      if (this.input.sampleRate !== 16000)
        throw new Error(
          'This browser cannot record at SOBA’s required sample rate.',
        )
      await this.input.audioWorklet.addModule('/audio/capture.js')
      if (this.disposed) return
      this.capture = new AudioWorkletNode(this.input, 'soba-capture')
      this.input.createMediaStreamSource(this.stream).connect(this.capture)
      this.capture.connect(this.input.destination)
      this.capture.port.onmessage = (event) => this.captureFrame(new Int16Array(event.data))
      this.capture.port.postMessage(true)
      this.setMicrophone(true)
      const voiceOrigin = import.meta.env?.VITE_VOICE_ORIGIN || window.location.origin
      const url = new URL(ticket.websocket_path, voiceOrigin)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      this.socket = new WebSocket(url)
      this.socket.binaryType = 'arraybuffer'
      this.socket.onopen = () =>
        this.send('session.start', {
          ticket: ticket.ticket,
          mode,
          sample_rate: 16000,
          channels: 1,
          encoding: 'pcm_s16le',
          browser_speech: 'speechSynthesis' in window,
        })
      this.socket.onmessage = (event) => {
        try {
          if (typeof event.data === 'string')
            this.control(JSON.parse(event.data))
          else this.play(event.data)
        } catch {
          this.fail('SOBA returned an invalid audio response.')
        }
      }
      this.socket.onerror = () => this.fail('The voice connection failed.')
      this.socket.onclose = () => {
        if (!this.disposed) {
          this.close()
          this.update(
            'closed',
            'Voice connection closed. Unsaved content is not recovered.',
          )
        }
      }
    } catch (e) {
      this.fail(e instanceof Error ? e.message : 'Voice could not start.')
    }
  }
  private send(type: string, values: Record<string, unknown> = {}) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(
        JSON.stringify({
          type,
          version: 1,
          event_id: crypto.randomUUID(),
          ...values,
        }),
      )
  }
  private control(event: Record<string, unknown>) {
    if (
      this.finishing &&
      event.type !== 'session.summary_ready' &&
      event.type !== 'error'
    )
      return
    switch (event.type) {
      case 'session.ready':
        this.session = String(event.session_id)
        this.beginTurn()
        break
      case 'input.ready':
        this.turn = String(event.turn_id)
        this.response = typeof event.response_id === 'string' ? event.response_id : ''
        this.sequence = 0
        this.turnPending = false
        this.interrupted = false
        this.responseEnded = false
        this.preRoll = []
        this.speechFrames = 0
        this.recording = true
        this.setMicrophone(!this.muted)
        this.resetIdleTimer()
        this.capture?.port.postMessage(true)
        this.update('recording')
        this.flushAudio()
        break
      case 'transcript.partial':
        if (String(event.text).trim() && !this.muted) this.resetIdleTimer()
        this.transcript(String(event.text))
        break
      case 'transcript.final':
        this.awaitingReply = true
        this.stopSending()
        this.transcript(String(event.text))
        if (!String(event.text).trim()) {
          this.responseComplete = true
          this.resumeAfterPlayback()
          break
        }
        this.update('processing')
        break
      case 'response.start':
        window.clearTimeout(this.idleTimer)
        this.replyAudio = []
        this.replySamples = 0
        this.fallbackText = ''
        this.awaitingReply = true
        this.stopSending()
        this.responseComplete = false
        this.responseSequence = Number(event.response_sequence)
        this.chunk = 0
        if (!this.interrupted) this.update('speaking')
        break
      case 'response.end':
        this.responseEnded = true
        if (!this.interrupted && event.status === 'complete' && typeof event.fallback_text === 'string') {
          this.fallbackText = event.fallback_text
          this.speakFallback(event.fallback_text)
          break
        }
        if (event.status === 'complete' && this.output?.state !== 'running' && this.replyAudio.length) {
          this.stopPlayback()
          this.awaitingReply = false
          this.update('ready', 'Audio is paused. Tap Play reply again to hear SOBA.')
          this.resetIdleTimer()
          break
        }
        if (event.status !== 'complete') this.stopPlayback()
        this.responseComplete = true
        this.resumeAfterPlayback()
        break
      case 'mode.changed':
        this.update(
          this.recording ? 'recording' : 'processing',
          `SOBA is in ${event.mode} mode.`,
        )
        break
      case 'safety.offer':
        this.update(
          'processing',
          'SOBA suggests reaching out. You can choose a contact in your Circle of trust. No request has been sent.',
        )
        break
      case 'session.summary_ready':
        this.close()
        this.update('review')
        this.reviewed()
        break
      case 'error':
        this.fail(
          `Voice unavailable: ${String(event.code).replaceAll('_', ' ')}.`,
        )
        break
    }
  }
  beginTurn() {
    if (this.disposed || this.finishing || !this.session || this.recording || this.turnPending || this.awaitingReply) return
    if (this.muted) { this.update('ready'); return }
    this.turnPending = true
    this.stopPlayback()
    this.update('processing')
    this.send('input.start', {
      session_id: this.session,
      client_turn_id: crypto.randomUUID(),
    })
  }
  endTurn() {
    if (!this.recording || this.disposed || this.finishing) return
    this.endingTurn = true
    this.capture?.port.postMessage(false)
    this.flushAudio()
  }
  private captureFrame(samples: Int16Array) {
    if (this.disposed || this.finishing) return
    if (this.muted) {
      if (this.recording && !this.endingTurn) this.sendAudio(new Int16Array(320))
      return
    }
    if (this.endingTurn) return
    if (!this.session || this.recording || this.turnPending || this.interrupted) {
      if (this.recording && !this.queuedAudio.length) this.sendAudio(samples)
      else {
        this.queuedAudio.push(samples)
        if (this.queuedAudio.length > 500) this.fail('SOBA could not catch up with your speech. Please start a new session.')
      }
      return
    }
    if (!this.awaitingReply) return
    this.preRoll.push(samples)
    if (this.preRoll.length > 20) this.preRoll.shift()
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length) / 32768
    this.speechFrames = rms > 0.025 ? this.speechFrames + 1 : 0
    if (this.speechFrames < 9) return
    this.interrupted = true
    if (this.response) this.send('response.cancel', { session_id: this.session, response_id: this.response })
    this.queuedAudio.push(...this.preRoll)
    this.preRoll = []
    this.stopPlayback()
    this.update('processing')
    if (this.responseEnded) {
      this.responseComplete = true
      this.resumeAfterPlayback()
    }
  }
  private sendAudio(samples: Int16Array) {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    if (this.socket.bufferedAmount > 64000) { this.fail('The connection is too slow. Recording stopped.'); return }
    const frame = new ArrayBuffer(644)
    const view = new DataView(frame)
    view.setUint32(0, this.sequence++)
    samples.forEach((value, i) => view.setInt16(4 + i * 2, value, true))
    this.socket.send(frame)
  }
  private flushAudio() {
    window.clearTimeout(this.flushTimer)
    if (!this.recording || this.disposed || this.finishing) return
    for (let i = 0; i < 5 && this.queuedAudio.length; i++) this.sendAudio(this.queuedAudio.shift()!)
    if (this.queuedAudio.length) {
      this.flushTimer = window.setTimeout(() => this.flushAudio(), 20)
    } else if (this.endingTurn) {
      this.endingTurn = false
      this.awaitingReply = true
      this.stopSending()
      this.capture?.port.postMessage(true)
      this.update('processing')
      this.send('input.end', { session_id: this.session, turn_id: this.turn, last_sequence: Math.max(0, this.sequence - 1) })
    }
  }
  private stopSending() {
    this.recording = false
    window.clearTimeout(this.idleTimer)
    window.clearTimeout(this.flushTimer)
    this.endingTurn = false
  }
  finish() {
    if (this.finishing) return
    this.finishing = true
    this.stopCapture()
    this.stopPlayback()
    this.update('finishing', 'Preparing your review…')
    this.send('session.end', { session_id: this.session })
  }
  setMuted(muted: boolean) {
    this.muted = muted
    this.setMicrophone(!muted && !this.disposed && !this.finishing)
    if (muted) { this.queuedAudio = []; this.preRoll = []; this.speechFrames = 0 }
    if (muted && !this.awaitingReply) this.resetIdleTimer()
    else if (!this.recording) this.beginTurn()
  }
  private setMicrophone(enabled: boolean) {
    this.stream?.getTracks().forEach((track) => { track.enabled = enabled })
  }
  private resetIdleTimer() {
    window.clearTimeout(this.idleTimer)
    this.idleTimer = window.setTimeout(() => this.finish(), 60000)
  }
  private resumeAfterPlayback() {
    if (!this.responseComplete || this.sources.size || this.disposed || this.finishing) return
    this.responseComplete = false
    this.timer = window.setTimeout(() => {
      this.awaitingReply = false
      this.beginTurn()
      if (this.muted) this.resetIdleTimer()
    }, 300)
  }
  private stopCapture() {
    this.stopSending()
    this.queuedAudio = []
    this.preRoll = []
    window.clearTimeout(this.idleTimer)
    this.setMicrophone(false)
    this.recording = false
    this.capture?.port.postMessage(false)
  }
  private play(data: ArrayBuffer) {
    if (this.finishing || this.interrupted) return
    if (
      !this.output ||
      data.byteLength < 10 ||
      data.byteLength > 9608 ||
      data.byteLength % 2
    )
      throw new Error('Invalid audio')
    const view = new DataView(data)
    if (
      view.getUint32(0) !== this.responseSequence ||
      view.getUint32(4) !== this.chunk++
    )
      throw new Error('Audio sequence gap')
    const count = (data.byteLength - 8) / 2
    const buffer = this.output.createBuffer(1, count, 24000)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < count; i++)
      samples[i] = view.getInt16(8 + i * 2, true) / 32768
    if (this.replySamples + count > 90 * 24000)
      throw new Error('Playback overflow')
    this.replySamples += count
    this.replyAudio.push(buffer)
    this.scheduleAudio(buffer)
  }
  private scheduleAudio(buffer: AudioBuffer) {
    if (!this.output) return
    const count = Math.round(buffer.duration * 24000)
    this.bufferedSamples += count
    const source = this.output.createBufferSource()
    source.buffer = buffer
    source.connect(this.output.destination)
    this.sources.add(source)
    source.onended = () => {
      if (this.sources.delete(source)) this.bufferedSamples -= count
      this.resumeAfterPlayback()
    }
    this.nextPlay = Math.max(this.nextPlay, this.output.currentTime)
    source.start(this.nextPlay)
    this.nextPlay += buffer.duration
  }
  canReplay() {
    return !this.disposed && !this.finishing && !this.recording && !this.awaitingReply &&
      !this.turnPending && (this.replyAudio.length > 0 || !!this.fallbackText)
  }
  async replay() {
    if (!this.canReplay()) return
    this.stopPlayback()
    this.awaitingReply = true
    window.clearTimeout(this.idleTimer)
    try {
      await this.output?.resume()
      if (this.disposed) return
      if (this.fallbackText) {
        this.speakFallback(this.fallbackText)
        return
      }
      this.update('speaking')
      for (const buffer of this.replyAudio) this.scheduleAudio(buffer)
      this.responseComplete = true
    } catch {
      this.awaitingReply = false
      this.update('ready', 'Audio could not play. Tap Play reply again to retry.')
      this.resetIdleTimer()
    }
  }
  private speakFallback(text: string) {
    this.stopPlayback()
    if (!('speechSynthesis' in window)) {
      this.update('ready', text)
      this.responseComplete = true
      this.resumeAfterPlayback()
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    this.utterance = utterance
    const finish = () => {
      if (this.utterance !== utterance || this.disposed) return
      this.utterance = undefined
      window.clearTimeout(this.timer)
      this.update('ready', text)
      this.responseComplete = true
      this.resumeAfterPlayback()
    }
    utterance.onend = finish
    utterance.onerror = () => {
      if (this.utterance !== utterance || this.disposed) return
      this.utterance = undefined
      window.clearTimeout(this.timer)
      this.awaitingReply = false
      this.responseComplete = false
      this.resetIdleTimer()
      this.update('ready', `Your browser could not play speech. Tap Play reply again to retry. SOBA: ${text}`)
    }
    this.update('speaking', text)
    this.timer = window.setTimeout(() => { finish(); window.speechSynthesis.cancel() }, 90000)
    window.speechSynthesis.speak(utterance)
  }
  private stopPlayback() {
    this.responseComplete = false
    window.clearTimeout(this.timer)
    if (this.utterance) {
      this.utterance = undefined
      window.speechSynthesis?.cancel()
    }
    for (const s of this.sources) s.stop()
    this.sources.clear()
    this.bufferedSamples = 0
    this.nextPlay = 0
  }
  private fail(message: string) {
    this.close()
    this.update('closed', message)
  }
  close() {
    this.disposed = true
    this.replyAudio = []
    this.replySamples = 0
    this.fallbackText = ''
    this.stopCapture()
    this.stopPlayback()
    this.socket?.close()
    this.capture?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    if (this.input?.state !== 'closed') void this.input?.close()
    if (this.output?.state !== 'closed') void this.output?.close()
  }
}
