# AURA OS — Phase 0/1 starter

This is the agent core: a working tool-calling loop against real Postgres data.
No frontend, no auth yet — the point right now is to prove the architecture works.

## What's here

```
ai-service/          # FastAPI - the agent engine
  app/
    main.py           # HTTP endpoint: POST /agent/chat
    agent/loop.py     # THE core loop: LLM -> tool call -> execute -> repeat
    tools/
      definitions.py  # tool schemas the LLM sees
      execute.py      # real implementations (query Postgres)
db/
  schema.sql          # minimal multi-tenant schema
docker-compose.yml
```

## Run it

1. Get an OpenRouter API key from openrouter.ai
2. Create a file named `.env` in this folder (same level as docker-compose.yml) containing:
   ```
   OPENROUTER_API_KEY=your-key-here
   ```
   Docker Compose reads this automatically.
3. `docker compose up --build -d`
4. Postgres will auto-run `schema.sql` on first boot
5. Insert a fake org + some orders/customers manually (see "seed data" below)
6. Test the agent:

```bash
curl -X POST http://localhost:8000/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "YOUR_ORG_UUID",
    "message": "What was our revenue last month?"
  }'
```

## Seed data (manual, for testing before CSV upload exists)

```sql
INSERT INTO organizations (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Techspire');

INSERT INTO customers (organization_id, name, email, last_purchase_at) VALUES
('11111111-1111-1111-1111-111111111111', 'Ali Raza', 'ali@example.com', now() - interval '120 days'),
('11111111-1111-1111-1111-111111111111', 'Sara Khan', 'sara@example.com', now() - interval '5 days');

INSERT INTO orders (organization_id, product_name, amount, order_date) VALUES
('11111111-1111-1111-1111-111111111111', 'Widget A', 500, now() - interval '10 days'),
('11111111-1111-1111-1111-111111111111', 'Widget B', 1200, now() - interval '20 days');
```

## Try these prompts against the agent

- "What's the weather in London?" — renders a live weather card in the web UI
- "Open YouTube" — opens a new tab in the browser currently running AURA OS
- "Set the lights amber" or "make the lights brighter" — adjusts the interface glow
- "What was our revenue in the last 30 days?"

The browser action uses the current browser's `window.open`; a normal web page cannot force a particular installed browser such as Chrome. Weather uses Open-Meteo and does not require a weather API key.

## What to build next (in order)

1. **Watch the `trace` field in the response.** It shows every tool call the
   model made and its result — this is what powers the "✨ Understanding
   request / Found 82 customers / Created draft" UI from the design doc.
   Get comfortable reading it before building UI around it.
2. **CSV upload endpoint** (Node/Next.js side) that inserts real rows into
   `customers`/`orders`/`expenses`. This replaces the manual seed data above.
3. **Minimal Next.js page**: a text input, POST to `/agent/chat`, render
   `answer` + a simple list of `trace` steps. This alone is a screenshot-able
   demo of the whole architecture.
4. Only after that works: start on the glass UI, auth, multi-tenant routing.

## Notes on design decisions

- `organization_id` is injected server-side into every tool call, never
  trusted from the model's output. This is the actual multi-tenant security
  boundary — worth explaining explicitly in interviews.
- Tools are deterministic functions, not LLM calls themselves (`draft_email`
  builds the text with a template right now, not a second LLM call) — keep
  this in mind as a placeholder; swapping in an LLM-generated draft later
  is a one-line change in `execute.py`.
- `MAX_TURNS` in the loop is a safety valve — without it, a confused model
  chaining tool calls could loop indefinitely and burn API credits.
