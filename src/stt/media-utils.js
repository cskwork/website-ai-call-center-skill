const TARGET_SAMPLE_RATE = 16000;

export async function blobTo16KhzPcm(blob, AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext) {
  if (!AudioContextCtor) throw new Error('AudioContext is not available in this browser.');
  const arrayBuffer = await blob.arrayBuffer();
  const context = new AudioContextCtor();
  const decoded = await context.decodeAudioData(arrayBuffer);
  const mono = downmixAudioBuffer(decoded);
  await context.close?.();
  return resampleLinear(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
}

export function downmixAudioBuffer(audioBuffer) {
  const output = new Float32Array(audioBuffer.length);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const input = audioBuffer.getChannelData(channel);
    for (let index = 0; index < input.length; index += 1) output[index] += input[index] / audioBuffer.numberOfChannels;
  }
  return output;
}

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
