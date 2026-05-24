# Integration Reference

## Static page

Copy the built files into a public folder:

- `website-ai-call-center.iife.js`
- `website-ai-call-center.css`

Then load the script and call `window.WebsiteAICallCenter.createWebsiteCallCenter(...)`.

## Bundler app

Import from `src/index.js` while developing or from the package entry after publishing.

## Scenario shape

Keep local scenarios in YAML files so non-authors can review the flow without reading UI control logic.

```yaml
id: login-help
catalog_order: 10
scenario_intent: login_help
title: Login help
button_label: Login help
summary: Helps users find the login reset path.
utterances:
  - I cannot log in
match:
  keywords:
    - login
    - password
reply:
  text: I can help you reset your password.
frontend_actions:
  - id: show-reset
    label: Show reset link
workflow:
  issue_type: account_support
```

For the landing template, edit `scenarios/*.yml`, run `npm run scenarios:build`, then make sure every `frontend_actions[].id` is registered in the safe action registry.

## Intent detection

The static template resolves intent with deterministic keyword scoring from `match.keywords`. For production, an LLM or classifier may return `scenario_intent`; resolve that intent through the same approved catalog and expose only registered frontend actions.

## HTTP engine shape

The endpoint accepts `start`, `message`, and `end` event bodies. The `message` response should include assistant `text` and optional safe `actions`.
