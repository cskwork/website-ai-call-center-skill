import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        'stt-worker': 'src/stt/stt-worker.js',
        'tts-worker': 'src/tts/tts-worker.js',
      },
      formats: ['es'],
      fileName: (_format, entryName) => `workers/${entryName}.js`,
    },
    rollupOptions: {
      output: {
        chunkFileNames: 'workers/chunks/[name]-[hash].js',
        assetFileNames: 'workers/assets/[name]-[hash][extname]',
      },
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', '@mintplex-labs/piper-tts-web', 'onnxruntime-web'],
  },
});
