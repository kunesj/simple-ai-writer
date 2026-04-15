# Simple AI Writer

A full-stack AI chat application that is optimized for writing fiction and manual context management.

**Declaimer**: This projects is 95% vibe-coded "AI slop", because nobody should be forced to write JS. Use at your own risk.

## Features

- **Manual Context Management**: Remove messages from context without removing them from history. Replace messages in context with their summary without editing them.
- **Message Grouping**: Group and collapse related messages. Useful for grouping chapters into story arcs.
- **JSON Storage**: All data is stored in JSON files on your disk. Each conversation in a separate file. Uses atomic write operations to prevent file corruption. Browser auto-reloads when files are modified externally via Server-Sent Events (SSE).
- **File Uploads**: Attach files to messages. Currently only text files and images.
- **Configurable Backend**: Switch between Gemini API, local llama.cpp servers, or any other server with OpenAI-compatible API.
- **Import/Export**: Supports import of conversations from Google AI Studio, llama.cpp server, and its own native format.
- **Easy Debugging**: Inspect raw requests and responses of failed completions, and display prompt/completion token counts and speeds.
- **Containerized**: Ready to run with Docker.

## Motivation

There are countless AI frontends, but none of them fit my very specific needs. 

The most popular frontends are to focused on normal chatting, and the few writing-focused ones go too far and are overly complicated. 

## Supported Backends

Supports any backed with OpenAI-compatible API.

### Google Gemini API
```env
VITE_OPENAI_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai/"
VITE_OPENAI_API_KEY="your-api-key"
VITE_MODEL_NAME="gemini-3.1-flash-lite-preview"
```

### Local llama.cpp
```env
VITE_OPENAI_BASE_URL="http://localhost:8080/v1"
VITE_OPENAI_API_KEY="your-api-key"
VITE_MODEL_NAME="your-model-name"
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22+ recommended)
- [npm](https://www.npmjs.com/)
- [Docker](https://www.docker.com/) (optional)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your API settings
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

### Production Build

```bash
npm run build
npm run start
```

### Docker Deployment

```bash
docker-compose up --build
```

The application will be available at `http://localhost:3000`. Data is persisted in the `./data` directory.

## Project Structure

```
├── data/
│   ├── conversations/   # JSON files for each conversation
│   ├── settings.json    # App settings
│   └── uploads/        # Uploaded files
├── src/
│   ├── components/     # React components
│   ├── lib/           # Utilities and storage
│   └── types.ts       # TypeScript types
├── server.ts          # Express backend
└── package.json
```

## Configuration

Settings are stored in `data/settings.json` and include:
- System instruction (system prompt)
- Temperature
- Top K
- Top P
