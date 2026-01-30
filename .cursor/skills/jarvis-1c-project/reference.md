# JSRVIS 1C Mobile — Full TZ (Reference)

Sources: `project/project.md`, `attached_assets/(ТЗ)_JSRVIS_1C_Mobile_1769190888988.md`. Экспертные практики по стеку — `.cursor/rules/tech-stack-expert.mdc`.

## 1. Goal

Mobile AI agent for 1C business processes. Converts unstructured input (voice, photo, chat) into structured 1C API calls and RAG-based analytics.

## 2. Modules

- **Jarvis Voice**: expo-av recording → Whisper transcription → command execution.
- **Jarvis Vision**: GPT-4o-mini analysis of invoices/price tags → automatic document creation.
- **RAG (Library)**: Qdrant search over company instructions and regulations.
- **1C Integrator**: Nest.js layer — auth and mapping AI intents to OData/HTTP for 1C.

## 3. Technical requirements

- Auth: Phone OTP (Supabase).
- Offline-first for stock view: Zustand + Persist.
- LLM response streaming: Vercel AI SDK.
- Monorepo-style structure, end-to-end typing.

## 4. AI Adapter Pattern

- User config: URL, type (REST/OData/GraphQL), API key.
- Spec: Preset (e.g. «1С:УНФ») or link to Swagger/OpenAPI (JSON/YAML).
- LLM maps natural language to API: e.g. «Сколько у нас кофе?» → GET /v1/inventory with filter by name.

## 5. MCP (Model Context Protocol)

Support MCP so users can attach servers (Google Sheets, PostgreSQL, ERP). Replit supports this standard.

## 6. Budget universality

- **BYO-LLM**: Settings — Base URL, API Key, Model Name; Vercel AI SDK with configurable baseURL.
- **Universal ERP connector**: Nest.js parses OpenAPI/Swagger and generates Tools (Function Calling) for the model.
- **MCP**: Integrate MCP for pluggable data/ERP servers.

## 7. Local-First

Ollama preset for on-prem usage without cloud token costs.

## 8. Web Audio — reactive background (optional)

Real-time analysis of microphone input to change background (e.g. for voice UI or visualizations).

```javascript
const btn = document.getElementById("start");
btn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  await ctx.resume();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  const data = new Uint8Array(analyser.frequencyBinCount);
  src.connect(analyser);

  function animate() {
    analyser.getByteFrequencyData(data);
    const volume = data.reduce((a, b) => a + b, 0) / data.length;
    const hue = Math.min(360, volume * 3);
    document.body.style.background = `hsl(${hue}, 80%, 50%)`;
    requestAnimationFrame(animate);
  }
  animate();
  btn.remove();
};
```

Use for voice-reactive UI or intro animations when relevant.
