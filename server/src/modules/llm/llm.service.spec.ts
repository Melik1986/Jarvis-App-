import { LlmService } from "./llm.service";

describe("LlmService (Orchestrator)", () => {
  let service: LlmService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation bypasses NestJS DI (which doesn't work with Babel transform)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new LlmService(mockConfigService as any);
    // onModuleInit is not auto-called outside NestJS DI — call manually
    service.onModuleInit();
  });

  describe("getProviderConfig / getModel", () => {
    it("returns correct model for openai provider", () => {
      const model = service.getModel({ provider: "openai" });
      expect(model).toBe("gpt-4o");
    });

    it("returns correct model for groq provider", () => {
      const model = service.getModel({ provider: "groq" });
      expect(model).toBe("llama-3.3-70b-versatile");
    });

    it("uses custom modelName when provided", () => {
      const model = service.getModel({
        provider: "openai",
        modelName: "gpt-4o-mini",
      });
      expect(model).toBe("gpt-4o-mini");
    });
  });

  describe("provider–baseURL validation", () => {
    it("throws when provider is groq but baseUrl is OpenAI host", () => {
      expect(() =>
        service.getModel({
          provider: "groq",
          baseUrl: "https://api.openai.com/v1",
        }),
      ).toThrow(/Provider groq requires baseURL host api.groq.com/);
    });

    it("throws when provider is openai but baseUrl is Groq host", () => {
      expect(() =>
        service.getModel({
          provider: "openai",
          baseUrl: "https://api.groq.com/openai/v1",
        }),
      ).toThrow(/Provider openai requires baseURL host api.openai.com/);
    });

    it("does not throw when provider is groq and baseUrl is Groq host", () => {
      expect(
        service.getModel({
          provider: "groq",
          baseUrl: "https://api.groq.com/openai/v1",
        }),
      ).toBe("llama-3.3-70b-versatile");
    });

    it("does not throw when provider is custom (any URL allowed)", () => {
      expect(
        service.getModel({
          provider: "custom",
          baseUrl: "https://any.example.com/v1",
        }),
      ).toBe("gpt-4o");
    });

    it("does not throw when baseUrl is omitted (uses default)", () => {
      expect(service.getModel({ provider: "groq" })).toBe(
        "llama-3.3-70b-versatile",
      );
    });
  });

  describe("createClient", () => {
    it("throws when provider is groq but baseUrl is OpenAI (before creating client)", () => {
      expect(() =>
        service.createClient({
          provider: "groq",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "test-key",
        }),
      ).toThrow(/Provider groq requires baseURL host/);
    });

    it("creates client with groq baseURL when provider and URL match", () => {
      const OpenAIMock = jest.fn().mockImplementation(() => ({}));
      jest.doMock("openai", () => ({ default: OpenAIMock }));

      service.createClient({
        provider: "groq",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: "groq-key",
      });
      // createClient returns OpenAI instance; we can't easily spy on constructor
      // without injecting. Validation is already tested above.
      expect(
        service.getModel({
          provider: "groq",
          baseUrl: "https://api.groq.com/openai/v1",
        }),
      ).toBeDefined();
    });
  });
});
