# NoteBook Application — Current Status & Overview 📓

**Current Version:** `0.0.1-beta`  
**Git Tag:** [`v0.0.1-beta`](https://github.com/ahmed0z/My-Notebook/releases/tag/v0.0.1-beta)  
**Production URL:** [https://mynotebook.runasp.net/](https://mynotebook.runasp.net/)  
**GitHub Repository:** [https://github.com/ahmed0z/My-Notebook](https://github.com/ahmed0z/My-Notebook)  
**Last Updated:** November 2026

---

## 1. What is NoteBook?

**NoteBook** is a modern, responsive personal knowledge base and block-based note-taking application inspired by **Notion** and **Obsidian**. It allows users to write notes using dynamic blocks, organize thoughts into colored spaces and tags, and interconnect ideas using bidirectional `[[WikiLinks]]`.

The app is built as a multi-tenant web application on top of **.NET 8** (ASP.NET Core Web API), **PostgreSQL**, **React 18**, **TypeScript**, and **Material Design 3**.

---

## 2. Where We Are Now (Current Status)

The project has reached **Milestone `0.0.1-beta`** and is deployed live on MonsterASP.

### Key Milestones Completed:

### 🏢 Multi-Tenant Data Isolation
- **Self-Service Public Signup:** Any user can register an account at `/api/auth/register`. Upon signup, a personal isolated workspace is seeded with a default "General" space.
- **Strict Tenant Boundary:** Every database query (notes, blocks, tags, spaces, uploads, search) is filtered by the authenticated user's ID (`UserId`). Cross-user access is impossible even if IDs are guessed.

### 🔐 Modern Authentication & Email Verification
- **Resend Email Integration:** Verification codes are dispatched via **Resend REST API** (`https://api.resend.com/emails`).
- **Secure Code-Only Password Reset:** Two-step verification flow on both the **Sign-in page** and the **Settings page**. On-screen reset code banners were completely eliminated.
- **Profile & Avatar Management:** Users can edit their username, email, and avatar (12 preset emoji avatars, custom image upload via `/api/uploads`, or direct image URLs).
- **Consistent UI State:** The user's active avatar and username are synchronized across the top Header, SideMenu footer, Archive page, and Settings page.
- **Removed Legacy "Add User":** Replaced admin user provisioning with public self-registration.

### 📝 Notion-Style Block Editor & Tables
- **Block Types Supported:**
  - Paragraphs / Text with markdown-friendly formatting
  - Headings (H1, H2, H3)
  - Interactive Checklists (with real-time state toggling)
  - Code Blocks (with syntax tag and one-click copy)
  - Blockquotes
  - Dividers
  - Images (file upload, drag-and-drop, or URL)
  - Interactive Tables (dynamic columns/rows, inline row creation, cell editing, TSV clipboard copy/paste)
- **Autosave:** Debounced background autosave prevents data loss.

### 🔗 Bi-Directional Wiki Backlinks (`[[Note Name]]`)
- Real-time parsing of `[[WikiLinks]]` across block contents.
- Dedicated Backlinks Panel showing incoming links and outgoing references scoped to the user's workspace.

### 🎨 Material Design 3 Theming
- Follows Google Material Design 3 guidelines: fluid cards, pill segmented controls, and toast alerts.
- Dark, Light, and System theme support with instant `localStorage` persistence.

---

## 3. Test Coverage & Quality Verification

| Test Suite | Total Tests | Status |
|---|---|---|
| **Backend Integration & Unit Tests (xUnit)** | **84 tests** | ✅ **100% Passing** (`0 failed`) |
| **Frontend Web Component Tests (Vitest)** | **122 tests** (17 suites) | ✅ **100% Passing** (`0 failed`) |
| **Shared Contracts Build** | TypeScript compilation | ✅ **Clean** |

---

## 4. Architecture & Monorepo Layout

```
My-NoteBook/
├── apps/
│   ├── web/                    # React 18 + Vite + Tailwind CSS frontend
│   │   ├── src/                # Pages, components, contexts, API client
│   │   └── tests/              # 17 Vitest test suites (122 tests)
│   └── mobile/                 # React Native / Expo workspace
├── backend/
│   ├── src/NoteBook.Api/       # ASP.NET Core 8 Web API + PostgreSQL EF Core
│   └── tests/NoteBook.Tests/   # xUnit integration test suite (84 tests)
├── packages/
│   └── shared/                 # Monorepo TypeScript contracts & DTO types
└── scripts/
    └── deploy-sftp.py          # Automated SFTP deployment to MonsterASP
```

---

## 5. Upcoming Roadmap

1. **Mobile App:** Build out the Expo React Native client in `apps/mobile` connecting to the production backend API.
2. **Offline & Sync:** Local IndexedDB caching with offline mode synchronization.
3. **Export / Import:** Full workspace export to Markdown (.zip) and Obsidian vault import.
4. **Drag & Drop Blocks:** Visual block drag-and-drop reordering in the note editor.
