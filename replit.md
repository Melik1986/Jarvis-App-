# JSRVIS 1C Mobile

## Overview

JSRVIS is a mobile AI assistant application designed to transform unstructured input (voice, photos, chat) into structured business commands for 1C ERP systems. The app provides a conversational interface that replaces complex enterprise software navigation, allowing users to interact with their business systems through natural language, voice commands, and document scanning.

The project follows a monorepo structure with an Expo React Native mobile client and an Express.js backend server, sharing types and schemas between them.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Expo SDK 54 with React Native 0.81
- **Navigation**: React Navigation with native stack and bottom tab navigators
- **State Management**: Zustand with AsyncStorage persistence for settings and chat state
- **Data Fetching**: TanStack React Query for server state
- **Styling**: Custom theme system with dark mode focus, using constants for colors, spacing, and typography
- **Animations**: React Native Reanimated for smooth UI interactions

**Key Design Decisions**:
- Dark theme primary aesthetic inspired by high-end voice assistants
- Tab-based navigation with 4 main sections: Chat, Library, History, Profile
- Modular screen stack navigators wrapped in tab navigator
- Path aliases (`@/` for client, `@shared/` for shared code) via Babel module-resolver

### Backend Architecture
- **Framework**: Express.js 5 with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **AI Integration**: OpenAI SDK configured for Replit AI Integrations (custom base URL)
- **Build Tool**: esbuild for production server bundling

**API Structure**:
- RESTful endpoints under `/api/` prefix
- Streaming SSE support for real-time chat responses
- Audio processing routes for voice transcription (Whisper) and text-to-speech
- Image generation routes using gpt-image-1 model

**Key Design Decisions**:
- Separation of concerns with dedicated route modules (chat, audio, image)
- Storage abstraction layer (`IChatStorage` interface) for database operations
- CORS configuration supports Replit domains and localhost for development

### Shared Layer
- **Location**: `/shared` directory
- **Contents**: Database schemas (Drizzle), Zod validation schemas, TypeScript types
- **Purpose**: Type-safe contract between client and server

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Schema**: Users, Conversations, Messages tables with proper relationships
- **Client Storage**: AsyncStorage for persisted settings (LLM provider, ERP connection, language preferences)

## External Dependencies

### AI Services
- **Replit AI Integrations**: Primary LLM provider (OpenAI-compatible API)
  - Chat completions with streaming
  - Whisper for speech-to-text
  - Text-to-speech for voice responses
  - Image generation (gpt-image-1)
- **BYO-LLM Support**: Configurable to use OpenAI, Ollama, Groq, or custom OpenAI-compatible endpoints

### Database
- **PostgreSQL**: Required for production; connection via `DATABASE_URL` environment variable
- **Drizzle Kit**: Schema migrations stored in `/migrations`

### Mobile Platform Services
- **expo-av**: Audio recording for voice input
- **expo-camera**: Document scanning capabilities
- **expo-image-picker**: Photo selection for document analysis
- **expo-haptics**: Tactile feedback on interactions

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_API_KEY`: API key for Replit AI
- `AI_INTEGRATIONS_OPENAI_BASE_URL`: Base URL for AI integrations
- `EXPO_PUBLIC_DOMAIN`: Public domain for API calls from client
- `REPLIT_DEV_DOMAIN`: Development domain (auto-set by Replit)

### Build & Development
- **Metro**: React Native bundler with custom configuration for Hermes
- **tsx**: TypeScript execution for development server
- **Prettier + ESLint**: Code formatting and linting with Expo config

## Recent Changes

### Internationalization (i18n)
- Full localization system with 6 languages: Russian (ru), English (en), German (de), French (es), Spanish (es), Chinese (zh)
- Translation system in `client/i18n/translations.ts` with type-safe TranslationKey
- `useTranslation` hook for accessing translations in components
- Language selection screen with visual checkmarks

### Theming
- Light and dark theme support with complete color palette in `client/constants/theme.ts`
- `useTheme` hook for dynamic theme switching
- Theme toggle in Profile screen with sun/moon icons
- Theme state persisted in settingsStore via AsyncStorage

### LLM Provider Settings
- Model picker with dropdown showing provider-specific models:
  - Replit AI: gpt-4o, gpt-4o-mini, claude-3.5-sonnet, claude-3-haiku
  - OpenAI: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o1-preview, o1-mini
  - Ollama: llama3.2, llama3.1, mistral, codellama, phi3, gemma2
  - Groq: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
  - Custom: OpenAI-compatible endpoint support

### History Screen
- Swipe-to-delete functionality for chat history using react-native-gesture-handler
- Delete confirmation with platform-specific alert/confirm
- Animated swipe gesture with Reanimated

### Custom SVG Icons
- AnimatedSunIcon, AnimatedMoonIcon for theme toggle
- AnimatedTrashIcon for delete action
- All icons in `client/components/AnimatedIcons.tsx`

### Keyboard Handling
- KeyboardAwareScrollView from react-native-keyboard-controller in settings screens
- Proper bottomOffset to prevent keyboard from hiding input fields