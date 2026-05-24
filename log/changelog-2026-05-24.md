# Changelog 2026-05-24

## Website AI call center skill/template

- Created the first-slice design around adapter boundaries so the template can work with any website and avoid app-specific coupling.
- Chose a static local rule engine as the default because it provides a zero-infra demo and keeps HTTP AI optional.
- Used browser WASM STT/TTS adapters modeled on the reference project so speech can run locally where supported.
- Added explicit cache/privacy/browser-support docs because first-load model downloads and transcript network boundaries are product risks.

## Review hardening

- Added explicit worker asset URL helpers because IIFE users can rely on script-relative assets, while ESM/bundler users need deterministic worker paths.
- Clarified Piper TTS cache semantics so the option is not over-sold as guaranteed OPFS storage.
- Added an ESM browser smoke page to verify explicit worker URLs without downloading large models.

## Code-review fixes

- Made Piper TTS fallback explicit through progress events instead of silently masking worker/model failures.
- Removed prepare-time TTS error suppression from the call-center core.
- Added JavaScript project config for DOM/WebWorker-aware tooling and ignored generated Serena metadata.
- Hardened the browser smoke static-server path guard.

- Fixed async Piper worker init failure so degraded mode clears the rejected ready promise and fallback speech still works.
- Added a regression for async TTS init failure followed by fallback speech.

## Package contract fix

- Added a pack-time build hook and npm `files` allowlist so published tarballs include the `dist/` files targeted by package exports while keeping generated assets out of git.

## Example implementation

- Replaced the thin vanilla demo with a working static-site implementation that defines concrete page actions, a local scenario engine, WASM STT/TTS wiring, and a text path that does not preload models.

## WASM-only speech example

- Rewired the vanilla example to use the same browser WASM speech stack as the reference module: Transformers.js `onnx-community/distil-small.en` q4 STT and Piper `en_US-hfc_female-medium` TTS.
- Removed the Web Speech API adapter from the public package surface so the default TTS fallback is no-op rather than `speechSynthesis`.
- Added typed DOM helpers and scenario JSDoc so the shipped vanilla example stays diagnostic-clean while remaining plain JavaScript.

## GitHub Pages landing page

- Delegated the landing page UI/UX direction to Claude Code and implemented the resulting dark-first static design with relative asset paths for project Pages.
- Added a build step that publishes `site/`, `dist/`, `examples/`, and `docs/` into `_site/` so GitHub Pages can host the landing page and working vanilla example without committing generated bundles.
- Added a GitHub Pages Actions workflow using the current Pages artifact/deploy pattern because this repo needs a custom build rather than a branch-only static folder.
- Guarded Pages deploy steps while the repository remains private because the current GitHub plan rejected Pages enablement for this private repo.

## Scenario management UX

- Moved landing-page call flows into `site/scenarios.js` so add/remove/edit work happens in one readable catalog instead of scattered UI conditionals.
- Rendered demo phrase buttons and visible scenario cards from the same catalog because reviewers should understand sample phrases, match terms, replies, and safe actions without reading JavaScript control flow.
- Updated the packaged `website-ai-call-center` skill and integration docs to make the scenario-catalog pattern part of the reusable workflow.
