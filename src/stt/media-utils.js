const TARGET_SAMPLE_RATE = 16000;

/**
 * Decode an audio blob and return mono 16 kHz PCM samples for the STT worker.
 *
 * @param {Blob} blob Recorded audio blob.
 * @param {typeof AudioContext} [AudioContextCtor] AudioContext constructor.
 * @returns {Promise<Float32Array>} Mono 16 kHz PCM.
 */
export async function blobTo16KhzPcm(blob, AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext) {
  if (!AudioContextCtor) throw new Error('AudioContext is not available in this browser.');
  const arrayBuffer = await blob.arrayBuffer();
  const context = new AudioContextCtor();
  const decoded = await context.decodeAudioData(arrayBuffer);
  const mono = downmixAudioBuffer(decoded);
  await context.close?.();
  return resampleLinear(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
}

/**
 * Average all channels of an AudioBuffer into a new mono Float32Array.
 *
 * @param {AudioBuffer} audioBuffer Source audio buffer.
 * @returns {Float32Array} New mono sample array.
 */
export function downmixAudioBuffer(audioBuffer) {
  const output = new Float32Array(audioBuffer.length);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const input = audioBuffer.getChannelData(channel);
    for (let index = 0; index < input.length; index += 1) output[index] += input[index] / audioBuffer.numberOfChannels;
  }
  return output;
}

/**
 * Linearly resample mono PCM from one sample rate to another. Always returns a
 * new array (a copy even when the rates already match) — never mutates input.
 *
 * @param {Float32Array} input Source samples.
 * @param {number} fromRate Source sample rate (Hz).
 * @param {number} toRate Target sample rate (Hz).
 * @returns {Float32Array} New resampled array.
 */
export function resampleLinear(input, fromRate, toRate) {
  if (fromRate === toRate) return new Float32Array(input);
  const length = Math.round(input.length * toRate / fromRate);
  const ratio = (input.length - 1) / Math.max(1, length - 1);
  const output = new Float32Array(length);
  for (let index = 0; index < output.length; index += 1) output[index] = interpolate(input, index * ratio);
  return output;
}

function interpolate(input, position) {
  const left = Math.floor(position);
  const right = Math.min(input.length - 1, left + 1);
  return input[left] + (input[right] - input[left]) * (position - left);
}
