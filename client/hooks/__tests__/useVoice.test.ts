import { act, renderHook } from "@testing-library/react-native";
import * as FileSystem from "expo-file-system/legacy";

import { useVoice } from "../useVoice";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store/authStore";

const mockSecureApiRequest = jest.fn();

jest.mock("@/lib/query-client", () => ({
  __esModule: true,
  secureApiRequest: (...args: unknown[]) => mockSecureApiRequest(...args),
}));

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
  const createConversationMock = jest
    .fn<Promise<number>, [string]>()
    .mockResolvedValue(42);

  beforeEach(() => {
    createConversationMock.mockClear();
    useChatStore.setState({
      conversations: [],
      currentConversationId: null,
      messages: [],
      isLoading: false,
      isStreaming: false,
      streamingContent: "",
      createConversation: createConversationMock,
    });
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
    mockSecureApiRequest.mockReset();
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

    expect(result.current.error).toBe("Network request failed");
  });

  it("creates conversation when missing and sends voice request", async () => {
    // No conversation set (currentConversationId: null from beforeEach)
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValueOnce("MOCK");
    mockSecureApiRequest.mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    });

    const { result } = renderHook(() => useVoice());

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.error).toBeNull();
    expect(createConversationMock).toHaveBeenCalledTimes(1);
    expect(mockSecureApiRequest).toHaveBeenCalledTimes(1);
  });
});
