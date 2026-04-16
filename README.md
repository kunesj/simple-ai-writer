# Simple AI Writer

A full-stack AI chat application that is optimized for writing fiction and manual context management.

**Declaimer**: This projects is like 90% vibe-coded "AI slop" (nobody should be forced to write JS), so use it at your own risk.

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
```
Base URL: https://generativelanguage.googleapis.com/v1beta/openai/
Model Name: gemini-3-flash-preview
API Key: your-api-key
```

### Local llama.cpp
```
Base URL: http://localhost:8080/v1
Model Name: your-model-name
API Key: your-api-key
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

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000`.

4. Configure server in settings

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
