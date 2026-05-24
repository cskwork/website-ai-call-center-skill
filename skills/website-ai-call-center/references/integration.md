# Integration Reference

## Static page

Copy the built files into a public folder:

- `website-ai-call-center.iife.js`
- `website-ai-call-center.css`

Then load the script and call `window.WebsiteAICallCenter.createWebsiteCallCenter(...)`.

## Bundler app

Import from `src/index.js` while developing or from the package entry after publishing.

## Scenario shape

```js
{
  id: 'login-help',
  match: ['login', 'password'],
  response: 'I can help you reset your password.',
  actions: [{ id: 'show-reset', label: 'Show reset link' }]
}
```

## HTTP engine shape

The endpoint accepts `start`, `message`, and `end` event bodies. The `message` response should include assistant `text` and optional safe `actions`.
