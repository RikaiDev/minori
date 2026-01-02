# CLAUDE.md

> Guidelines for AI assistants working on the minori project.

## Project Overview

**minori** (実り) is an AI-powered agricultural collaboration platform that helps farmers record field activities through voice and photos, while AI predicts harvest timing and yields.

## Core Principles

### 1. Language & Internationalization

- **Code**: All code, comments, variable names, and documentation must be in **English**
- **User-facing content**: Must support **i18n** (internationalization)
  - Primary locales: `zh-TW` (Traditional Chinese), `en` (English)
  - All user messages, error messages, and UI text must use i18n keys
  - Never hardcode user-facing strings directly in code

```typescript
// ❌ Bad - Hardcoded Chinese
const message = '已記錄！小白菜 2分地';

// ✅ Good - Using i18n
const message = t('record.planting.success', { crop: 'bok-choy', area: 2 });
```

### 2. Code Style

- **TypeScript**: Strict mode enabled, explicit return types for public functions
- **Formatting**: Prettier with project defaults
- **Linting**: ESLint with recommended rules
- **Comments**: English only, use JSDoc for public APIs

```typescript
/**
 * Predicts harvest date based on planting date and weather data.
 *
 * @param crop - Crop information from the database
 * @param plantingDate - Date when the crop was planted
 * @param weather - Optional weather forecast data
 * @returns Harvest prediction with confidence score
 */
export function predictHarvest(
  crop: CropInfo,
  plantingDate: Date,
  weather?: WeatherData[]
): HarvestPrediction {
  // Implementation
}
```

### 3. Project Structure

```
minori/
├── packages/
│   ├── shared/           # Shared types, utilities, i18n
│   │   └── src/
│   │       ├── types/    # TypeScript type definitions
│   │       ├── utils/    # Utility functions
│   │       └── i18n/     # Internationalization
│   │           ├── locales/
│   │           │   ├── en.json
│   │           │   └── zh-TW.json
│   │           └── index.ts
│   ├── core/             # Core business logic
│   ├── ai-engine/        # AI/ML components
│   └── line-bot/         # LINE Bot integration
├── apps/
│   └── api/              # API server (Hono + Bun)
└── docs/                 # Documentation
```

### 4. Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `harvest-predictor.ts` |
| Directories | kebab-case | `ai-engine/` |
| Variables | camelCase | `harvestDate` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Types/Interfaces | PascalCase | `CropInfo` |
| Functions | camelCase | `predictHarvest()` |
| i18n keys | dot.notation | `record.planting.success` |

### 5. Git Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(ai-engine): add Whisper speech recognition integration
fix(line-bot): handle audio message timeout
docs(readme): update installation instructions
```

### 6. Testing

- Write tests for all public functions
- Use Bun's built-in test runner
- Test file naming: `*.test.ts`

```typescript
// crop-database.test.ts
import { describe, expect, test } from 'bun:test';
import { findCropByName } from './crop-database';

describe('findCropByName', () => {
  test('finds crop by exact name', () => {
    const crop = findCropByName('小白菜');
    expect(crop).toBeDefined();
    expect(crop?.id).toBe('bok-choy');
  });

  test('finds crop by alias', () => {
    const crop = findCropByName('青江菜');
    expect(crop).toBeDefined();
    expect(crop?.id).toBe('bok-choy');
  });

  test('returns undefined for unknown crop', () => {
    const crop = findCropByName('unknown');
    expect(crop).toBeUndefined();
  });
});
```

### 7. Error Handling

- Use custom error classes for domain-specific errors
- Always provide meaningful error messages (in English)
- Log errors with context

```typescript
export class CropNotFoundError extends Error {
  constructor(public readonly cropName: string) {
    super(`Crop not found: ${cropName}`);
    this.name = 'CropNotFoundError';
  }
}
```

### 8. API Design

- RESTful endpoints where applicable
- Use Hono framework
- Validate inputs using Zod or similar
- Return consistent response format

```typescript
// Success response
{
  "success": true,
  "data": { ... }
}

// Error response
{
  "success": false,
  "error": {
    "code": "CROP_NOT_FOUND",
    "message": "Crop not found: xyz"
  }
}
```

### 9. Environment Variables

- Document all required env vars in `.env.example`
- Use descriptive names with prefixes
- Never commit secrets

```bash
# LINE Bot
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

# OpenAI
OPENAI_API_KEY=

# Database (future)
DATABASE_URL=
```

### 10. Dependencies

- Prefer well-maintained, popular packages
- Pin major versions
- Document why non-obvious dependencies are needed

Current core dependencies:
- `hono` - Web framework
- `openai` - OpenAI API client
- `@line/bot-sdk` - LINE Bot SDK

## Common Tasks

### Adding a New Crop to Database

1. Add entry to `packages/core/src/crops/crop-database.ts`
2. Add i18n translations for crop name in both locales
3. Add test case in `crop-database.test.ts`

### Adding a New Intent

1. Update `IntentAction` type in `packages/shared/src/types/intent.ts`
2. Add parsing logic in `packages/ai-engine/src/intent/parser.ts`
3. Add handler in `packages/line-bot/src/handlers/`
4. Add i18n messages for the intent responses

### Adding i18n Messages

1. Add key to `packages/shared/src/i18n/locales/en.json`
2. Add translation to `packages/shared/src/i18n/locales/zh-TW.json`
3. Use `t('key')` or `t('key', { param: value })` in code

## Important Notes

- This project targets **Taiwanese farmers**, so `zh-TW` locale is primary for UX
- Support for **Taiwanese (Hokkien)** speech via Whisper (set `language: 'zh'`)
- LINE is the primary interface — design for mobile-first chat experience
- Elderly users — keep interactions simple, prefer voice over typing
