import { useState, useCallback, useRef } from "react";
import { Audio } from "expo-av";
import { Platform } from "react-native";
import { getApiUrl } from "@/lib/query-client";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";

interface VoiceResponse {
  userTranscript: string;
  assistantTranscript: string;
  audioData?: string; // Base64 PCM audio
}

/**
 * Hook for voice interactions with Jarvis.
 * Handles recording, transcription, and audio playback.
 */
export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const { currentConversationId } = useChatStore();
  const { session } = useAuthStore();

  /**
   * Request microphone permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === "granted";
    } catch (err) {
      console.error("Error requesting permissions:", err);
      return false;
    }
  }, []);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    setError(null);

    // Check permissions
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setError("Microphone permission denied");
      return false;
    }

    try {
      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setIsRecording(true);
      return true;
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Failed to start recording");
      return false;
    }
  }, [requestPermissions]);

  /**
   * Stop recording and send to server
   */
  const stopRecording = useCallback(async (): Promise<VoiceResponse | null> => {
    if (!recordingRef.current) {
      return null;
    }

    setIsRecording(false);
    setIsProcessing(true);
    setError(null);

    try {
      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error("No recording URI");
      }

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

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

      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
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

      // Auto-play response audio if available
      if (result.audioData) {
        await playAudio(result.audioData);
      }

      return result;
    } catch (err) {
      console.error("Error processing recording:", err);
      setError("Failed to process voice message");
      return null;
    } finally {
      setIsProcessing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentConversationId, session]);

  /**
   * Play audio from base64 PCM data
   */
  const playAudio = useCallback(async (base64Audio: string): Promise<void> => {
    try {
      setIsPlaying(true);

      // For PCM audio, we need to create a proper audio file
      // This is a simplified implementation
      if (Platform.OS === "web") {
        // Web Audio API for PCM playback
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
        // For native, we'd need to save as WAV and play
        // This requires additional processing
        console.log("Native audio playback not fully implemented");
        setIsPlaying(false);
      }
    } catch (err) {
      console.error("Error playing audio:", err);
      setIsPlaying(false);
    }
  }, []);

  /**
   * Cancel current recording
   */
  const cancelRecording = useCallback(async (): Promise<void> => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // Ignore errors during cancel
      }
      recordingRef.current = null;
    }
    setIsRecording(false);
  }, []);

  /**
   * Stop any playing audio
   */
  const stopPlayback = useCallback(async (): Promise<void> => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // Ignore errors
      }
      soundRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  return {
    // State
    isRecording,
    isProcessing,
    isPlaying,
    error,

    // Actions
    startRecording,
    stopRecording,
    cancelRecording,
    playAudio,
    stopPlayback,
    requestPermissions,
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
