# Lamplight Typewriter — AI server starter

This package keeps the Ollama endpoint and any server credential on the server. The browser calls `/api/chat`; it never receives the Ollama API key.

## Run locally

Requirements: Node.js 20+ and Ollama installed and running.

```bash
ollama pull llama3.2
cp .env.example .env
npm install
npm start
```

Open http://localhost:3000. In Settings → Emma AI, tap **Test AI connection**.

If Ollama runs on a different machine, set `OLLAMA_BASE_URL` to an address reachable from this server. Do not expose an unauthenticated Ollama port directly to the public internet.

## Deploy publicly

Deploy this Node app on a server that can reach Ollama. Set the environment variables in the hosting provider's secret/configuration panel; do not commit `.env`. Put HTTPS in front of the app. Ollama model inference needs RAM/CPU or GPU and hosting is not automatically free just because no paid AI API key is used.

The in-memory rate limiter is a basic starter safeguard, not production-grade abuse protection. For a public launch, use a reverse proxy, persistent rate limiting, monitoring, backups, and a managed database/authentication service.

## Important current limitations

The original login, profile, friends, and chat history in this HTML are still browser-local (`localStorage`). They are not shared accounts or cross-device cloud sync. This starter makes Emma's AI calls go through a secure server proxy; it does **not** yet implement public multi-user authentication, shared friend lists, or cloud message storage. Do not use the current local-only login as real account security.
