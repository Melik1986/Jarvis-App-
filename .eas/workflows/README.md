# EAS CI/CD Workflows - Инструкция

## Структура workflow файлов

```
.eas/workflows/
├── ci-cd.yml
├── development.yml
└── production.yml
```

## Workflow для dev ветки

**Файл:** `.eas/workflows/development.yml`

**Триггеры:** Push и PR в ветку `dev`

**Шаги:**
1. Сборка Android APK с профилем `development`
2. OTA обновление в канал `dev`

**Команда для запуска вручную (через путь к файлу):**
```bash
npx eas workflow:run .eas/workflows/development.yml --non-interactive
```

## Workflow для main ветки

**Файл:** `.eas/workflows/production.yml`

**Триггеры:** Push и PR в ветку `main`

**Шаги:**
1. Сборка iOS с профилем `production`
2. Сборка Android с профилем `production`
3. Отправка iOS сборки в App Store Connect
4. Отправка Android сборки в Google Play Console
5. OTA обновление в канал `production`

**Команда для запуска вручную (через путь к файлу):**
```bash
npx eas workflow:run .eas/workflows/production.yml --non-interactive
```

## Настройка перед первым запуском

### 1. Убедитесь, что EAS CLI установлен:
```bash
npm install -g eas-cli
eas login
```

### 2. Проверьте настройки в `eas.json`:
- Профили `development` и `production` настроены корректно
- Каналы `development` и `production` определены в разделе `update`

### 3. Настройте credentials для публикации:

**Для iOS (App Store):**
```bash
eas credentials:manager
# Выберите iOS и следуйте инструкциям для настройки Apple Developer Account
```

**Для Android (Google Play):**
```bash
eas credentials:manager
# Выберите Android и загрузите service account key из Google Play Console
```

## Команды для работы с workflows

### Запуск workflow вручную:
```bash
npx eas workflow:run .eas/workflows/development.yml --non-interactive
npx eas workflow:run .eas/workflows/production.yml --non-interactive
npx eas workflow:run .eas/workflows/ci-cd.yml --non-interactive
```

### Просмотр статуса workflow:
```bash
# Список всех запусков
eas workflow:list

# Детали конкретного запуска
eas workflow:view [WORKFLOW_ID]

# Логи workflow
eas build:view [BUILD_ID]
```

### Проверка logs в реальном времени:
```bash
eas build:logs [BUILD_ID]
```

## Кэширование

Все workflow используют кэширование EAS build артефактов.

## Уведомления

После успешного завершения workflow:
- Dev workflow обновляет dev канал и предоставляет свежую сборку для тестирования.
- Production workflow отправляет сборки в сторы и обновляет production канал.

## Отладка

Если workflow падает:

1. **Проверьте логи:**
   ```bash
   eas workflow:view [WORKFLOW_ID]
   ```

## Безопасность
Workflow сосредоточены на сборке и публикации. Проверки кода и поиск секретов выполняются на уровне Husky hooks и вашего локального окружения.

## Поддержка

При проблемах:
1. Проверьте логи workflow
2. Убедитесь, что все credentials настроены
3. Проверьте, что Docker запущен (для gitleaks в Husky)
4. Обратитесь к документации EAS: https://docs.expo.dev/build/eas-workflows/
