<!-- rikai-logo -->
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
    <img src=".github/assets/logo.svg" alt="minori" width="96" height="96">
  </picture>
</p>

# minori (実り)

> AI-powered agricultural collaboration platform — Voice-first field recording with harvest prediction

[![CI](https://github.com/RikaiDev/minori/actions/workflows/ci.yml/badge.svg)](https://github.com/RikaiDev/minori/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

**minori** (Japanese: 実り, meaning "harvest" or "fruition") is an AI-powered platform designed to help agricultural cooperatives manage crop production and supply chain coordination. It enables farmers to record field activities through voice and photos, while AI predicts harvest timing and yields.

### Key Features

- 🎤 **Voice Recording** — Speak to record, accessible for elderly farmers
- 📷 **Photo Recognition** — Identify crops and growth stages from photos
- 🤖 **AI Prediction** — Predict harvest dates and yields based on climate data
- 📊 **Supply-Demand Matching** — Connect farmers with buyers through cooperatives
- 💬 **LINE Integration** — No additional app installation required

## Philosophy

minori follows the [AII (AI Interactive)](https://github.com/RikaiDev/AII) design philosophy:

> Interfaces should understand humans, not force humans to learn interfaces.

Farmers simply speak or take photos — AI understands and acts accordingly.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0

### Installation

```bash
# Clone the repository
git clone git@github.com:RikaiDev/minori.git
cd minori

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env
# Edit .env and fill in required API keys
```

### Development

```bash
# Start development server
bun run dev

# Type checking
bun run typecheck

# Run tests
bun run test

# Lint
bun run lint
```

## Project Structure

```
minori/
├── packages/
│   ├── shared/        # Shared types and utilities
│   ├── core/          # Core logic (prediction, crop database)
│   ├── ai-engine/     # AI engine (speech recognition, intent parsing)
│   └── line-bot/      # LINE Bot integration
├── apps/
│   └── api/           # API server
└── docs/              # Documentation
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LINE Official Account                │
│              (Farmers / Cooperatives / Buyers)          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     AI Engine                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Whisper   │  │   Intent    │  │   Vision    │     │
│  │   (Speech)  │  │   Parser    │  │    (Photo)  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      Core                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │    Crop     │  │   Harvest   │  │    Price    │     │
│  │  Database   │  │  Predictor  │  │   Analyzer  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

## Documentation

- [API Reference](docs/api.md) — Endpoint documentation
- [Architecture](docs/architecture.md) — System design and diagrams
- [Contributing Guide](CONTRIBUTING.md) — How to contribute
- [Claude Guidelines](CLAUDE.md) — AI assistant coding standards

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Community

- [Issues](https://github.com/RikaiDev/minori/issues) — Bug reports and feature requests
- [Discussions](https://github.com/RikaiDev/minori/discussions) — Questions and ideas

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenAI Whisper](https://openai.com/research/whisper) — Speech recognition
- [LINE Messaging API](https://developers.line.biz/) — Chat platform
- [Taiwan Central Weather Administration](https://opendata.cwa.gov.tw/) — Weather data
