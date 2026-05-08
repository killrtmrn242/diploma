# Selenium Negative Security Tests

These tests validate that protected authentication resources reject missing, expired, invalid, or removed authentication state.

## Setup

Install dependencies:

```powershell
npm install
```

Start the application and MongoDB:

```powershell
npm run dev
```

In another terminal, run:

```powershell
npm run test:security
```

Optional environment variables:

```powershell
$env:TEST_BASE_URL="http://localhost:3000"
$env:TEST_EMAIL="security-negative@example.com"
$env:TEST_PASSWORD="security-password-123"
$env:HEADLESS="false"
npm run test:security
```

## What Is Tested

- Session-based authentication rejects unauthenticated dashboard access.
- Session logout and deleted session cookies prevent further dashboard access.
- JWT API access rejects missing, invalid, and cleared tokens.
- JWT API access accepts a valid Bearer token.
- OAuth callback access without a valid Google authorization code fails or redirects.
- Real Google OAuth login is not automated because it requires an external identity provider and user consent.

## Thesis Explanation

These Selenium tests are negative security tests, not attacks. Their purpose is to verify that the authentication module correctly rejects invalid or missing authentication state. The tests simulate common failure cases such as missing session cookies, removed JWT tokens, invalid JWT tokens, and invalid OAuth callback requests. This helps demonstrate that protected routes are not accessible without the correct authentication mechanism.
