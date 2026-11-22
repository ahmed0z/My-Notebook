# Public Signup, Email Password Reset & Workspace Isolation Design Spec

**Date:** 2026-11-22  
**Author:** Antigravity Team  
**Status:** Approved  

---

## 1. Intent and Overview

This specification defines the architecture, data contracts, and UX patterns for:
1. **Public Signup (Self-Registration):** Anyone can sign up for their own account with a username, email, and password.
2. **Self Password Reset via Email Code:** Users can reset their forgotten password by requesting a 6-digit verification code delivered to their registered email address.
3. **Strict Workspace & Data Isolation:** Each user has their own independent workspace, default space ("General"), notes, blocks, search results, and uploads. No cross-tenant access is possible.
4. **Material Design 3 (M3) UI:** The authentication experience (Sign In, Create Account, Forgot Password) uses Material Design 3 design tokens, surface containers, tonal elevations, outlined inputs, and segmented controls.
5. **MonsterASP Production Deployment:** Built, tested, and deployed to MonsterASP IIS (.NET 8 AnyCPU with PostgreSQL database).

---

## 2. Architecture & Data Contracts

### 2.1 Backend API Endpoints

#### Authentication & Registration
- `POST /api/auth/register` (Anonymous)
  - **Request Body:** `{ "username": "string", "email": "string", "password": "string" }`
  - **Validation:**
    - `username`: Required, trimmed, 3-50 chars, alphanumeric + underscores.
    - `email`: Required, valid email syntax, max 200 chars.
    - `password`: Required, min 6 chars.
  - **Behavior:**
    - Checks for existing username (case-insensitive) -> `409 Conflict` ("Username already taken").
    - Checks for existing email (case-insensitive) -> `409 Conflict` ("Email already registered").
    - Hashes password using BCrypt.
    - Creates `User` record with unique `Guid Id`.
    - Automatically creates a default `Space` for the user:
      `{ Id = Guid.NewGuid(), UserId = user.Id, Name = "General", Position = 0, CreatedAt = DateTime.UtcNow }`
    - Returns `AuthResponse`: `{ "token": "jwt_token", "username": "...", "email": "..." }` (status `200 OK`).

- `POST /api/auth/login` (Anonymous)
  - Supports logging in with either **Username** or **Email**.
  - Returns `AuthResponse` with JWT token.

- `POST /api/auth/forgot-password` (Anonymous)
  - **Request Body:** `{ "email": "string" }`
  - **Behavior:**
    - Finds user by email (case-insensitive).
    - If found, generates 6-digit random code (100000 - 999999), saves `user.ResetCode = code`, `user.ResetCodeExpiresAt = DateTime.UtcNow.AddMinutes(15)`.
    - Dispatches email via `IEmailSender` with Material Design 3 styled HTML template.
    - Always returns `{ "success": true, "message": "If an account with that email exists, a reset code has been sent." }` to prevent email enumeration. (In non-production/test environments, includes `devCode` for diagnostic test runners).

- `POST /api/auth/reset-password` (Anonymous)
  - **Request Body:** `{ "email": "string", "code": "string", "newPassword": "string" }`
  - **Behavior:**
    - Validates email, reset code, and expiration (`ResetCodeExpiresAt >= DateTime.UtcNow`).
    - If valid, updates `PasswordHash = BCrypt.HashPassword(newPassword)`, clears `ResetCode` and `ResetCodeExpiresAt`.
    - Returns `{ "success": true, "message": "Password reset successfully. You can now log in." }`.

### 2.2 Transactional Email Service (`IEmailSender` & `SmtpEmailSender`)

- Interface:
  ```csharp
  public interface IEmailSender {
      Task<bool> SendPasswordResetEmailAsync(string toEmail, string resetCode, string username);
  }
  ```
- Implementation: `SmtpEmailSender`
  - Reads configuration:
    - `Smtp:Host` (env: `SMTP_HOST`)
    - `Smtp:Port` (env: `SMTP_PORT`, default 587)
    - `Smtp:Username` (env: `SMTP_USER`)
    - `Smtp:Password` (env: `SMTP_PASS`)
    - `Smtp:FromEmail` (env: `SMTP_FROM`, default `noreply@mynotebook.runasp.net`)
    - `Smtp:FromName` (default `NoteBook Security`)
    - `Smtp:EnableSsl` (default true)
  - Generates HTML email containing:
    - NoteBook branding
    - 6-digit security code displayed in a prominent letter-spaced pill container
    - Clear 15-minute expiration notice and security advisory.
  - Safe fallback: if SMTP is unconfigured or encounters a network error, logs warning without crashing, returning false or logging error gracefully.

### 2.3 Strict Multi-Tenant Data Isolation

All application queries must be scoped to `UserId`:
- `Notes`: Scoped to `n.UserId == currentUserId`.
- `Spaces`: Scoped to `s.UserId == currentUserId`.
- `Blocks`: Accessed and mutated strictly through `block.Note.UserId == currentUserId`.
- `Search`: Queries filter `n.UserId == currentUserId`.
- `NoteLinks`: Target/source link resolutions only connect notes owned by `currentUserId`.
- Direct ID access (e.g. `GET /api/notes/{other_user_note_id}`) returns `404 Not Found`.

### 2.4 Frontend Material Design 3 UI (`LoginPage.tsx`)

- **State Modes:**
  - `'login'`: Sign In with Username/Email and Password.
  - `'signup'`: Create Account with Username, Email, Password, Confirm Password.
  - `'forgot'`: Forgot Password with two progressive steps:
    - Step 1: Enter email -> Request code.
    - Step 2: Enter 6-digit code, new password, confirm password -> Submit reset.
- **M3 Elements:**
  - Segmented control pill header (`[ Sign In ] [ Create Account ]`) with active surface elevation.
  - Surface container with `rounded-3xl`, subtle border, backdrop blur.
  - Outlined inputs with floating appearance, leading icon adornments, clear helper texts, and focus ring.
  - Accessible error and success callouts using M3 tonal container styles.
