# NoteBook Web Client 🌐

**Package:** `@notebook/web`  
**Version:** `0.0.1-beta`  
**Live Site:** [https://mynotebook.runasp.net/](https://mynotebook.runasp.net/)  

The web client for NoteBook, built with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Material Design 3**.

---

## Current Status (v0.0.1-beta)

- **Authentication & Sign Up:**
  - Modern sign-in and public registration tabbed interface with Material Design 3 pill segmented controls.
  - 2-step password reset flow via 6-digit email codes dispatched through Resend.
  - Automatic session restore and token refresh via `AuthContext`.
- **Note-Taking & Block Editing:**
  - Dynamic block types: Paragraphs, Headings (H1/H2/H3), Checklists, Code blocks, Quotes, Dividers, Images, and Interactive Tables.
  - Interactive tables support Notion-style inline row creation, column/row deletion, and TSV clipboard copy/paste.
  - Real-time `[[WikiLink]]` detection and bidirectional backlinks panel.
- **Profile & Customization:**
  - User profile customization in Settings: 12 preset emoji avatars, file upload (`/api/uploads`), image URLs, and username editing.
  - Consistent avatar and username rendering across Header, SideMenu, Archive, and Settings.
  - Dark, Light, and System theme toggles.
- **Testing:**
  - 122 Vitest tests across 17 test suites (`npm test`).

---

## Scripts

```bash
# Start Vite development server
npm run dev

# Run full component test suite
npm test

# Build production bundle
npm run build
```
