# Firebase AI Logic integration spec

## Objective

Use Firebase AI Logic to power three backend capabilities for the memory product:

1. **Article polish**: rewrite a short memory article into cleaner prose and return structured metadata.
2. **Information extraction**: extract structured fields from a short memory article.
3. **Recommendation**: generate city/topic recommendations from a prompt plus user memory context.

## Scope

This spec covers the Next.js BFF layer under `app/api`, shared server-side AI orchestration under `lib/server`, and the API contract exposed to the frontend.

Out of scope:

- streaming UI
- multi-turn chat state
- vector database / external RAG infrastructure
- client-side direct model invocation

## High-level design

### 1. Execution model

All model calls run on the server through **Firebase AI Logic**.

- Runtime: Next.js App Router route handlers
- SDK: `firebase/ai`
- Backend selection:
  - default: `GoogleAIBackend`
  - optional: `AgentPlatformBackend` when `FIREBASE_AI_BACKEND=agent-platform`
- Authentication:
  - server requests must initialize a `FirebaseServerApp`
  - the app must be seeded with the signed-in user's `authIdToken`
  - AI route handlers therefore require an authenticated session before calling Firebase AI Logic

### 2. AI mode switch

The existing admin-controlled AI mode remains the global feature switch:

- `naive`: deterministic heuristic behavior
- `llm`: Firebase AI Logic-backed behavior

All three AI routes and the article ingestion/recommendation flows must respect this mode.

### 3. Functional split

#### Article polish

- Input: short article title/content, optional tone
- Model task: rewrite while preserving factual details and chronology
- Output: strict JSON

Required fields:

- `title`
- `polishedText`
- `summary`
- `improvements`
- `tone`

#### Information extraction

- Input: short article title/content
- Model task: extract compact structured metadata for storage/search
- Output: strict JSON

Required fields:

- `summary`
- `keywords`
- `places`
- `persons`
- `organizations`
- `dates`
- `topic`
- `tone`
- `city`

#### Recommendation

- Input:
  - user prompt
  - selected article history
  - optional extra context strings
- Strategy:
  1. preselect a bounded set of candidate entries from article history
  2. compact article/context payload
  3. ask the model for structured recommendation output

Required fields:

- `contextSummary`
- `cityRecommendation.city`
- `cityRecommendation.brief`
- `cityRecommendation.highlights`
- `topicRecommendations[].id`
- `topicRecommendations[].title`
- `topicRecommendations[].reason`
- `topicRecommendations[].confidence`

## Context selection rules

Because recommendation context may be large, the backend must not send the full history blindly.

Selection policy:

1. score article history entries by prompt overlap against searchable text
2. tie-break by latest `articleTime`
3. keep only the top 12 entries
4. truncate long excerpts before prompt assembly
5. keep at most 8 extra context items

This keeps latency/cost bounded and aligns recommendation output with supplied evidence.

## Cost control: once-per-day recommendation

To prevent duplicate spend, recommendation generation must enforce:

1. **one AI generation per user per date key**
2. **pre-generation random jitter** in `[0ms, 1000ms)` to reduce lock contention
3. **Firestore lock acquisition before model call**

Storage and lock document:

- path: `users/{userId}/dailyRecommendations/{YYYY-MM-DD}`
- statuses: `pending`, `ready`, `failed`
- lock fields: `lockOwner`, `lockUntilMs`
- payload field: `recommendation` (full structured recommendation)

Behavior:

- if status is `ready`, return cached recommendation (no model call)
- if status is `pending` and lock is fresh, wait/poll briefly for `ready`
- if lock is stale or missing, current request acquires lock and generates
- generation failures mark status `failed` so the next request can retry

## API surface

### New endpoints

- `POST /api/ai/polish`
- `POST /api/ai/extract`
- `POST /api/ai/recommend`

### Existing endpoints updated to use the same service

- `POST /api/articles`
  - when `useAiFineTune=true`, polish before persistence
  - always run extraction through the selected AI mode before storage
- `GET /api/recommendations/today`
- `GET /api/idealization/today`

## Data persistence

Article persistence must store:

- polished or original `title`
- polished or original `content`
- extracted `summary`
- extracted `keywords`
- extracted `places`
- extracted `persons`
- extracted `organizations`
- extracted `dates`
- extracted `tone`
- extracted/inferred `topic`
- extracted/inferred `city`

`searchText` must include the additional extracted fields so search stays aligned with AI-enriched content.

## Validation and failure handling

### Output validation

Every AI response must be:

1. requested as JSON via schema-constrained generation
2. parsed on the server
3. validated field-by-field before returning or persisting

### Failure policy

- `naive` mode never calls the model
- `llm` mode surfaces model/configuration errors as API errors
- invalid model JSON is treated as a server-side upstream failure

No silent fallback from `llm` to `naive` is allowed.

## Environment variables

Required existing Firebase web config:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional AI-specific config:

- `FIREBASE_AI_MODEL` (default `gemini-2.5-flash`)
- `FIREBASE_AI_BACKEND` (`google` by default, `agent-platform` supported)
- `FIREBASE_AI_LOCATION` (used with `agent-platform`)

## Frontend integration

### Home dashboard

The homepage should fetch one combined recommendation payload from `POST /api/ai/recommend` instead of triggering separate AI requests for city/topic panels.

### Edit flow

The edit page continues to submit through `POST /api/articles`.
The server decides whether to polish content based on:

- `useAiFineTune`
- current global `mode`

## Acceptance criteria

1. Short article polish returns stable structured JSON.
2. Short article extraction returns stable structured JSON.
3. Recommendation accepts prompt plus bounded context and returns structured recommendations.
4. Article creation persists AI-enriched fields.
5. API contracts are documented under `docs/ai-design` and `docs/api`.
