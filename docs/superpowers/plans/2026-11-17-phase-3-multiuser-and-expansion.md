# Note-Taking App — Phase 3: Multi-User & Multi-Platform Expansion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the note-taking application for production multi-tenancy on MonsterASP's paid plan, featuring user registration with email verification, strict row-level data isolation, note sharing/collaboration, custom domain binding with SSL, and iOS app publishing alongside Google Play Store distribution.

**Architecture:** EF Core global query filters scoping all `Note`, `Block`, and `Upload` queries by authenticated `UserId`; an external transactional email provider (SendGrid / Postmark); role-based note sharing permissions (`Owner`, `Viewer`, `Editor`); and Expo Application Services (EAS) configured for both Android AAB and iOS IPA generation.

**Tech Stack:** ASP.NET Core Web API, EF Core Multi-Tenancy Filters, PostgreSQL, FluentEmail/SendGrid, React, React Native / Expo EAS (iOS & Android).

**Spec:** [docs/superpowers/specs/2026-11-17-note-taking-app-design.md](file:///workspace/My-NoteBook/docs/superpowers/specs/2026-11-17-note-taking-app-design.md)

## Global Constraints

- Multi-tenant data isolation must be enforced at the ORM/database query level so no user can access another user's notes even with crafted IDs.
- Email verification and password resets require an external SMTP/API service (since MonsterASP does not provide outbound email).
- iOS builds require Apple Developer Program credentials and iOS-specific permissions (camera, photo library).

## Review Focus

1. **Cross-tenant data leakage via direct ID enumeration:** A user querying `GET /api/notes/{other_user_id}` or `PATCH /api/blocks/{other_user_block_id}`; EF Core query filters must return 404 or 403.
2. **Email verification token expiry & replay:** Account activation tokens reused or hijacked; tokens must be cryptographically random, hashed in DB, and expire in 24 hours.
3. **Concurrent collaborative edits:** Two users editing the same shared note simultaneously; optimistic concurrency (`rowversion` / `UpdatedAt` timestamp) must prevent silent overwrites.
4. **Custom domain SSL termination on MonsterASP:** HTTPS redirection and HSTS headers configuration on IIS.
5. **iOS App Store rejection criteria:** Missing privacy policy, missing account deletion mechanism, or non-functional mock data; all mandatory store guidelines must be satisfied.

---

### Task 1: Multi-Tenant Data Isolation & Database Scoping

**Files:**
- Modify: `backend/src/NoteBook.Api/Models/Note.cs` (add `UserId` FK)
- Modify: `backend/src/NoteBook.Api/Models/Block.cs` (add `UserId` FK)
- Modify: `backend/src/NoteBook.Api/Data/AppDbContext.cs` (apply Global Query Filter `HasQueryFilter(e => e.UserId == _currentUserId)`)
- Create: `backend/src/NoteBook.Api/Services/ICurrentUserService.cs`
- Create: `backend/src/NoteBook.Api/Services/CurrentUserService.cs`
- Test: `backend/tests/NoteBook.Tests/MultiTenantDataIsolationTests.cs`

**Interfaces:**
- Consumes: JWT `sub` claim (UserId)
- Produces: Transparent per-user isolation where all EF Core queries automatically scope to current user.

- [ ] **Step 1: Write integration test proving cross-user data cannot be accessed**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement CurrentUserService and EF Core Global Query Filters**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 2: Public Registration, Email Verification & Password Reset

**Files:**
- Modify: `backend/src/NoteBook.Api/Controllers/AuthController.cs`
- Create: `backend/src/NoteBook.Api/Services/IEmailSender.cs`
- Create: `backend/src/NoteBook.Api/Services/SmtpEmailSender.cs`
- Create: `apps/web/src/pages/RegisterPage.tsx`
- Create: `apps/web/src/pages/VerifyEmailPage.tsx`
- Create: `apps/web/src/pages/ForgotPasswordPage.tsx`
- Test: `backend/tests/NoteBook.Tests/RegistrationAndEmailTests.cs`

**Interfaces:**
- Consumes: SendGrid / SMTP credentials in `appsettings.json`
- Produces:
  - `POST /api/auth/register`
  - `POST /api/auth/verify-email?token=...`
  - `POST /api/auth/forgot-password` & `POST /api/auth/reset-password`

- [ ] **Step 1: Write test for user registration, token generation, and verification**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement registration pipeline with email verification and rate-limiting**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 3: Note Sharing & Collaboration Permissions

**Files:**
- Create: `backend/src/NoteBook.Api/Models/NoteShare.cs`
- Create: `backend/src/NoteBook.Api/Controllers/SharesController.cs`
- Create: `apps/web/src/components/ShareModal.tsx`
- Create: `apps/mobile/src/components/MobileShareModal.tsx`
- Test: `backend/tests/NoteBook.Tests/NoteSharingTests.cs`

**Interfaces:**
- Consumes: `NoteId`, `TargetEmail`, `Permission` ('viewer' | 'editor')
- Produces: Read-only or collaborative editing access to shared notes for authorized secondary users.

- [ ] **Step 1: Write integration test for viewer vs editor permissions**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement NoteShare model, endpoint, and UI share modal**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 4: Custom Domain & MonsterASP Pro Hosting Configuration

**Files:**
- Create: `docs/deployment/monsterasp-pro-setup.md`
- Modify: `backend/src/NoteBook.Api/web.config` (add HSTS & SSL rewrite rules)
- Modify: `backend/src/NoteBook.Api/Program.cs` (configure ForwardedHeaders & HTTPS redirection)

**Interfaces:**
- Consumes: MonsterASP custom domain binding, Let's Encrypt SSL certificate
- Produces: Automated HTTPS redirection, canonical domain enforcement, and documentation for DNS CNAME / A-record configuration.

- [ ] **Step 1: Write deployment verification checklist**
- [ ] **Step 2: Configure web.config and ForwardedHeaders middleware**
- [ ] **Step 3: Commit**

---

### Task 5: iOS App Configuration & App Store Release Setup

**Files:**
- Modify: `apps/mobile/app.json` (add iOS bundleIdentifier, camera & photo permissions, icon assets)
- Modify: `apps/mobile/eas.json` (configure `production` profile with iOS enterprise/store provisioning)
- Create: `apps/mobile/src/screens/AccountSettingsScreen.tsx` (include mandatory "Delete Account" button per Apple App Store Guideline 5.1.1)
- Test: `apps/mobile/tests/AccountSettings.test.tsx`

**Interfaces:**
- Consumes: EAS Build credentials (Apple Developer Team ID, Provisioning Profile)
- Produces: Ready-to-submit `.ipa` for TestFlight / App Store and `.aab` for Google Play Store.

- [ ] **Step 1: Write test for account deletion flow**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Configure iOS permissions, delete account UI, and EAS production builds**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit**
