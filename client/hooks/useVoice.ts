import { useState, useCallback, useEffect } from "react";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorderState,
  useAudioPlayer,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Platform, Alert } from "react-native";
import { getApiUrl, authenticatedFetch } from "@/lib/query-client";
import { useChatStore } from "@/store/chatStore";
import { useSettingsStore } from "@/store/settingsStore";
import { AppLogger } from "@/lib/logger";
import {
  getUserFriendlyMessage,
  logError,
  extractErrorFromResponse,
} from "@/lib/error-handler";

interface VoiceResponse {
  userTranscript: string;
  assistantTranscript: string;
  audioData?: string; // Base64 PCM audio
}

/**
 * Hook for voice interactions with Axon using modern expo-audio API.
 * Handles recording, transcription, and audio playback.
 */
export function useVoice() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const player = useAudioPlayer(""); // Empty source initially

  const { currentConversationId } = useChatStore();
  // Auth handled by authenticatedFetch
  const { llm, erp, rag } = useSettingsStore();

  /**
   * Request microphone permissions
   */
  useEffect(() => {
    (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (status.granted) {
          await setAudioModeAsync({
            playsInSilentMode: true,
            allowsRecording: true,
          });
        } else {
          setError("Microphone permission denied");
        }
      } catch (err) {
        AppLogger.error("Error requesting permissions:", err);
      }
    })();
  }, []);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission to access microphone was denied");
        return false;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      return true;
    } catch (err) {
      AppLogger.error("Error starting recording:", err);
      setError("Failed to start recording");
      return false;
    }
  }, [audioRecorder]);

  /**
   * Play audio from base64 PCM/WAV data
   */
  const playAudio = useCallback(async (base64Audio: string): Promise<void> => {
    try {
      setIsPlaying(true);

      if (Platform.OS === "web") {
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(
          base64ToArrayBuffer(base64Audio),
        );
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => setIsPlaying(false);
        source.start();
      } else {
        // For native (iOS/Android), write base64 to temp file and play
        const tempPath = `${FileSystem.cacheDirectory}axon-tts-response.wav`;

        // Write base64 audio to temp file
        await FileSystem.writeAsStringAsync(tempPath, base64Audio, {
          encoding: "base64",
        });

        // Create a new Audio instance for playback
        const { createAudioPlayer } = await import("expo-audio");
        const audioPlayer = createAudioPlayer({ uri: tempPath });

        audioPlayer.addListener("playbackStatusUpdate", (status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            // Cleanup temp file
            FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {
              // Ignore cleanup errors
            });
          }
        });

        await audioPlayer.play();
      }
    } catch (err) {
      AppLogger.error("Error playing audio:", err);
      setIsPlaying(false);
    }
  }, []);

  /**
   * Stop recording and send to server
   */
  const stopRecording = useCallback(async (): Promise<VoiceResponse | null> => {
    if (!recorderState.isRecording) {
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Stop recording
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error("No recording URI");
      }

      // Read audio file and convert to base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      // Send to server
      if (!currentConversationId) {
        throw new Error("No active conversation");
      }

      const baseUrl = getApiUrl();

      const serverResponse = await authenticatedFetch(
        `${baseUrl}api/voice/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: base64,
            transcriptionModel: llm.transcriptionModel || "whisper-1",
            llmSettings: {
              provider: llm.provider,
              baseUrl: llm.baseUrl,
              apiKey: llm.apiKey,
              modelName: llm.modelName,
            },
            erpSettings: {
              provider: erp.provider,
              baseUrl: erp.url,
              username: erp.username,
              password: erp.password,
              apiKey: erp.apiKey,
              apiType: erp.apiType,
            },
            ragSettings: {
              provider: rag.provider,
              qdrant: rag.qdrant,
            },
          }),
        },
      );

      if (!serverResponse.ok) {
        const apiError = await extractErrorFromResponse(serverResponse);
        throw apiError;
      }

      const responseText = await serverResponse.text();
      const lines = responseText.split("\n");
      let userTranscript = "";
      let assistantTranscript = "";
      const audioChunks: string[] = [];

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === "user_transcript") {
            userTranscript = data.data;
          } else if (data.type === "transcript" || data.content) {
            assistantTranscript += data.data ?? data.content ?? "";
          } else if (data.type === "audio") {
            audioChunks.push(data.data);
          } else if (data.type === "error" || data.error) {
            throw new Error(data.error || "Voice request failed");
          }
        } catch (err) {
          if (!(err instanceof SyntaxError)) {
            throw err;
          }
        }
      }

      const result: VoiceResponse = {
        userTranscript,
        assistantTranscript,
        audioData: audioChunks.length > 0 ? audioChunks.join("") : undefined,
      };

      if (userTranscript) {
        setTranscription(userTranscript);
      }

      // Auto-play response audio if available
      if (result.audioData) {
        await playAudio(result.audioData);
      }

      return result;
    } catch (err) {
      // Log error with context
      logError(err, "useVoice.stopRecording", {
        conversationId: currentConversationId,
        provider: llm.provider,
      });

      // Get user-friendly error message
      const friendlyMessage = getUserFriendlyMessage(err);

      // Check if it's a transcription-specific error
      const errorMsg = err instanceof Error ? err.message : friendlyMessage;
      const isTranscriptionError =
        errorMsg.includes("transcri") ||
        errorMsg.includes("audio") ||
        errorMsg.includes("model") ||
        errorMsg.includes("404") ||
        errorMsg.includes("whisper");

      if (isTranscriptionError) {
        // Graceful warning in chat instead of generic error
        const { addMessage } = useChatStore.getState();
        addMessage({
          id: Date.now(),
          role: "assistant",
          content: `⚠️ Voice transcription failed: ${friendlyMessage}\n\nCheck Settings → LLM Provider → Transcription Model. Providers like Ollama may not support audio transcription API.`,
          createdAt: new Date().toISOString(),
        });
      }

      setError(isTranscriptionError ? "" : friendlyMessage);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [
    audioRecorder,
    recorderState.isRecording,
    currentConversationId,
    llm,
    erp,
    rag,
    playAudio,
  ]);

  /**
   * Cancel current recording
   */
  const cancelRecording = useCallback(async (): Promise<void> => {
    if (recorderState.isRecording) {
      try {
        await audioRecorder.stop();
      } catch {
        // Ignore errors during cancel
      }
    }
  }, [audioRecorder, recorderState.isRecording]);

  /**
   * Stop any playing audio
   */
  const stopPlayback = useCallback(async (): Promise<void> => {
    try {
      player.pause();
      setIsPlaying(false);
    } catch {
      // Ignore errors
    }
  }, [player]);

  return {
    // State
    isRecording: recorderState.isRecording,
    isProcessing,
    isPlaying,
    error,
    transcription,

    // Actions
    startRecording,
    stopRecording,
    cancelRecording,
    playAudio,
    stopPlayback,
    requestPermissions: async () =>
      (await AudioModule.requestRecordingPermissionsAsync()).granted,
  };
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
