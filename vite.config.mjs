import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    cssCodeSplit: false,
    lib: {
      entry: 'src/index.js',
      name: 'WebsiteAICallCenter',
      formats: ['es', 'iife'],
      fileName: (format) => format === 'es'
        ? 'website-ai-call-center.esm.js'
        : 'website-ai-call-center.iife.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css')
          ? 'website-ai-call-center.css'
          : 'assets/[name]-[hash][extname]',
      },
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers', '@mintplex-labs/piper-tts-web', 'onnxruntime-web'],
  },
});
