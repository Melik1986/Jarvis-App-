# Scanner Triage (Security + Quality)

## Scope

- Source findings: `.cursor/snyk.iolog`, `.cursor/sonarcloud.iolog`
- Policy: each suppressed finding must map to code path + threat model statement.

## Confirmed Findings (Actioned)

- `S-01` Command execution via dynamic MCP connect.
  - Code: `server/src/modules/mcp/mcp.controller.ts`, `server/src/services/mcp-host.service.ts`
  - Action: dynamic connect env-gated, command allowlist, env allowlist.
- `S-02` Server-side skill code execution in main process.
  - Code: `server/src/modules/skills/sandbox-executor.service.ts`
  - Action: isolated worker runtime, timeout/memory/output limits, denylist, fail-closed.
- `S-03/S-04` SSRF via LLM/ERP/OpenAPI/RAG URLs.
  - Code: `server/src/security/outbound-url-policy.ts` + integrations
  - Action: URL policy (https, private IP blocking, allowlist support, redirect error).
- `S-05` Secrets in plaintext body fallback.
  - Code: `client/lib/query-client.ts`
  - Action: plaintext bootstrap fallback removed, JWE fail-closed path only.
- `S-10` Incomplete request signature path.
  - Code: `client/lib/query-client.ts`, `server/src/guards/request-signature.guard.ts`
  - Action: signed mutating routes, timestamp skew + nonce replay protection.

## False Positives (Documented)

- `FP-01` Hardcoded secret in UI translations/tests.
  - Reason: localization/test strings only, not runtime credential material.
  - Code examples: `client/i18n/translations.ts`, test fixtures.
- `FP-02` Sonar SSRF in client local-file fetch flow.
  - Reason: client-side local file URI resolution, no server-side outbound network pivot.
  - Code: `client/lib/local-rag/document-indexer.ts`

## Suppression Rules

- Sonar exclusions are limited to:
  - generated output
  - dependency directories
  - documented false-positive paths with rationale
- Snyk ignores must include:
  - issue id
  - expiry date
  - threat-model reason
  - code owner sign-off
