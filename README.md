# Avslutningsmiddag Monorepo

Monorepo for the **Avslutningsmiddag** (course closing dinner event) application. This platform enables interactive storytelling, live participant interaction, and an AI-driven persona for the event celebration.

## Project Structure

```text
avslutningsmiddag/
├── participant-app/   # Next.js app (TypeScript, App Router, Tailwind CSS)
├── admin-app/         # Next.js app (TypeScript, App Router, Tailwind CSS)
├── shared/            # Shared TypeScript types and typed Vercel KV client wrapper
└── package.json       # Monorepo root configuration (npm workspaces)
```

### Applications

- **`participant-app`**: A mobile-friendly web application for event attendees. Participants can answer dinner reflection questions and interact in real-time chat with an AI persona.
- **`admin-app`**: An administrative dashboard for the event organizer to manage the persona, generate and play the persona's keynote dinner speech, and oversee live Q&A moderation.
- **`shared`**: A shared library package housing TypeScript domain types and a typed `@vercel/kv` client wrapper (`kvClient.ts`) for data persistence.

## Data Storage (Vercel KV / Redis)

Data persistence is managed using **Vercel KV** (powered by Upstash Redis).

### Key Schema & Value Shapes

| Key Pattern | Redis Structure | Description |
| :--- | :--- | :--- |
| `participant:{id}` | Hash / JSON String | Participant details (`id`, `name`, `created_at`) |
| `answers:{participantId}` | List | Answers submitted by participant (`question_number`, `question_text`, `answer_text`) |
| `persona` | Hash / JSON String | Persona details (`name`, `description`, `portrait_url`) |
| `speech` | Hash / JSON String | Speech script and video generation status (`script`, `video_url`, `status`) |
| `qa_log:ids` | List | Chronological list of Q&A entry IDs |
| `qa_log:{id}` | Hash / JSON String | Q&A entry (`id`, `question`, `answer`, `video_url`, `status`, `created_at`) |
| `chat:{participantId}` | List | Chat messages exchanged with persona (`message`, `response`, `created_at`) |

## Getting Started

### Prerequisites

- Node.js >= 18 (recommended: Node.js 20+)
- npm >= 9

### Environment Variables

Both `participant-app` and `admin-app` require Vercel KV credentials. Copy `.env.local.example` to `.env.local` in each application folder:

```bash
# In participant-app/
cp .env.local.example .env.local

# In admin-app/
cp .env.local.example .env.local
```

Required environment variables:

```env
KV_URL="redis://..."
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
KV_REST_API_READ_ONLY_TOKEN="..."
```

### Running Locally

Install all dependencies across the monorepo from the root:

```bash
npm install
```

Run development servers:

```bash
# Run participant app (defaults to http://localhost:3000)
npm run dev --workspace=participant-app

# Run admin app (run on port 3001)
npm run dev --workspace=admin-app -- -p 3001
```
