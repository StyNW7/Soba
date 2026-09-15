type Recognition = {
  processLocally: boolean
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionConstructor = {
  new(): Recognition
  available(options: { langs: string[]; processLocally: boolean }): Promise<string>
  install(options: { langs: string[]; processLocally: boolean }): Promise<boolean>
}
export function isWakePhrase(text: string) {
  return /^hey\s+soba[.!?,]*$/i.test(text.trim())
}
export class WakeWordListener {
  private recognition?: Recognition
  private stopped = false
  private timer?: ReturnType<typeof setTimeout>
  async start(wake: () => void, status: (text: string) => void, failed: () => void = () => {}) {
    const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
    const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition
    if (!Constructor || !Constructor.available || !Constructor.install)
      throw new Error('Local wake-word listening is not available in this browser. Use Start voice session.')
    const recognition = new Constructor()
    if (!('processLocally' in recognition))
      throw new Error('This browser cannot keep wake-word audio on your device. Use Start voice session.')
    recognition.processLocally = true
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = false
    this.recognition = recognition
    const options = { langs: ['en-US'], processLocally: true }
    const available = await Constructor.available(options)
    if (this.stopped) return
    if (available === 'unavailable') throw new Error('Local English speech recognition is unavailable. Use Start voice session.')
    if (available !== 'available') {
      status('Downloading the browser’s local English language pack…')
      if (!await Constructor.install(options)) throw new Error('The local language pack could not be installed.')
    }
    if (this.stopped) return
    let matched = false
    recognition.onresult = event => {
      if (this.stopped || document.hidden) return
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal && isWakePhrase(event.results[i][0].transcript)) {
          matched = true
          this.stopped = true
          status('SOBA heard you. Starting your conversation…')
          recognition.stop()
          break
        }
      }
    }
    recognition.onerror = event => {
      if (this.stopped) return
      if (event.error === 'no-speech') return
      status('Wake-word listening stopped. Enable it again or use Start voice session.')
      this.stop()
      failed()
    }
    recognition.onend = () => {
      if (matched) { matched = false; wake(); return }
      if (this.stopped || document.hidden) return
      this.timer = setTimeout(() => {
        if (this.stopped) return
        try { recognition.start() } catch { status('Wake-word listening stopped. Enable it again.'); this.stop(); failed() }
      }, 300)
    }
    recognition.start()
    status('Listening locally for “Hey Soba”. Keep this page open.')
  }
  stop() {
    this.stopped = true
    clearTimeout(this.timer)
    if (this.recognition) {
      this.recognition.onend = null
      this.recognition.abort()
    }
  }
}
