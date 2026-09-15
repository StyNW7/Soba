import test from 'node:test'
import assert from 'node:assert/strict'
import { WakeWordListener, isWakePhrase } from '../src/api/wake-word.ts'

function setup(available = 'available') {
 let recognition, starts = 0, installs = 0
 class LocalRecognition {
  processLocally = false
  static async available(options) { assert.equal(options.processLocally,true); return available }
  static async install(options) { assert.equal(options.processLocally,true); installs++; return true }
  constructor() { recognition=this }
  start() { assert.equal(this.processLocally,true); starts++ }
  stop() { this.onend?.() }
  abort() { this.onend?.() }
 }
 globalThis.window = { SpeechRecognition: LocalRecognition }
 globalThis.document = { hidden:false }
 return { get recognition(){return recognition}, get starts(){return starts}, get installs(){return installs} }
}
test('wake phrase requires the complete phrase, not surrounding conversation',()=>{
 assert.equal(isWakePhrase('Hey Soba!'),true)
 for (const text of ['soba','hey sober','They said hey Soba yesterday','Hey Soba what time is it']) assert.equal(isWakePhrase(text),false)
})
test('local recognition installs locally and stops before waking once',async()=>{
 const mock=setup('downloadable'); const listener=new WakeWordListener(); let woke=0
 await listener.start(()=>woke++,()=>{})
 assert.equal(mock.installs,1)
 mock.recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Hey Soba.'}}]})
 assert.equal(woke,1)
 mock.recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Hey Soba.'}}]})
 assert.equal(woke,1)
 listener.stop()
})
test('unsupported browsers never fall back to remote recognition',async()=>{
 const mock=setup('unavailable'); const listener=new WakeWordListener()
 await assert.rejects(listener.start(()=>{},()=>{}),/unavailable/)
 assert.equal(mock.starts,0)
 listener.stop()
 window.SpeechRecognition=class { static available(){} static install(){} }
 await assert.rejects(new WakeWordListener().start(()=>{},()=>{}),/keep wake-word audio/)
})
test('stopping during installation cannot start the microphone later',async()=>{
 const mock=setup('downloadable'); let complete
 window.SpeechRecognition.install=()=>new Promise(resolve=>complete=resolve)
 const listener=new WakeWordListener()
 const pending=listener.start(()=>{},()=>{})
 await new Promise(resolve=>setImmediate(resolve))
 listener.stop(); complete(true); await pending
 assert.equal(mock.starts,0)
})
test('hidden pages and stopped listeners ignore recognition results',async()=>{
 const mock=setup(); const listener=new WakeWordListener(); let woke=0
 await listener.start(()=>woke++,()=>{})
 document.hidden=true
 mock.recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Hey Soba'}}]})
 assert.equal(woke,0)
 listener.stop(); document.hidden=false
 mock.recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Hey Soba'}}]})
 assert.equal(woke,0)
})
