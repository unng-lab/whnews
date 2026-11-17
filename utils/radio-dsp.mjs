export const VOICE_RATE = 24000;
export const VOICE_WINDOW = 90;

export function metallicVoice(input, voice, sampleRate = VOICE_RATE) {
  const output = new Float32Array(input.length), wet = new Float32Array(input.length);
  const heavy = voice === 'B';
  const lowAlpha = 1 - Math.exp(-2 * Math.PI * 4800 / sampleRate);
  const highAlpha = Math.exp(-2 * Math.PI * 170 / sampleRate);
  let low = 0, high = 0, previous = 0, inputPower = 0, power = 0, peak = 0;
  const delays = [[6.7, .26], [11.3, -.19], [17.1, .12]].map(([ms, gain]) => [Math.round(ms * sampleRate / 1000), gain]);
  for (let i = 0; i < input.length; i++) {
    const value = input[i];
    if (!Number.isFinite(value)) throw new TypeError('Non-finite voice');
    low += lowAlpha * (value - low); high = highAlpha * (high + low - previous); previous = low;
    wet[i] = high;
    let resonant = high;
    for (const [delay, gain] of delays) if (i >= delay) resonant += gain * wet[i - delay];
    const metal = Math.round(resonant * 1024) / 1024;
    const ring = high * Math.cos(2 * Math.PI * (heavy ? 59 : 43) * i / sampleRate);
    output[i] = heavy ? .53 * value + .39 * metal + .23 * ring : .79 * value + .20 * metal + .09 * ring;
    inputPower += value * value; power += output[i] ** 2; peak = Math.max(peak, Math.abs(output[i]));
  }
  const gain = Math.min(Math.sqrt(inputPower / Math.max(power, 1e-12)), .9 / Math.max(peak, 1e-9));
  for (let i = 0; i < output.length; i++) output[i] *= gain;
  return output;
}

export function wave16(samples, rate = VOICE_RATE) {
  const buffer = new ArrayBuffer(44 + samples.length * 2), view = new DataView(buffer);
  const ascii = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) throw new TypeError('Non-finite WAV');
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  }
  return buffer;
}

export function buildDialogueWave(turns, rate = VOICE_RATE) {
  const gap = Math.round(.24 * rate), head = Math.round(.6 * rate), tail = Math.round(.6 * rate);
  const speechLength = turns.reduce((n, t) => n + t.audio.length, 0) + gap * Math.max(0, turns.length - 1) + head + tail;
  if (!turns.length || speechLength > 88 * rate) throw new RangeError('Dialogue exceeds its UTC window');
  const samples = new Float32Array(VOICE_WINDOW * rate);
  let cursor = head;
  for (const turn of turns) {
    if (!['A', 'B'].includes(turn.voice)) throw new TypeError('Invalid voice');
    const processed = metallicVoice(turn.audio, turn.voice, rate);
    let power = 0, peak = 0;
    for (const v of processed) { power += v * v; peak = Math.max(peak, Math.abs(v)); }
    const gain = Math.min(.12 / Math.max(Math.sqrt(power / Math.max(1, processed.length)), 1e-9), .85 / Math.max(peak, 1e-9));
    for (let i = 0; i < processed.length; i++) samples[cursor + i] += processed[i] * gain;
    cursor += processed.length + gap;
  }
  let envelope = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    envelope = Math.max(Math.abs(samples[i]), envelope * .9994);
    const time = i / rate;
    const fade = Math.min(time / .3, 1, (VOICE_WINDOW - time) / .5);
    const bed = (.007 * Math.sin(2 * Math.PI * 73.416 * time) + .003 * Math.sin(2 * Math.PI * 110 * time)) * (1 - .75 * Math.min(envelope / .06, 1));
    samples[i] = (samples[i] + bed) * Math.max(0, fade);
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak > .92) for (let i = 0; i < samples.length; i++) samples[i] *= .92 / peak;
  return { wav: wave16(samples, rate), speechSeconds: speechLength / rate, durationMs: VOICE_WINDOW * 1000 };
}
