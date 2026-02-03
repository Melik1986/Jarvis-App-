import { useState, useCallback, useEffect } from "react";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorderState,
  useAudioPlayer,
} from "expo-audio";
import { Platform, Alert } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { AppLogger } from "@/lib/logger";

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
  const { session } = useAuthStore();

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
   * Play audio from base64 PCM data
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
        // For SDK 55 native, we can use the new audio player
        // Note: This might require temporary file creation for base64
        AppLogger.info("Native audio playback triggered");
        // Simplified: using player with base64 data URI if supported or via file
        // For hackathon: assuming base64 works or logging info
        setIsPlaying(false);
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
      const response = await fetch(uri);
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      // Send to server
      if (!currentConversationId) {
        throw new Error("No active conversation");
      }

      const baseUrl = getApiUrl();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
      }

      const serverResponse = await fetch(
        `${baseUrl}api/voice/${currentConversationId}/message`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ audio: base64 }),
        },
      );

      // Process SSE response
      const reader = serverResponse.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let userTranscript = "";
      let assistantTranscript = "";
      const audioChunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "user_transcript") {
              userTranscript = data.data;
            } else if (data.type === "transcript") {
              assistantTranscript += data.data;
            } else if (data.type === "audio") {
              audioChunks.push(data.data);
            }
          } catch {
            // Ignore parse errors
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
      AppLogger.error("Error processing recording:", err);
      setError("Failed to process voice message");
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [
    audioRecorder,
    recorderState.isRecording,
    currentConversationId,
    session,
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

// Helper functions
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
