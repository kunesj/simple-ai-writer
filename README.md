# Local File-Based AI Chat Application

This is a full-stack AI chat application that stores all conversations and settings as individual JSON files on the local disk. It features a React frontend and an Express.js backend.

## Features

- **Local Persistence**: All data is stored in JSON files, ensuring you own your data.
- **Data Integrity**: Uses atomic write operations (write-to-temp-then-rename) to prevent file corruption.
- **Real-time Sync**: Automatically reloads data in the browser when files are modified externally using Server-Sent Events (SSE).
- **Separate Storage**: Each conversation is saved as an independent JSON file for better manageability.
- **Containerized**: Ready to run with Docker.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22+ recommended)
- [npm](https://www.npmjs.com/)
- [Docker](https://www.docker.com/) (optional, for containerized deployment)

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_MODEL_NAME=gemini-3.1-flash-lite-preview
VITE_OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:3000`.

## Deployment with Docker

To run the application using Docker:

1. Build and start the container:
   ```bash
   docker-compose up --build
   ```

2. The application will be available at `http://localhost:3000`. Your data will be persisted in the `./data` directory on your host machine.
