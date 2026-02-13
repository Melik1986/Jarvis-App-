/**
 * Chat configuration constants
 * Centralized configuration for chat screen behavior
 */
export const CHAT_CONFIG = {
  /**
   * Number of recent messages to keep in memory for context
   * Used in recent message filtering logic
   */
  RECENT_KEEP: 6,

  /**
   * Time window in milliseconds for recent messages
   * Used to determine which messages are considered "recent"
   */
  RECENT_WINDOW: 6,

  /**
   * Minimum total messages before auto-summarization starts
   * Prevents premature summarization of short conversations
   */
  SUMMARY_MIN_MESSAGES: 8,

  /**
   * Frequency of auto-summarization (every N messages)
   * Controls how often conversation summary is updated
   */
  SUMMARY_FREQUENCY: 4,

  /**
   * Maximum number of messages to display in chat
   * Prevents performance issues with large conversations
   */
  MAX_DISPLAY_MESSAGES: 100,

  /**
   * Auto-scroll threshold in pixels
   * Determines when to auto-scroll to bottom
   */
  AUTO_SCROLL_THRESHOLD: 100,

  /**
   * Debounce delay for input in milliseconds
   * Prevents excessive re-renders during typing
   */
  INPUT_DEBOUNCE_MS: 300,

  /**
   * Maximum message length in characters
   * Prevents UI issues with very long messages
   */
  MAX_MESSAGE_LENGTH: 4000,

  /**
   * Typing indicator duration in milliseconds
   * How long to show typing indicator
   */
  TYPING_INDICATOR_DURATION: 2000,
} as const;
