# NoteBook 📓

[![Version](https://img.shields.io/badge/version-0.0.1--beta-blue.svg)](https://github.com/ahmed0z/My-Notebook/releases)
[![Build & Tests](https://img.shields.io/badge/tests-84%20passed%20%7C%20122%20passed-brightgreen.svg)](https://github.com/ahmed0z/My-Notebook)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A modern, fast, and elegant personal knowledge base and block-based note-taking application inspired by Notion and Obsidian, built with **.NET 8**, **React 18**, **TypeScript**, **PostgreSQL**, and **Material Design 3**.

**Release Version:** `0.0.1-beta`  
🌐 **Live Demo:** [https://mynotebook.runasp.net/](https://mynotebook.runasp.net/)

---

## ✨ Features

### 🏢 Multi-Tenant Workspace & Strict Data Isolation
- **Self-Service Registration:** Instant public signup (`/api/auth/register`) automatically initializes a personal workspace with a default "General" space.
- **Tenant Isolation:** Every space, note, block, tag, upload, and search result is strictly filtered by the authenticated user's ID at the database query level.
- **User Profile & Avatars:** Customize your identity with preset emoji avatars, custom uploaded profile pictures, or external avatar URLs. Real-time updates reflect across the header, navigation menu, and archive views.

### 🔐 Secure Authentication & Resend Email Service
- **JWT Authentication:** Secure token-based authentication with expiration handling and automatic token refresh upon profile updates.
- **Password Reset via Email Codes:** Two-step password reset workflow powered by **Resend** (REST API integration). Verification codes are delivered directly to the user's inbox with zero on-screen code leakage.
- **In-App Password Change:** Authenticated users can request an email code and reset their password directly from the Settings page.

### 📝 Notion-Style Block-Based Editor
- **Rich Block Types:**
  - **Text / Paragraphs:** Markdown-friendly formatting with inline link parsing.
  - **Headings:** H1, H2, and H3 for clean hierarchy.
  - **Checklists / Todo:** Interactive task checkboxes with completion toggles and strikethrough styling.
  - **Code Blocks:** Monospace code editor with language selection and one-click copy to clipboard.
  - **Quotes:** Highlighted blockquotes for excerpting ideas and citations.
  - **Dividers:** Clean visual separation between sections.
  - **Images:** Drag-and-drop file upload, file picker, or direct URL with custom caption and full-bleed rendering.
  - **Interactive Tables:** Notion-style data tables with dynamic row and column addition/deletion, cell editing, and TSV clipboard copy/paste.
- **Autosave & Instant State:** Background debounced autosave ensures your notes are never lost.

### 🔗 Bi-Directional Wiki Backlinks (`[[Note Name]]`)
- **WikiLinks:** Seamlessly connect thoughts by typing `[[Note Name]]` inside paragraphs, headings, quotes, or checklists.
- **Backlinks Panel:** Dedicated inspector displaying incoming references (notes that link to the current note) and outgoing mentions, isolated strictly to the user's workspace.

### 🗂️ Spaces, Tags & Organization
- **Color-Coded Spaces:** Organize notes into dedicated spaces (e.g., *Personal*, *Work*, *Engineering*, *Reading*).
- **Tagging System:** Categorize notes with flexible tags; filter by tags from the navigation sidebar.
- **Archive & Restore:** Declutter your workspace by archiving finished notes with full restore capability from the Archive page.
- **Fast Search:** Instant full-text search across titles and block contents.

### 🎨 Material Design 3 UI & Theming
- **Material You Principles:** Designed following Google Material Design 3 guidelines—featuring elevated cards, pill segmented controls, smooth transitions, and tactile feedback.
- **Theme Modes:** First-class Dark Mode, Light Mode, and System Theme sync with instant `localStorage` persistence.
- **Fully Responsive:** Optimized layout for desktop, tablet, and mobile browsers.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti |
| **Backend** | .NET 8, ASP.NET Core Web API, Entity Framework Core 8, Npgsql (PostgreSQL), BCrypt.Net |
| **Email Service** | Resend REST API (`https://api.resend.com/emails`) with SMTP fallback |
| **Shared Contracts** | Monorepo TypeScript library (`@notebook/shared`) for shared DTO definitions |
| **Testing** | **Backend:** xUnit, Microsoft.AspNetCore.Mvc.Testing, EF Core InMemory (84 tests)<br>**Frontend:** Vitest, React Testing Library, JSDOM (122 tests) |
| **Hosting & CI/CD** | MonsterASP (Windows Server IIS + ASP.NET Core Module + PostgreSQL), SFTP automated deployment |

---

## 📁 Repository Structure

```
My-NoteBook/
├── apps/
│   └── web/                     # React 18 + Vite frontend
│       ├── src/
│       │   ├── api/             # Type-safe API client
│       │   ├── components/      # UI components (Header, SideMenu, NoteGrid, BacklinksPanel)
│       │   ├── context/         # AuthContext, ThemeContext, SettingsContext
│       │   ├── pages/           # NotesPage, LoginPage, SettingsPage, ArchivePage
│       │   └── types/           # Frontend view models
│       └── tests/               # Vitest component & integration test suite (17 suites, 122 tests)
├── backend/
│   ├── NoteBook.sln
│   ├── src/
│   │   └── NoteBook.Api/        # ASP.NET Core 8 Web API
│   │       ├── Controllers/     # Auth, Notes, Spaces, Backlinks, Search, Uploads
│   │       ├── Data/            # AppDbContext (PostgreSQL EF Core migrations)
│   │       ├── DTOs/            # Request/Response data transfer records
│   │       ├── Models/          # User, Note, Block, Space, Tag, Upload entities
│   │       ├── Services/        # AuthService, SmtpEmailSender, LinkParserService
│   │       └── wwwroot/         # Compiled production web assets
│   └── tests/
│       └── NoteBook.Tests/      # xUnit integration test suite (84 tests)
├── packages/
│   └── shared/                  # Common TypeScript interfaces & DTOs
└── scripts/
    └── deploy-sftp.py           # Automated SFTP deployment script with IIS app_offline handling
```

---

## 🚀 Getting Started

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 18+](https://nodejs.org/) and `npm`
- [PostgreSQL](https://www.postgresql.org/) (or use local development settings)

### 1. Clone the Repository
```bash
git clone https://github.com/ahmed0z/My-Notebook.git
cd My-Notebook
```

### 2. Install Dependencies
```bash
# Install workspace dependencies and build shared contracts
npm install
npm --prefix packages/shared run build
npm --prefix apps/web build
```

### 3. Backend Configuration
Configure `backend/src/NoteBook.Api/appsettings.json` (or via environment variables):
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=notebook;Username=postgres;Password=your_password"
  },
  "Jwt": {
    "Key": "YourSuperSecretKeyWithAtLeast32CharactersLong!",
    "Issuer": "NoteBookApi",
    "Audience": "NoteBookClient",
    "ExpiryDays": 7
  },
  "Resend": {
    "ApiKey": "re_your_resend_api_key",
    "FromEmail": "NoteBook <onboarding@resend.dev>"
  }
}
```

### 4. Run the Application

#### Backend
```bash
dotnet run --project backend/src/NoteBook.Api/NoteBook.Api.csproj
```
API runs on `http://localhost:5000` (or `https://localhost:5001`).

#### Frontend
```bash
npm --prefix apps/web run dev
```
Vite dev server starts on `http://localhost:5173`.

---

## 🧪 Running Tests

### Backend Test Suite (xUnit)
```bash
dotnet test backend/NoteBook.sln
```
> Runs 84 integration and unit tests verifying authentication, multi-tenant data isolation, backlink resolution, email dispatch, upload security, and space management.

### Frontend Test Suite (Vitest)
```bash
npm --prefix apps/web test
```
> Runs 122 tests across 17 test suites covering block interactions, tables, login/signup flows, settings, avatars, and backlinks.

---

## 📦 Deployment to MonsterASP

To build AnyCPU release artifacts and deploy via SFTP:
```bash
# 1. Build frontend and sync to backend wwwroot
npm --prefix packages/shared run build
npm --prefix apps/web run build
rm -rf backend/src/NoteBook.Api/wwwroot/*
cp -r apps/web/dist/* backend/src/NoteBook.Api/wwwroot/

# 2. Publish .NET Release
dotnet publish backend/src/NoteBook.Api/NoteBook.Api.csproj -c Release -o publish-anycpu/

# 3. Deploy via SFTP (automatically puts app offline in IIS to release locks)
python3 scripts/deploy-sftp.py
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
