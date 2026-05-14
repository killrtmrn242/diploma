# Render Deployment Notes

This project can be deployed to Render as a Node.js web service.

## Render Commands

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

The `start` script runs:

```bash
node app.js
```

## Required Environment Variables

Configure these variables in the Render service environment settings:

```text
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/diploma_auth_demo
SESSION_SECRET=use_a_long_random_secret
JWT_SECRET=use_a_long_random_jwt_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_CALLBACK_URL=https://YOUR-RENDER-APP.onrender.com/auth/google/callback
```

Optional alternative:

```text
APP_BASE_URL=https://YOUR-RENDER-APP.onrender.com
```

If `GOOGLE_CALLBACK_URL` is not set, the application can build the callback URL from `APP_BASE_URL`.

## MongoDB Atlas Network Access

If MongoDB Atlas is used, open Atlas Network Access for Render.

For a quick demo deployment, Atlas can allow access from:

```text
0.0.0.0/0
```

For a stricter production setup, restrict access according to the current Render networking configuration.

## Google OAuth Redirect URI

In Google Cloud Console, add this authorized redirect URI:

```text
https://YOUR-RENDER-APP.onrender.com/auth/google/callback
```

It must match the deployed `GOOGLE_CALLBACK_URL` exactly.

## Session Cookies On Render

Render serves the app through HTTPS behind a proxy. The server enables Express trust proxy and uses secure cookies when `NODE_ENV=production`.

Make sure Render has:

```text
NODE_ENV=production
```

## Generated Test Artifacts

Selenium test results are generated locally or during test runs:

```text
selenium-security-results.json
selenium-results/
```

These files are ignored by Git and are not required for the application to start on Render.
