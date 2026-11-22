# Public Signup, Email Password Reset & Workspace Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement public user signup, email verification code password reset, and strict row-level workspace and data isolation, with Material Design 3 frontend UI elements, and deploy to MonsterASP.

**Spec:** [docs/superpowers/specs/2026-11-22-public-signup-password-reset-workspaces-design.md](file:///workspace/My-NoteBook/docs/superpowers/specs/2026-11-22-public-signup-password-reset-workspaces-design.md)

## Global Constraints

- All data operations (`Notes`, `Blocks`, `Spaces`, `Search`, `NoteLinks`) must be strictly scoped to the authenticated `UserId`. No user may read, modify, or delete another user's notes or spaces.
- Public registration (`POST /api/auth/register`) must create a default "General" space for every new user so each user has an immediate personal workspace.
- Self password reset (`POST /api/auth/forgot-password` and `POST /api/auth/reset-password`) must deliver a 6-digit code via email using `IEmailSender` / `SmtpEmailSender` with HTML formatting, expiring after 15 minutes.
- The authentication UI must use Material Design 3 (M3) styling (surface containers, pill segmented switches, outlined text inputs with icon adornments, tonal containers for alerts).
- All database migrations must be idempotent PostgreSQL SQL executed automatically on application startup in `Program.cs`.
- Deployed and verified on MonsterASP at `https://mynotebook.runasp.net/`.

---

### Task 1: Backend Public Registration and Strict Multi-Tenant Data Isolation

**Files:**
- Modify: `backend/src/NoteBook.Api/DTOs/AuthDtos.cs` (add `RegisterRequest`)
- Modify: `backend/src/NoteBook.Api/Services/IAuthService.cs` (add `RegisterAsync`)
- Modify: `backend/src/NoteBook.Api/Services/AuthService.cs` (implement `RegisterAsync` with unique checks and auto-creation of default Space)
- Modify: `backend/src/NoteBook.Api/Controllers/AuthController.cs` (add `[HttpPost("register")] [AllowAnonymous]`)
- Create: `backend/tests/NoteBook.Tests/MultiTenantDataIsolationTests.cs` (comprehensive integration test proving complete data isolation across multiple users)

**Interfaces:**
- Consumes: `RegisterRequest(string Username, string Email, string Password)`
- Produces: `POST /api/auth/register` returning `AuthResponse(Token, Username, Email)`

- [ ] **Step 1: Write integration tests in `MultiTenantDataIsolationTests.cs` testing registration and cross-user data isolation**
- [ ] **Step 2: Run test to verify it fails before implementation**
- [ ] **Step 3: Implement `RegisterRequest`, `IAuthService.RegisterAsync`, and `AuthController.Register`**
- [ ] **Step 4: Run test to verify all tests in `MultiTenantDataIsolationTests.cs` pass**
- [ ] **Step 5: Commit changes**

---

### Task 2: Backend Self Password Reset via Email Code (SMTP Service & Flow)

**Files:**
- Create: `backend/src/NoteBook.Api/Services/IEmailSender.cs`
- Create: `backend/src/NoteBook.Api/Services/SmtpEmailSender.cs`
- Modify: `backend/src/NoteBook.Api/Program.cs` (register `IEmailSender` in DI and configure SMTP options)
- Modify: `backend/src/NoteBook.Api/appsettings.json` (add `Smtp` configuration section)
- Modify: `backend/src/NoteBook.Api/Services/AuthService.cs` (inject `IEmailSender` and send email with Material 3 HTML template on `RequestPasswordResetAsync`)
- Create: `backend/tests/NoteBook.Tests/PasswordResetEmailTests.cs` (unit & integration tests for password reset code generation, expiration, validation, and email sender)

**Interfaces:**
- Consumes: SMTP configuration / environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
- Produces: `IEmailSender.SendPasswordResetEmailAsync` sending 6-digit code via email, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`

- [ ] **Step 1: Write unit & integration tests in `PasswordResetEmailTests.cs` for password reset flow and email sender**
- [ ] **Step 2: Run test to verify it fails before implementation**
- [ ] **Step 3: Implement `IEmailSender`, `SmtpEmailSender`, DI registration, and update `AuthService`**
- [ ] **Step 4: Run test to verify all tests in `PasswordResetEmailTests.cs` pass**
- [ ] **Step 5: Commit changes**

---

### Task 3: Frontend UI Public Signup & Password Reset with Material Design 3

**Files:**
- Modify: `packages/shared/src/types/auth.ts` (export `RegisterRequest` if needed)
- Modify: `apps/web/src/api/client.ts` (add `register(username, email, password)`)
- Modify: `apps/web/src/pages/LoginPage.tsx` (implement M3 segmented tabs for Sign In / Create Account, M3 outlined text fields with icon adornments, real-time validation, public signup, and 2-step email code password reset)
- Create: `apps/web/tests/LoginPage.test.tsx` (tests for switching modes, validation, registration submission, and reset password flow)

**Interfaces:**
- Consumes: `ApiClient.register`, `ApiClient.login`, `ApiClient.forgotPassword`, `ApiClient.resetPassword`
- Produces: Intuitive Material Design 3 authentication UX allowing self-signup, direct workspace initialization, and mail-code password reset.

- [ ] **Step 1: Write frontend component tests in `apps/web/tests/LoginPage.test.tsx`**
- [ ] **Step 2: Run test to verify it fails before implementation**
- [ ] **Step 3: Update `ApiClient.register` and redesign `LoginPage.tsx` with Material Design 3 elements**
- [ ] **Step 4: Run test to verify all tests in `apps/web/tests/LoginPage.test.tsx` and existing suites pass**
- [ ] **Step 5: Commit changes**

---

### Task 4: Production Build, Database Migration & MonsterASP Deployment

**Files:**
- Modify: `backend/src/NoteBook.Api/Program.cs` (verify startup SQL migration creates all required tables, columns, and indexes)
- Run: Build shared library (`npm --prefix packages/shared run build`)
- Run: Build web application (`npm --prefix apps/web run build`)
- Run: Publish ASP.NET Core API for MonsterASP (`dotnet publish backend/src/NoteBook.Api/NoteBook.Api.csproj -c Release -o publish-anycpu/`)
- Run: Deploy via SFTP to MonsterASP (`python3 scripts/deploy-sftp.py`)
- Test: Verify live production endpoint `https://mynotebook.runasp.net/`

**Interfaces:**
- Consumes: MonsterASP SFTP credentials and production PostgreSQL connection
- Produces: Live updated application on MonsterASP with public signup and email password reset.

- [ ] **Step 1: Verify startup database migrations in `Program.cs`**
- [ ] **Step 2: Build shared package, web frontend, and .NET release**
- [ ] **Step 3: Deploy to MonsterASP via SFTP**
- [ ] **Step 4: Perform live verification against MonsterASP endpoints**
- [ ] **Step 5: Commit any deployment updates**
