# Repository instructions

This public repository owns only the AutoXEO Codex Plugin, its Skills, local
MCP/loopback workbench, installers and public compatibility evidence.

- Never add Provider keys, Cloud/Admin source, customer data or internal
  deployment details.
- AutoXEO Cloud is authoritative for identity, tenancy, entitlement, Provider
  capability, Evidence and Credit. Local state is never promoted to authority.
- A billed or externally mutating operation uses prepare, explicit confirm,
  idempotent commit and receipt.
- Fixture output is never `observed` Evidence.
- The local server binds only to `127.0.0.1`, rejects Host/Origin confusion,
  uses an HttpOnly session and requires CSRF on commands.
- Run `npm run check`, `npm run validate`, the official plugin validator and
  both smoke tests before release.
