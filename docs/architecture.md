# Architecture

> System architecture and design decisions for minori

## Overview

minori is a monorepo-based application that provides an AI-powered interface for agricultural cooperatives through LINE messaging platform.

## System Architecture

```mermaid
flowchart TB
    subgraph Users
        F[Farmers]
        C[Cooperatives]
        B[Buyers]
    end

    subgraph LINE["LINE Platform"]
        LA[LINE Official Account]
        LM[Messaging API]
    end

    subgraph minori["minori Backend"]
        API[API Server<br/>Hono + Bun]

        subgraph AI["AI Engine"]
            W[Whisper<br/>Speech Recognition]
            I[Intent Parser<br/>GPT-4o-mini]
            V[Vision<br/>Crop Recognition]
        end

        subgraph Core["Core Logic"]
            CD[Crop Database]
            HP[Harvest Predictor]
            PA[Price Analyzer]
        end

        subgraph Data["Data Layer"]
            DB[(Database)]
            MEM[Memory System]
        end
    end

    subgraph External["External Services"]
        OAI[OpenAI API]
        CWA[Weather API]
        MKT[Market Data]
    end

    F & C & B --> LA
    LA <--> LM
    LM <--> API

    API --> AI
    AI --> Core
    Core --> Data

    W & I & V --> OAI
    HP --> CWA
    PA --> MKT
```

## Package Structure

```mermaid
graph TB
    subgraph apps["apps/"]
        API["api/<br/>Hono server"]
    end

    subgraph packages["packages/"]
        LB["line-bot/<br/>LINE integration"]
        AE["ai-engine/<br/>AI services"]
        CO["core/<br/>Business logic"]
        SH["shared/<br/>Types & i18n"]
    end

    API --> LB
    API --> AE
    LB --> AE
    LB --> CO
    LB --> SH
    AE --> CO
    AE --> SH
    CO --> SH
```

## Request Flow

### Text Message Processing

```mermaid
sequenceDiagram
    participant U as User
    participant L as LINE
    participant A as API Server
    participant I as Intent Parser
    participant C as Core Logic
    participant D as Database

    U->>L: Send text message
    L->>A: Webhook POST /webhook
    A->>A: Verify signature
    A->>I: Parse intent
    I->>I: GPT-4o-mini analysis
    I-->>A: ParsedIntent
    A->>C: Execute intent
    C->>D: Read/Write data
    D-->>C: Result
    C-->>A: Response text
    A->>L: Reply message
    L->>U: Display response
```

### Voice Message Processing

```mermaid
sequenceDiagram
    participant U as User
    participant L as LINE
    participant A as API Server
    participant W as Whisper
    participant I as Intent Parser
    participant C as Core Logic

    U->>L: Send voice message
    L->>A: Webhook with audio
    A->>L: Download audio content
    L-->>A: Audio buffer
    A->>W: Transcribe audio
    W-->>A: Transcribed text
    A->>I: Parse intent
    I-->>A: ParsedIntent
    A->>C: Execute intent
    C-->>A: Response
    A->>L: Reply message
    L->>U: Display response
```

## Data Models

### Core Entities

```mermaid
erDiagram
    COOPERATIVE ||--o{ FARMER : has
    FARMER ||--o{ FIELD : owns
    FIELD ||--o{ PLANTING_RECORD : contains
    PLANTING_RECORD ||--o{ HARVEST_RECORD : yields
    CROP ||--o{ PLANTING_RECORD : references

    COOPERATIVE {
        string id PK
        string name
        string region
        timestamp created_at
    }

    FARMER {
        string id PK
        string line_user_id UK
        string cooperative_id FK
        string name
        string phone
        timestamp created_at
    }

    FIELD {
        string id PK
        string farmer_id FK
        string name
        float area
        string area_unit
        string location
    }

    CROP {
        string id PK
        string name
        string[] aliases
        int days_to_harvest
        float optimal_temp
        string[] seasons
    }

    PLANTING_RECORD {
        string id PK
        string field_id FK
        string crop_id FK
        date planting_date
        date predicted_harvest
        string status
    }

    HARVEST_RECORD {
        string id PK
        string planting_id FK
        date harvest_date
        float quantity
        string quantity_unit
    }
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Bun | Fast JavaScript runtime |
| Framework | Hono | Lightweight web framework |
| Language | TypeScript | Type-safe development |
| AI - Speech | OpenAI Whisper | Voice transcription |
| AI - NLU | GPT-4o-mini | Intent parsing |
| AI - Vision | GPT-4 Vision | Crop recognition |
| Messaging | LINE Messaging API | User interface |
| Monorepo | Turbo | Build orchestration |

## Design Decisions

### Why LINE?

1. **Ubiquity**: LINE is the dominant messaging app in Taiwan
2. **No installation**: Works within existing app
3. **Accessibility**: Familiar interface for elderly farmers
4. **Rich features**: Voice messages, images, rich menus

### Why Voice-First?

1. **Literacy barriers**: Some farmers may have limited literacy
2. **Hands-free**: Can record while working in fields
3. **Natural**: Speaking is more natural than typing
4. **Speed**: Faster than typing on mobile

### Why Bun?

1. **Speed**: Faster than Node.js for startup and execution
2. **All-in-one**: Built-in bundler, test runner, package manager
3. **TypeScript**: Native TypeScript support without compilation
4. **Modern**: ESM-first, Web API compatible

### Why Monorepo?

1. **Code sharing**: Shared types and utilities
2. **Atomic changes**: Single PR for cross-package changes
3. **Consistent tooling**: Same lint/format/test setup
4. **Simplified deps**: Single lockfile

## Security Considerations

### Authentication

- LINE user IDs are used for farmer identification
- Webhook signatures validated using HMAC-SHA256
- No passwords stored (LINE handles auth)

### Data Protection

- Multi-tenant data isolation by cooperative
- No PII stored beyond LINE user ID
- API keys stored in environment variables

### API Security

- All endpoints require valid LINE signature
- Rate limiting follows LINE API limits
- HTTPS enforced in production

## Future Considerations

### Scalability

- Database sharding by cooperative
- Redis for session/cache
- CDN for static assets

### Reliability

- Health check endpoints for monitoring
- Graceful error handling
- Retry logic for external APIs

### Observability

- Structured logging
- Request tracing
- Error tracking (Sentry)
