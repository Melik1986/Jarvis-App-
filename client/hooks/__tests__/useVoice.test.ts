import { act, renderHook } from "@testing-library/react-native";
import * as FileSystem from "expo-file-system/legacy";
import { useVoice } from "../useVoice";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";

jest.mock("expo-audio", () => {
  const recorder = {
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    uri: "file://mock/recording.m4a",
  };

  return {
    __esModule: true,
    useAudioRecorder: jest.fn(() => recorder),
    useAudioRecorderState: jest.fn(() => ({ isRecording: true })),
    useAudioPlayer: jest.fn(() => ({ pause: jest.fn() })),
    AudioModule: {
      requestRecordingPermissionsAsync: jest
        .fn()
        .mockResolvedValue({ granted: true }),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    RecordingPresets: { HIGH_QUALITY: "HIGH_QUALITY" },
  };
});

jest.mock("expo-file-system/legacy", () => ({
  __esModule: true,
  readAsStringAsync: jest.fn(),
}));

describe("useVoice", () => {
  beforeEach(() => {
    useChatStore.setState({
      conversations: [],
      currentConversationId: null,
      messages: [],
      isLoading: false,
      isStreaming: false,
      streamingContent: "",
    });
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
    global.fetch = jest.fn();
    (FileSystem.readAsStringAsync as jest.Mock).mockReset();
  });

  it("sets error when file fetch fails", async () => {
    useChatStore.setState({ currentConversationId: 1 });
    useAuthStore.setState({
      session: {
        accessToken: "token",
        refreshToken: "refresh",
        expiresIn: 3600,
      },
      isAuthenticated: true,
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValueOnce(
      new TypeError("Network request failed"),
    );

    const { result } = renderHook(() => useVoice());

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.error).toBe("Failed to process voice message");
  });

  it("sets error when conversation is missing", async () => {
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce("MOCK");
    (global.fetch as jest.Mock).mockImplementation(async () => ({
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
        }),
      },
    }));

    const { result } = renderHook(() => useVoice());

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.error).toBe("Failed to process voice message");
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
  });
});
