# Security policy

Do not open a public issue containing credentials, customer data, raw Evidence,
private Workspace files or diagnostic logs.

Report vulnerabilities privately through GitHub Security Advisories for this
repository. Include the affected version, a minimal reproduction and impact,
with all sensitive values redacted. AutoXEO will acknowledge a valid report and
coordinate a patched release before public disclosure.

The Plugin never needs a DeepSeek or other Provider key. Provider credentials
belong only in AutoXEO Cloud secret storage. If a credential appears in a
Plugin environment, Skill, Artifact or log, revoke it and report the exposure.
