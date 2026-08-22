# Contributing

Use Node.js 22 and npm. Keep changes scoped to the public Codex integration.

```bash
npm ci
npm run check
npm run validate
npm run smoke:mcp
npm run smoke:webui
```

Do not submit real credentials, customer data, production Evidence or private
Platform/Admin implementation. UI changes must include keyboard, narrow-width,
loading, empty, partial, error and success verification.
