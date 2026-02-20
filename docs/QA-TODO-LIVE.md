# AXON Live QA TODO Tracker

Last updated: 2026-02-20  
Source: Live manual QA notes from product owner  
Mode: Implemented + validated

## Legend
- Status: OPEN | DIAGNOSED | IN_PROGRESS | DONE | BLOCKED
- Priority: P0 (critical), P1 (high), P2 (normal), P3 (low)

## Q-001 - Replace outdated OpenAI model presets on LLM provider screen
- Status: DONE
- Priority: P1
- Implemented:
  - OpenAI preset list updated to current model family (removed legacy GPT-3.5 / old GPT-4 turbo presets).
  - Files:
    - `client/screens/LLMProviderScreen.tsx`
    - `server/src/modules/llm/llm.service.ts`
- Verification:
  - `npm run lint` passed.
  - `npx tsc --noEmit --incremental false` passed.

## Q-002 - Add Google provider + Gemini models without breaking other providers
- Status: DONE
- Priority: P1
- Implemented:
  - Added `google` provider end-to-end (client store types, UI, DTOs, provider factory, service config, host policy, ephemeral client defaults).
  - Added Gemini preset models.
  - Files:
    - `client/store/settingsStore.ts`
    - `client/screens/LLMProviderScreen.tsx`
    - `client/screens/ProfileScreen.tsx`
    - `server/src/modules/llm/llm.types.ts`
    - `server/src/modules/llm/llm.service.ts`
    - `server/src/modules/chat/llm-provider.factory.ts`
    - `server/src/modules/chat/chat.dto.ts`
    - `server/src/modules/chat/chat.controller.ts`
    - `server/src/modules/conductor/conductor.controller.ts`
    - `server/src/modules/auth/auth.dto.ts`
    - `server/src/services/ephemeral-client-pool.service.ts`
- Verification:
  - `npm run lint` passed.
  - `npx tsc --noEmit --incremental false` passed.
  - `npm test -- --runInBand` passed.

## Q-003 - Remove ERP `apiType` UI block if it has no runtime effect
- Status: DONE
- Priority: P2
- Implemented:
  - Removed `apiType` selector block from ERP settings UI.
  - Removed related dead UI styles/imports.
  - Files:
    - `client/screens/ERPSettingsScreen.tsx`
- Note:
  - Internal payload compatibility kept; UI only shows fields that affect behavior.

## Q-004 - Improve ERP behavior for practical Odoo read/write workflows
- Status: DONE
- Priority: P1
- Implemented:
  - Odoo read path improved with token fallback search when exact phrase misses.
  - Stock/product search now uses broader candidate fetch + token filtering.
  - Invoice creation improved: when product ID cannot be resolved, invoice line is still created as manual line item.
  - Files:
    - `server/src/modules/erp/adapters/odoo.adapter.ts`
- Result:
  - Better non-exact product retrieval and practical create-invoice flow from chat.

## Q-005 - Knowledge Base local-first behavior and explicit file-read semantics
- Status: DONE
- Priority: P1
- Implemented:
  - Added `local` RAG provider option in settings and profile labels.
  - Document viewer switched to local SQLite source for read/delete.
  - Chat flow now injects local file context only when user explicitly references file/doc.
  - Voice request sends complete RAG settings shape.
  - Files:
    - `client/screens/RAGSettingsScreen.tsx`
    - `client/screens/DocumentViewerScreen.tsx`
    - `client/screens/ChatScreen.tsx`
    - `client/hooks/useVoice.ts`
    - `server/src/modules/rag/rag.types.ts`
    - `server/src/modules/rag/rag.service.ts`
    - `server/src/modules/chat/chat.dto.ts`
- Verification:
  - `npm run lint` passed.
  - `npx tsc --noEmit --incremental false` passed.
  - `npm test -- --runInBand` passed.

## Q-006 - Global loader / splash behavior (white flash)
- Status: DONE
- Priority: P2
- Implemented:
  - Rebuilt global loader with `lottie-react-native` + native `Modal` overlay:
    - no `tamagui` dependency/runtime requirement,
    - full-screen dark overlay,
    - anti-flicker minimum visibility guard.
  - Added boot overlay phase tied to startup readiness:
    - wait for app readiness + `NavigationContainer.onReady`,
    - keep boot overlay visible briefly after splash hide for smooth transition.
  - Removed local screen loaders from protected/settings screens to avoid transitional blink; only app-level `GlobalLoader` remains.
  - File:
    - `client/components/GlobalLoader.tsx`
    - `client/App.tsx`
- Result:
  - Startup transition is deterministic and visually stable (no instant flash/blink).

## Validation Summary
- `npm run lint` -> PASS
- `npx tsc --noEmit --incremental false` -> PASS
- `npm test -- --runInBand` -> PASS (12/12 suites, 69/69 tests)
- `npm run test:server -- --runInBand` -> PASS

## Follow-up Notes
- `test:server` currently executes some client tests due jest path pattern behavior; all tests passed, but path scoping can be tightened separately.
