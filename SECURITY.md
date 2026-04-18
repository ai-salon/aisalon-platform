# Security Desiderata

Standards and principles for the Ai Salon platform codebase. All contributors must follow these when writing or reviewing code.

## Secrets Management

1. **Never hardcode secrets.** All sensitive config (SECRET_KEY, database credentials, API keys, passwords) must come from environment variables only. No default values for secrets in source code.
2. **Fail-closed on missing secrets.** The app must refuse to start if SECRET_KEY, DATABASE_URL (in production), or other required secrets are not explicitly set. Never fall back to insecure defaults.

## Authentication & Sessions

3. **Rate-limit auth endpoints.** Max 5 failed login attempts per IP per 15 minutes. Use slowapi or equivalent middleware.
4. **Minimum password strength.** Registration must enforce: 12+ characters, at least one uppercase, one lowercase, one number.
5. **Short-lived access tokens.** JWT access tokens should have a 2-hour TTL. Use refresh token rotation for longer sessions.
6. **Align session TTLs.** Frontend session maxAge must not exceed backend token expiry to avoid ghost sessions.

## Input Validation & Data Handling

7. **Validate all uploads.** Whitelist allowed MIME types, verify with magic bytes (not just extension), enforce file size limits.
8. **Sanitize filenames.** Never use user-supplied filenames directly in file paths. Use `os.path.basename()` or generate UUIDs.
9. **Explicit field assignment.** Never use `setattr()` loops on ORM models from user input. Whitelist the specific fields that may be updated.
10. **Encrypt PII at rest.** Email addresses, names, and other personal data in public-facing tables must be encrypted at the field level.

## Infrastructure & Deployment

11. **Non-root containers.** All Dockerfiles must create and switch to a dedicated non-root user (e.g., `appuser` with UID 1000).
12. **Pin external dependencies.** Git-based dependencies must be locked to a specific commit hash, not a branch.
13. **CORS minimal surface.** Only allow the specific HTTP methods and headers the frontend actually uses. Never use `*` for methods or headers.
14. **DB connections require SSL.** PostgreSQL connections in production must use `sslmode=require` or stricter.

## CI/CD & Supply Chain

15. **Dependency scanning.** CI pipeline must run `npm audit` (frontend) and `pip-audit` or equivalent (backend) on every PR.
16. **Static analysis.** Integrate CodeQL, Semgrep, or equivalent SAST tool in GitHub Actions.
