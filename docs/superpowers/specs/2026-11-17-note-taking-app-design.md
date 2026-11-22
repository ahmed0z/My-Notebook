# Note-Taking App — Design Document

## Intent

A personal note-taking app that combines the visual simplicity of Google Keep's card grid with the structured editing power of Notion's block editor. Built to run entirely on MonsterASP's free hosting plan as both frontend and backend, with a companion Android app sharing the same backend API and database. Designed for a single user now, with a path to multi-user and public access on a paid plan later.

## Why

The owner wants a single place to capture mixed content — text, checklists, and tables — in a modern, clean interface that works on desktop browsers, mobile browsers, and as a native Android app. Existing apps each do part of this well (Keep's quick capture, Notion's structured blocks, Obsidian's note linking), but none combine them in a lightweight self-hosted package.

## Goals

- **Card-grid home screen:** Keep-style masonry layout with colored cards. Scanning and finding notes should feel fast and visual.
- **Block editor:** Each note is a stack of discrete, rearrangeable blocks. Phase 1 block types: text (paragraphs and headings), checklists (to-do items with checkboxes), and tables.
- **Three surfaces, one API:** A responsive web app (desktop and mobile browsers) and a native Android app, both consuming the same ASP.NET Web API backend.
- **Modern design:** Late-2026 aesthetic — generous whitespace, smooth animations, clean typography, subtle depth and polish.
- **Low operational cost:** Runs within MonsterASP's free tier constraints with no external dependencies.

## Non-Goals

- **Multi-user / public access:** Not in scope. Single user behind a login. Multi-user is a future project tied to upgrading the hosting plan.
- **Offline-first:** Not required for Phase 1. The app assumes connectivity. Offline support can be layered in later.
- **iOS app:** Not needed now. React Native makes it possible later from the same codebase.
- **App store distribution:** The Android app will be sideloaded via APK for now.

## Anti-Goals

- **Feature bloat over usability:** This should feel fast and light to use. If a feature adds friction to the core loop of "open app → capture a thought → move on," it doesn't belong in Phase 1.
- **Over-engineering for scale:** This serves one user. The architecture should be clean enough to extend later but should not carry the complexity of multi-tenancy, caching layers, or microservices now.

## Constraints

All constraints come from MonsterASP's free plan:

| Resource | Limit | Impact |
|----------|-------|--------|
| Websites | 1 | Frontend and API must be served from the same ASP.NET application |
| RAM | 256 MB dedicated | App must be lightweight; no heavy in-memory caching or processing |
| Database | 1 (MSSQL, MySQL, or PostgreSQL), 1 GB storage | All data in one database; schema must be efficient |
| Disk | 5 GB | Sufficient for Phase 1 (text-only content); image storage in Phase 2 will need monitoring |
| App pool | Idles on inactivity | First request after idle period will have a cold start (~5-10s). Acceptable for single-user. |
| Domain | Subdomain only (`*.runasp.net`) | No custom domain on free tier |
| Background processes | Not allowed | No background jobs, scheduled tasks, or long-running processes |
| Always Running | Not available | App pool may recycle; app must handle cold starts gracefully |

## Approaches Considered

### Approach A: React web + Capacitor for mobile (Rejected)

One React codebase serving both the web app and an Android APK via Capacitor. Minimal extra work for the mobile app.

**Rejected because:** The owner wants a truly native mobile app, not a web view in a native shell. Capacitor was explicitly ruled out.

### Approach B: All .NET — Blazor + .NET MAUI (Rejected)

Blazor WebAssembly for the web, .NET MAUI for Android. Single language (C#) across the entire stack.

**Rejected because:** The block editor ecosystem in Blazor is thin. Building a Notion-style block editor in Blazor would mean either building from scratch or heavy JavaScript interop, negating the single-language benefit. The React ecosystem has mature, battle-tested block editor libraries.

### Approach C: React web + React Native for mobile (Chosen)

React with a block editor library (TipTap or BlockNote) for the web frontend, served as static files from the ASP.NET backend. React Native for the Android app. TypeScript shared across both frontends for API types, client logic, and validation.

**Why this wins:**
- The block editor is the hardest part of this app. React has the best libraries for it (TipTap, BlockNote).
- React Native produces a genuinely native Android app.
- Sharing TypeScript between web and mobile means API contracts, types, and validation logic are written once.
- If iOS is ever needed, React Native covers it from the same codebase.

**Tradeoff:** The block editor will need to be built separately for React Native (no direct port of web block editor libraries). This is real work, but it would be true of any native mobile approach.

## Technical Architecture

### Backend: ASP.NET Web API + Entity Framework Core + PostgreSQL

- **Framework:** ASP.NET Web API (.NET 8+), hosted on MonsterASP's IIS infrastructure.
- **ORM:** Entity Framework Core for database access.
- **Database:** PostgreSQL. Chosen for its strong JSON/JSONB column support, which is a natural fit for storing block editor document structures (each note's content is a tree of typed blocks). Free on MonsterASP.
- **Authentication:** JWT-based. Single user — credentials stored hashed in the database. On first launch, the app presents a one-time setup screen to create the username and password. The setup endpoint locks after first use — subsequent visits go to login. No OAuth or external identity provider needed for Phase 1. *(Builder's call: one-time setup approach chosen for simplicity over seed scripts or config files.)*
- **API style:** RESTful JSON API. Blocks are independent sub-resources of notes (e.g., `GET /api/notes/:id/blocks`, `PUT /api/blocks/:id`) to support granular auto-save. Notes have their own CRUD endpoints (`/api/notes`).
- **Save model:** Auto-save with debounce. Changes are saved automatically as the user edits (debounced, ~1-2 seconds after last keystroke). Both web and mobile use the same pattern: PATCH individual blocks as they change. No explicit save button.
- **.NET version:** Target the latest stable LTS available on MonsterASP at build time (currently supports up to .NET 11). *(Builder's call.)*
- **Static file serving:** The React web app is built into static files and served by the same ASP.NET application using `UseStaticFiles()` and `MapFallbackToFile("index.html")` for client-side routing.

### Data Model

The core entities:

- **Note:** id, title, color, position (for grid ordering), created_at, updated_at, is_pinned, is_archived
- **Block:** id, note_id (FK), type (text | checklist | table), content (JSONB — structure varies by block type), position (order within note), created_at, updated_at

Block content stored as JSONB allows each block type to have its own structure without schema changes when new block types are added in Phase 2:

- **Text block:** `{ "text": "...", "level": "paragraph" | "h1" | "h2" | "h3" }`
- **Checklist block:** `{ "items": [{ "text": "...", "checked": true/false }] }`
- **Table block:** `{ "columns": ["...", "..."], "rows": [["...", "..."], ...] }`

### Web Frontend: React + Block Editor Library

- **Framework:** React 18+ with TypeScript.
- **Block editor:** TipTap or BlockNote — both are mature, extensible block editor frameworks built on ProseMirror. Final choice left to the builder based on which better supports custom block types (checklist, table) with the least configuration.
- **Styling:** Tailwind CSS or CSS Modules — builder's choice, targeting the modern late-2026 aesthetic: clean lines, whitespace, subtle shadows/depth, smooth transitions.
- **State management:** Lightweight — React Query (TanStack Query) for server state, React context or Zustand for UI state. No Redux.
- **Routing:** React Router for client-side navigation.
- **Build:** Vite for fast development and optimized production builds. Output is static files deployed alongside the .NET app.

### Mobile App: React Native (Android)

- **Framework:** React Native with TypeScript, using Expo for build tooling and APK generation.
- **Block editor:** A full-featured custom block editor built with React Native components, matching the web editor's capabilities: inline text formatting, drag-to-reorder blocks, tap-to-change block type, and full table cell editing. The web editor library (TipTap/BlockNote) doesn't run in React Native, so the mobile editor is a parallel implementation using React Native's text input, gesture handling (react-native-gesture-handler), and reanimated for smooth drag animations. The block data model is shared — the same JSONB structure is read and written by both frontends. This is the single largest workstream in the project.
- **API client:** Shared TypeScript module used by both web and mobile for API calls, types, and validation. Auto-save logic (debounce, PATCH per block) lives here.
- **Navigation:** React Navigation for screen management.
- **Output:** APK built via Expo's EAS Build (or local build) for sideloading.

### Shared TypeScript

A shared package (or module) containing:
- API type definitions (Note, Block, request/response shapes)
- API client functions (fetch wrappers for each endpoint)
- Validation logic (block content validation, note constraints)
- Constants (block types, colors, limits)

This is imported by both the React web app and the React Native app.

### Deployment

- **Web + API:** Published to MonsterASP via Web Deploy (from Visual Studio / CLI) or GitHub integration. The React app is built (`npm run build`), output copied to the .NET project's `wwwroot/` folder, and the whole thing deployed as one package.
- **Mobile:** APK built locally or via Expo EAS, transferred to the phone for sideloading.

## Phases

### Phase 1 (This Project)

- Backend API with auth, note CRUD, block CRUD
- Web frontend with Keep-style card grid and block editor (text, checklist, table blocks)
- React Native Android app with the same functionality
- Shared TypeScript package
- Deployed on MonsterASP free plan

### Phase 2 (Future)

- Image blocks (upload, display, storage management within 5 GB limit)
- Obsidian-style note linking: `[[note name]]` syntax in text blocks, backlink display
- Search across notes and block content
- Additional block types as needed

### Phase 3 (Future, Paid Plan)

- Multi-user support (registration, per-user data isolation)
- Custom domain
- iOS app (from existing React Native codebase)
- App store publishing

## What's Left to the Builder

- **Block editor library choice:** TipTap vs BlockNote for the web. Evaluate which better supports custom block types (especially tables) and aligns with the modern design goal.
- **Styling approach:** Tailwind CSS vs CSS Modules vs other. Builder's choice based on what produces the cleanest, most maintainable code for the target aesthetic.
- **React Native block editor implementation:** The mobile block editor is a custom build. The builder decides the component architecture — how blocks are rendered, how drag-to-reorder works, how the editing experience feels on mobile.
- **Shared package structure:** Monorepo with workspaces, or a separate package. Builder decides based on the tooling that makes development smoothest.
- **API error handling and retry strategy:** Standard patterns, builder's judgment.
- **Cold start UX:** How to handle the ~5-10s cold start on MonsterASP. A loading screen, skeleton UI, or similar — builder's call.
- **Color palette for note cards:** The specific set of colors available for cards. Builder picks a modern set that fits the design language.
