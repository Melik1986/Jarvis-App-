# AXON ERP Mobile - Design Guidelines

## 1. Brand Identity

**Purpose**: Enterprise AI assistant that transforms unstructured input (voice, photos, chat) into structured ERP business commands. Replaces complex enterprise software navigation with conversational interaction.

**Aesthetic Direction**: **Tech-refined Professional**

- Inspired by high-end voice assistants (think Jarvis meets enterprise software)
- Dark theme primary with subtle tech gradients
- Clean, spacious layouts emphasizing the AI conversation
- Sophisticated animations that feel intelligent, not playful
- Premium materials: subtle glows, smooth transitions, glass-morphism effects

**Memorable Element**: Voice waveform animation during recording that pulses with AI "thinking" states - creates the feeling of conversing with an intelligent entity.

---

## 2. Navigation Architecture

**Root Navigation**: Tab Navigation (4 tabs with floating action button for voice)

**Tabs**:

1. **Chat** - Main conversation interface with Jarvis
2. **Library** - Knowledge base search (RAG)
3. **History** - Past commands and analytics
4. **Profile** - Settings and account management

**Floating Action Button**: Voice recording (positioned in center-bottom, above tab bar)

**Authentication Flow**: Stack-only flow before main app

- Phone number entry screen
- OTP verification screen
- Welcome/onboarding (optional, can be skipped)

---

## 3. Screen-by-Screen Specifications

### Auth Flow

**Phone Entry Screen**

- Layout: Full-screen centered form, no header
- Content:
  - App logo and "AXON" wordmark at top
  - Phone input field with country code selector
  - "Continue" button (disabled until valid number)
  - Privacy policy link at bottom
- Safe area: top: insets.top + 48px, bottom: insets.bottom + 24px

**OTP Verification Screen**

- Layout: Full-screen centered, custom back button top-left
- Content:
  - "Enter verification code" heading
  - 6-digit OTP input boxes
  - Resend code timer/button
  - Auto-submit on completion
- Safe area: top: insets.top + 48px, bottom: insets.bottom + 24px

### Main App (Tab Navigation)

**Chat Screen** (Default tab)

- Header: Transparent with "AXON" title centered, settings icon top-right
- Content:
  - Gifted Chat component (full-screen)
  - Voice waveform overlay when recording
  - Camera icon in input toolbar for Vision feature
  - Typing indicator shows "Jarvis is thinking..."
- Empty state: Illustration with suggested commands ("Try: Check stock for item X")
- Safe area: top: headerHeight + 16px, bottom: tabBarHeight + 88px (extra space for FAB)
- Floating voice button overlaps tab bar

**Library Screen**

- Header: Standard with "Knowledge Base" title, search icon top-right
- Content:
  - Search bar below header (sticky)
  - Scrollable list of knowledge categories (cards)
  - Tap category to see articles
  - Recent searches section at top
- Empty state (when no results): Illustration with "No results found"
- Safe area: top: 16px, bottom: tabBarHeight + 24px

**History Screen**

- Header: Standard with "Activity" title, filter icon top-right
- Content:
  - Segmented control: "Commands" / "Analytics"
  - Scrollable list of past interactions
  - Each item shows: timestamp, command, status badge
  - Swipe to delete
- Empty state: Illustration with "No activity yet"
- Safe area: top: 16px, bottom: tabBarHeight + 24px

**Profile Screen**

- Header: Transparent with "Profile" title
- Content:
  - User avatar and name at top (editable on tap)
  - Scrollable settings list below:
    - Account section (phone number, logout)
    - Preferences (theme, language, voice settings)
    - About (version, support, privacy)
  - "Delete Account" nested under Settings > Account > Delete
- Safe area: top: headerHeight + 16px, bottom: tabBarHeight + 24px

**Detail Screens** (Modal or Push)

**Knowledge Article Screen**

- Header: Standard with article title, share icon top-right
- Content: Scrollable article content with markdown support
- Safe area: top: 16px, bottom: insets.bottom + 24px

**Voice Settings Screen**

- Header: Standard with "Voice Settings" title
- Content:
  - Form with language selection
  - Voice speed slider
  - Test voice button
- Safe area: top: 16px, bottom: insets.bottom + 24px

---

## 4. Color Palette

```
Primary (AI/Actions):
- primary: #00D9FF (Cyan - tech, futuristic)
- primaryDark: #00A3BF

Background (Dark Theme):
- background: #0A0E1A (Deep navy-black)
- surface: #151B2E (Elevated cards)
- surfaceHover: #1F2637

Text:
- textPrimary: #FFFFFF
- textSecondary: #A0AABF
- textTertiary: #6B7589

Semantic:
- success: #00E676 (Command executed)
- error: #FF5252 (Error state)
- warning: #FFB74D (Pending/processing)

Accents:
- accent: #7C4DFF (Secondary actions)
- glow: rgba(0, 217, 255, 0.3) (For voice waveform)
```

---

## 5. Typography

**Font**: System fonts (SF Pro for iOS, Roboto for Android) with fallback to Inter from Google Fonts for cross-platform consistency

**Type Scale**:

- H1 (Screen titles): 32px, Bold
- H2 (Section headers): 24px, Semibold
- H3 (Card titles): 18px, Semibold
- Body: 16px, Regular
- Secondary: 14px, Regular
- Caption: 12px, Regular

**Chat-specific**:

- User messages: 16px Regular, right-aligned
- AI responses: 16px Regular, left-aligned with subtle glow on code snippets

---

## 6. Design System

**Touchable Feedback**:

- Buttons: Scale down to 0.95 on press + slight opacity (0.8)
- List items: Background color change to surfaceHover
- FAB: Scale to 0.92 + shadow intensity increase

**Floating Voice Button**:

- Drop shadow: shadowOffset {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8
- Gradient background (primary to primaryDark)
- 64px diameter, positioned center-bottom, 16px above tab bar
- Ripple animation on press, waveform animation while recording

**Visual Elements**:

- Use Feather icons throughout (microphone, camera, search, settings, etc.)
- Glass-morphism for modal overlays: backdrop blur + semi-transparent surface
- Subtle gradient borders on cards (1px, primary at 20% opacity)

---

## 7. Assets to Generate

**Required**:

1. **icon.png** - App icon with AXON logo, cyan gradient circular background
   - WHERE: Device home screen, splash screen
2. **splash-icon.png** - Simplified AXON logo, white on transparent
   - WHERE: App launch screen

3. **empty-chat.png** - Illustration of microphone with sound waves, minimalist cyan/white
   - WHERE: Chat screen when no messages

4. **empty-library.png** - Illustration of book/knowledge icon with search symbol
   - WHERE: Library screen when no content/search results

5. **empty-history.png** - Illustration of clock/timeline icon
   - WHERE: History screen when no activity

**Recommended**: 6. **onboarding-1.png** - Illustration showing voice interaction concept

- WHERE: Optional onboarding first screen

7. **onboarding-2.png** - Illustration showing photo scanning feature
   - WHERE: Optional onboarding second screen

8. **avatar-default.png** - Neutral professional avatar placeholder (abstract geometric)
   - WHERE: Profile screen, user hasn't uploaded photo

**Style for all assets**: Minimalist, tech-forward, using cyan accent color on dark backgrounds, avoid clipart aesthetic - prefer abstract geometric shapes or simple line art.
