# Verification Reference

Run:

```bash
npm test
npm run build
npm run smoke:browser
```

Manual browser checks:

1. Open the vanilla example.
2. Open the overlay with keyboard and pointer.
3. Send a support message.
4. Confirm assistant response and action chip.
5. Trigger a safe action and confirm only registered page behavior runs.
6. Click Prepare on localhost and confirm WASM STT/TTS model progress is visible.

Do not claim production readiness until privacy copy explains whether transcripts leave the browser.
