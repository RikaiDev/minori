# Contributing to minori

Thank you for your interest in contributing to minori! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates.

When creating a bug report, include:
- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Environment details (OS, Bun version, etc.)
- Any relevant logs or screenshots

### Suggesting Features

Feature suggestions are welcome! Please:
- Check if the feature has already been suggested
- Provide a clear description of the feature
- Explain the use case and benefits
- Consider potential implementation approaches

### Pull Requests

1. **Fork & Clone**
   ```bash
   git clone git@github.com:YOUR_USERNAME/minori.git
   cd minori
   ```

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

3. **Install Dependencies**
   ```bash
   bun install
   ```

4. **Make Changes**
   - Follow the code style guidelines below
   - Add tests for new features
   - Update documentation as needed

5. **Test Your Changes**
   ```bash
   bun run typecheck
   bun run lint
   bun run test
   ```

6. **Commit**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — New feature
   - `fix:` — Bug fix
   - `docs:` — Documentation only
   - `style:` — Code style (formatting, etc.)
   - `refactor:` — Code refactoring
   - `test:` — Adding tests
   - `chore:` — Maintenance tasks

7. **Push & Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then open a Pull Request on GitHub.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0
- [Git](https://git-scm.com/)

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required for full functionality:
- `LINE_CHANNEL_SECRET` — LINE Bot channel secret
- `LINE_CHANNEL_ACCESS_TOKEN` — LINE Bot access token
- `OPENAI_API_KEY` — OpenAI API key for Whisper and GPT

### Project Structure

```
minori/
├── packages/
│   ├── shared/        # Shared types and utilities
│   ├── core/          # Core business logic
│   ├── ai-engine/     # AI/ML components
│   └── line-bot/      # LINE Bot integration
├── apps/
│   └── api/           # API server
└── docs/              # Documentation
```

### Running Locally

```bash
# Start development server with hot reload
bun run dev

# Run specific package
cd packages/core && bun run dev
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Use explicit return types for public functions
- Document public APIs with JSDoc comments

### Formatting

We use Prettier for code formatting:

```bash
bun run format
```

### Linting

We use ESLint for code quality:

```bash
bun run lint
bun run lint:fix  # Auto-fix issues
```

## Testing

Write tests for new features and bug fixes:

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test --watch

# Run specific test file
bun test packages/core/src/crops/crop-database.test.ts
```

## Deployment

minori uses **Render** for hosting and **Neon** for PostgreSQL database.

### Setting Up Neon Database

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project (select Singapore region for Taiwan users)
3. Copy the connection string from the dashboard
4. Add `DATABASE_URL` to your environment:
   ```bash
   # Local development
   echo "DATABASE_URL=postgresql://..." >> .env

   # Production - add to Render dashboard
   ```

5. Run migrations:
   ```bash
   bun run db:migrate
   ```

### Setting Up Render

1. Create a free account at [render.com](https://render.com)
2. Connect your GitHub repository
3. Use the Blueprint (render.yaml) for automatic configuration:
   - Go to Dashboard > New > Blueprint
   - Select the minori repository
4. Configure environment variables in Render dashboard:
   - `DATABASE_URL` — Neon connection string
   - `LINE_CHANNEL_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `OPENAI_API_KEY`
   - `CWA_API_KEY` (optional)

5. Set up GitHub Actions deployment:
   - In Render: Settings > Deploy Hook > Copy URL
   - In GitHub: Settings > Secrets > Add `RENDER_DEPLOY_HOOK_URL`
   - Add `STAGING_URL` secret (e.g., `https://minori-api.onrender.com`)
   - Add `DATABASE_URL` secret for migrations

### Deployment Flow

```
Push to main → GitHub Actions → Validate (lint/test) → Trigger Render Deploy → Run Migrations → Health Check
```

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update relevant docs/ files for architectural changes

## Questions?

Feel free to:
- Open a [Discussion](https://github.com/RikaiDev/minori/discussions)
- Ask in an Issue
- Reach out to maintainers

Thank you for contributing! 🌾
