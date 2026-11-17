import { buildDialogueWave } from '../utils/radio-dsp.mjs';

let ort, session, config, settings;
const fail = (error, id) => postMessage({ type: 'error', id, message: error instanceof RangeError ? 'Разговор не поместился в эфирное окно.' : 'Не удалось подготовить голоса.' });
const localUrl = value => {
  const url = new URL(value, self.location.href);
  if (url.origin !== self.location.origin) throw new Error('External voice asset');
  return url.href;
};
async function verifiedBytes(entry) {
  const url = localUrl(entry.src);
  let cache;
  try { cache = await caches.open('whnews-radio-voice-v1'); } catch { /* Cache is optional. */ }
  let response;
  try { response = cache ? await cache.match(url) : null; } catch { cache = null; }
  if (!response) response = await fetch(url);
  if (!response.ok) throw new Error('Voice asset unavailable');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > 30 * 1024 * 1024) throw new Error('Voice asset too large');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== entry.sha256) { if (cache) await cache.delete(url); throw new Error('Voice asset changed'); }
  if (cache) { try { await cache.put(url, new Response(bytes)); } catch { /* Continue without persistence. */ } }
  return bytes;
}
async function load(next) {
  settings = next;
  ort = await import(/* @vite-ignore */ localUrl(next.ortModuleUrl));
  ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = localUrl(next.ortBaseUrl);
  const [model, data] = await Promise.all([verifiedBytes(next.model), verifiedBytes(next.config)]);
  config = JSON.parse(new TextDecoder().decode(data));
  if (config.sample_rate !== 24000 || config.voices.join(',') !== 'RADIO_A,RADIO_B') throw new Error('Wrong voice configuration');
  session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  postMessage({ type: 'ready' });
}
async function render(message) {
  if (!session || message.modelRevision !== settings.model.sha256) throw new Error('Voice model mismatch');
  const began = performance.now(), turns = [];
  for (const turn of message.script.turns) {
    if (!['A', 'B'].includes(turn.voice)) throw new Error('Invalid speaker');
    const chunks = [];
    for (const chunk of turn.chunks) {
      if (chunk.tokens.length > 500 || chunk.tokens.length !== chunk.stress.length || chunk.tokens.some(n => !Number.isInteger(n) || n < 0 || n >= config.symbols.length)) throw new Error('Invalid phonemes');
      const integer = values => new ort.Tensor('int64', BigInt64Array.from(values.map(BigInt)), [1, values.length]);
      const scalar = value => new ort.Tensor('float32', Float32Array.of(value), [1]);
      const inputs = { tokens: integer(chunk.tokens), stress: integer(chunk.stress),
        voice: new ort.Tensor('int64', BigInt64Array.of(turn.voice === 'A' ? 0n : 1n), [1]),
        speed: scalar(1), pitch_shift: scalar(0), pitch_range: scalar(1) };
      let result;
      try {
        result = await session.run(inputs);
        const audio = result.audio.data.slice();
        if (!audio.length || audio.length > 32 * 24000 || !audio.every(Number.isFinite)) throw new Error('Invalid voice output');
        chunks.push(audio);
      } finally {
        for (const value of Object.values(inputs)) value.dispose();
        if (result) for (const value of Object.values(result)) value.dispose();
      }
    }
    const pause = 1920;
    const audio = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0) + pause * Math.max(0, chunks.length - 1));
    let offset = 0;
    for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length + pause; }
    turns.push({ voice: turn.voice, audio });
  }
  const result = buildDialogueWave(turns);
  postMessage({ type: 'done', id: message.id, wav: result.wav, durationMs: result.durationMs,
    speechSeconds: result.speechSeconds, generationMs: performance.now() - began }, [result.wav]);
}
self.onmessage = async ({ data }) => {
  try { if (data.type === 'load') await load(data.settings); else if (data.type === 'render') await render(data); }
  catch (error) { fail(error, data.id); }
};
