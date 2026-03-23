# Authentication Comparison Diploma Project

This repository contains a complete university diploma prototype for the topic:

**Comparative analysis of authentication methods in web applications (session-based, JWT, and OAuth 2.0) and development of an authentication module prototype for a web application**

The application demonstrates three authentication methods in one Node.js project:

- Session-based authentication
- JWT authentication
- OAuth 2.0 authentication with Google

## Full project architecture

```text
project-root/
  config/
    db.js
    passport.js
  controllers/
    authController.js
    pageController.js
  middleware/
    checkJWTAuth.js
    checkSessionAuth.js
  models/
    User.js
  routes/
    apiRoutes.js
    authRoutes.js
    pageRoutes.js
  views/
    partials/
      footer.ejs
      header.ejs
      navbar.ejs
    pages/
      compare.ejs
      dashboard.ejs
      error.ejs
      home.ejs
      login.ejs
      profile.ejs
      register.ejs
  public/
    css/
      style.css
    js/
      main.js
  .env.example
  app.js
  package.json
  README.md
```

## Implemented functionality

- Home page
- Registration page
- Login page with three separate authentication blocks
- Dashboard page
- Profile page
- Comparison page
- Logout functionality
- Protected session routes
- Protected JWT API route

## Authentication methods in this project

### 1. Session-based authentication

- Registration is performed with email and password.
- Passwords are hashed with `bcrypt`.
- Login uses Passport Local Strategy and route `POST /login-session`.
- `express-session` creates a server-side session.
- The browser stores the session cookie.
- Protected page routes use `checkSessionAuth`.
- Logout destroys the session and clears the cookie.

### 2. JWT authentication

- Login uses route `POST /login-jwt`.
- The server validates local credentials and returns a signed JWT.
- JWT payload contains:
  - `userId`
  - `email`
  - `authMethod: "jwt"`
- The frontend stores the token in `localStorage`.
- Protected route `GET /api/jwt-profile` requires `Authorization: Bearer <token>`.
- Middleware `checkJWTAuth` verifies the token and loads the user.
- Logout on the frontend removes the token from browser storage.

### 3. OAuth 2.0 authentication

- This project uses Google OAuth 2.0.
- The user starts login with `GET /auth/google`.
- Google redirects back to `GET /auth/google/callback`.
- Passport Google Strategy finds or creates the user in MongoDB.
- The dashboard then shows that the user logged in via OAuth 2.0.

## User model

The MongoDB `User` model includes:

- `email`
- `passwordHash`
- `authMethods`
- `oauthProvider`
- `oauthId`
- `createdAt`
- `name`
- `avatar`

If the same email is used with multiple methods, the `authMethods` array stores all linked methods.

## Technologies

- Node.js
- Express.js
- Passport.js
- MongoDB with Mongoose
- EJS
- Bootstrap 5
- bcrypt
- jsonwebtoken
- dotenv

## Setup instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment file

Linux/macOS:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Configure `.env`

Provide the following values:

- `PORT`
- `MONGODB_URI`
- `SESSION_SECRET`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

### 4. Start MongoDB

Use either:

- a local MongoDB server
- MongoDB Atlas connection string

### 5. Run the project

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

### 6. Open in browser

[http://localhost:3000](http://localhost:3000)

## Google OAuth 2.0 configuration

1. Open Google Cloud Console.
2. Create OAuth credentials for a web application.
3. Add the following authorized redirect URI:

```text
http://localhost:3000/auth/google/callback
```

4. Paste the generated values into `.env`.

## Main routes

### Pages

- `GET /`
- `GET /register`
- `GET /login`
- `GET /dashboard`
- `GET /profile`
- `GET /compare`

### Authentication routes

- `POST /register`
- `POST /login-session`
- `POST /login-jwt`
- `POST /logout`
- `GET /auth/google`
- `GET /auth/google/callback`

### API route

- `GET /api/jwt-profile`

## Explanation for diploma defense

### Session-based authentication

This method stores login state on the server. It is convenient for traditional web applications because the browser only needs to keep a session cookie while the backend maintains the authenticated state.

### JWT authentication

This method stores claims inside a signed token. It is more suitable for REST APIs, SPAs, and mobile clients because it supports stateless request verification.

### OAuth 2.0 authentication

This method delegates authentication to an external provider. In this project, Google verifies the identity and the application receives profile information after successful authorization.

## Suggested local demonstration scenario

1. Register a local user account.
2. Log in using the Session form and open the dashboard.
3. Log out.
4. Log in using the JWT form and show the returned token.
5. Demonstrate that `/api/jwt-profile` works with the bearer token.
6. Log out from the interface so the JWT token is removed from browser storage.
7. Log in with Google OAuth 2.0.
8. Open the Compare page and explain the practical differences between the methods.

## Run instructions summary

```bash
npm install
cp .env.example .env
# fill in environment variables
npm run dev
```
