# Campfire Discord Clone (POC)

A lightweight Discord-style proof of concept with:

- TypeScript frontend
- Minimal Node.js backend (no external dependencies)
- Real-time chat + online presence using Server-Sent Events (SSE)

## Run

```bash
npm run dev
```

Open: http://localhost:3000

## Features

- Channel list (`general`, `random`, `showcase`)
- Live message stream
- Presence list
- In-memory message history

## Notes

This is intentionally a POC: all data is in-memory and resets on restart.
