class SobaCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.enabled = false
    this.samples = new Int16Array(320)
    this.offset = 0
    this.port.onmessage = (event) => {
      this.enabled = event.data === true
      this.offset = 0
    }
  }
  process(inputs) {
    const channel = inputs[0]?.[0]
    if (this.enabled && channel) {
      for (const sample of channel) {
        this.samples[this.offset++] = Math.round(
          Math.max(-1, Math.min(1, sample)) * 32767,
        )
        if (this.offset === 320) {
          this.port.postMessage(this.samples.buffer, [this.samples.buffer])
          this.samples = new Int16Array(320)
          this.offset = 0
        }
      }
    }
    return true
  }
}
registerProcessor('soba-capture', SobaCapture)
