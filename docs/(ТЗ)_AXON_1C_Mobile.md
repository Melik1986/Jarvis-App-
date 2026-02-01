выбор стека — это 10 из 10 для хакатона. Nest.js даст ту стабильность и типизацию, которой часто не хватает проектам на n8n при масштабировании, а Tamagui сделает интерфейс «дорогим» и быстрым.

Ниже я подготовил фундамент проекта. Это твоя дорожная карта, чтобы не просто успеть к дедлайну, но и выделиться на фоне других участников качеством инженерных решений.

Техническое задание (ТЗ): AXON Mobile ERP Agent

1. Цель проекта Создание мобильного AI-агента для управления бизнес-процессами в ERP. Система должна преобразовывать неструктурированный ввод (голос, фото, чат) в структурированные вызовы API ERP и предоставлять аналитическую поддержку через RAG (базу знаний).

2. Основные модули

Голосовой интерфейс (Jarvis Voice): Запись аудио через expo-av, транскрибация через Whisper и выполнение команд.

Зрение (Jarvis Vision): Анализ фото накладных и ценников через GPT-4o-mini для автоматического создания документов.

Библиотекарь (RAG): Поиск по внутренним инструкциям и регламентам компании из Qdrant.

Интегратор ERP: Прослойка на Nest.js, которая авторизует запросы и переводит намерения AI в OData или HTTP-запросы к ERP.

1. Технические требования

Авторизация через Phone OTP (Supabase).

Поддержка Offline-first для просмотра остатков (Zustand + Persist).

Стриминг ответов LLM для улучшения UX (Vercel AI SDK).

Структура проекта (Monorepo-style в Replit)
Для ускорения разработки мы организуем код так, чтобы типизация была сквозной.

Plaintext
/axon-1c-mobile
├── apps
│ ├── mobile (Expo Project)
│ │ ├── src
│ │ │ ├── components (UI: Chat, VoiceButton, CameraScanner)
│ │ │ ├── hooks (useJarvis, useERP, useVoice)
│ │ │ ├── store (Zustand: authStore, inventoryStore)
│ │ │ └── services (API wrappers)
│ │ └── app.json (Expo config)
│ └── server (Nest.js Project)
│ ├── src
│ │ ├── ai (OpenAI, Qdrant logic)
│ │ ├── erp (ERP Integration)
│ │ ├── auth (Supabase Guard)
│ │ └── main.ts
├── shared
│ └── types (Общие интерфейсы для документов и товаров)
├── .env (Ключи: OPENAI, SUPABASE, QDRANT, ERP_URL)
└── README.md
Чек-лист разработки (Speed-run для хакатона)
Этот список поможет тебе не утонуть в деталях и двигаться по критическому пути.

Этап 1: Инфраструктура (День 1, утро)

[ ] Развернуть шаблон Expo в Replit.

[ ] Настроить проект Nest.js + bun v1.3.6 в той же или соседней папке.

[ ] Создать проект в Supabase (включить Auth и Database).

[ ] Подключить Qdrant Cloud (создать коллекцию kb_jarvis).

Этап 2: Ядро связи (День 1, вечер)

[ ] Написать в Nest.js метод /api/chat, принимающий messages.

[ ] Реализовать Function Calling для связи GPT с ERP (начать с функции get_stock).

[ ] Пробросить туннель к локальной ERP (если нужно) через Cloudflare или ngrok.

Этап 3: Мобильный интерфейс (День 2, утро)

[ ] Установить Tamagui и настроить тему.

[ ] Интегрировать react-native-gifted-chat с твоим бэкендом.

[ ] Добавить expo-av для записи голоса и отправки на бэкенд.

Этап 4: Vision и Финиш (День 2, вечер)

[ ] Реализовать загрузку фото в чат и обработку через GPT-4o-mini Vision.

[ ] Добавить "Библиотекаря" (поиск в Qdrant через embeddings).

[ ] Тестирование на реальном устройстве через Expo Go.

[ ] Запись демо-видео для конкурса.

Твой первый шаг: Boilerplate для Mobile
Чтобы ты сразу почувствовал скорость, вот пример того, как будет выглядеть твой основной экран чата с использованием выбранного стека.

<example>

TypeScript
import React, { useState, useCallback } from &#39;react&#39;;
import { GiftedChat } from &#39;react-native-gifted-chat&#39;;
import { useChat } from &#39;ai/react&#39;; // Часть Vercel AI SDK
import { YStack, Button, Text } from &#39;tamagui&#39;; // UI Kit

export default function JarvisChat() {
const [messages, setMessages] = useState([]);

// Функция отправки сообщения к твоему Nest.js API
const onSend = useCallback(async (newMessages = []) =\> {
setMessages(previousMessages =\> GiftedChat.append(previousMessages, newMessages));

const userText = newMessages[0].text;

// Вызов твоего бэкенда на Nest.js const response = await fetch('<https://www.google.com/url?sa=E&source=gmail&q=https://your-replit-link.com/api/chat>', { method: 'POST', body: JSON.stringify({ message: userText }), });

const data = await response.json();

const botMessage = { \_id: Math.random(), text: data.content, createdAt: new Date(), user: {\_id: 2, name: 'Jarvis' }, };

setMessages(previousMessages => GiftedChat.append(previousMessages, [botMessage]));

}, []);

return (
&lt;YStack f={1} backgroundColor=&quot;$background&quot;&gt;
\<GiftedChat
messages={messages}
onSend={messages =\> onSend(messages)}
user={{ \_id: 1 }}
/\>
&lt;/YStack&gt;
);
}

Совет от эксперта: На хакатоне Replit судьи обожают, когда приложение "живое". Используй Vercel AI SDK для стриминга текста — когда ответ от Джарвиса появляется постепенно, слово за словом, это создает магический эффект, который дает +20% к оценке.
