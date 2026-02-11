jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

// eslint-disable-next-line import/first -- mock must be before store import
import { useSettingsStore } from "./settingsStore";

describe("settingsStore (Provider Switcher)", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      llm: {
        provider: "replit",
        baseUrl: "",
        apiKey: "",
        modelName: "gpt-4o",
        transcriptionModel: "",
        userInstructions: "",
      },
      erp: {
        provider: "demo",
        url: "",
        apiType: "odata",
        username: "",
        password: "",
        apiKey: "",
        specUrl: "",
      },
    });
  });

  it("updates LLM provider when setLLMSettings is called", () => {
    useSettingsStore.getState().setLLMSettings({ provider: "groq" });
    expect(useSettingsStore.getState().llm.provider).toBe("groq");
  });

  it("replaces previous provider when switching (no leak)", () => {
    useSettingsStore.getState().setLLMSettings({
      provider: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: "groq-key",
    });
    expect(useSettingsStore.getState().llm.provider).toBe("groq");
    expect(useSettingsStore.getState().llm.apiKey).toBe("groq-key");

    useSettingsStore.getState().setLLMSettings({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "openai-key",
    });
    expect(useSettingsStore.getState().llm.provider).toBe("openai");
    expect(useSettingsStore.getState().llm.apiKey).toBe("openai-key");
    expect(useSettingsStore.getState().llm.baseUrl).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("updates ERP provider when setERPSettings is called", () => {
    useSettingsStore.getState().setERPSettings({ provider: "1c" });
    expect(useSettingsStore.getState().erp.provider).toBe("1c");
  });

  it("ERP demo mode is set by default and can be switched to 1C", () => {
    expect(useSettingsStore.getState().erp.provider).toBe("demo");
    useSettingsStore
      .getState()
      .setERPSettings({ provider: "1c", url: "https://1c.example.com" });
    expect(useSettingsStore.getState().erp.provider).toBe("1c");
    expect(useSettingsStore.getState().erp.url).toBe("https://1c.example.com");
  });
});
