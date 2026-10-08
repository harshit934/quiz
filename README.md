# Quizly

A React quiz experience backed by an Express API and MongoDB. The original single-page quiz remains in `quiz.html`; the new application lives in `client/` and `server/`.

## Run locally

Prerequisites: Node.js 20 or newer and a MongoDB connection string (local MongoDB or MongoDB Atlas).

1. Install dependencies from the project root with `npm install`.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a long, private `JWT_SECRET`. Set private `ADMIN_USERNAME` and `ADMIN_PASSWORD` values for the initial username-based administrator account. `ADMIN_EMAIL` remains supported for legacy email-based provisioning. To enable Google sign-in, set `GOOGLE_CLIENT_ID` in the API environment and the same public OAuth web client ID as `VITE_GOOGLE_CLIENT_ID` in `client/.env.local`.
3. Start both applications with `npm run dev`.
4. Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

On first connection the API seeds the seven categories, six subject quizzes, and the original 45 general-knowledge questions. It creates the configured administrator only when both admin environment variables are set and the account does not already exist. Username-based administrators sign in with their username and receive the same JWT and server-side admin authorization as email-based administrators. Never put admin credentials or JWT secrets in client code or shared source control.

Google sign-in uses Google Identity Services' OIDC popup and the existing `/api/auth/google` API route. Google displays its account chooser; the API verifies the signed ID token and issues the normal Quizly JWT. This popup flow does not use a client secret.

Create a Google OAuth 2.0 Client ID of type **Web application**. Add these **Authorized JavaScript origins**:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `https://cheerful-shortbread-db3e79.netlify.app`

No **Authorized redirect URI** is required for this popup flow. For local development, set `VITE_GOOGLE_CLIENT_ID` in `client/.env.local` and `GOOGLE_CLIENT_ID` in the API's root `.env`. In Netlify, set `VITE_GOOGLE_CLIENT_ID` in the site's build environment and redeploy so Vite embeds it. In Render, set `GOOGLE_CLIENT_ID` in the backend service runtime environment and set `CLIENT_URL` to the Netlify origin above. The frontend and backend client ID values must match. Never expose a client secret in the frontend.


Without MongoDB, the client remains usable in local demo mode: quiz answers and results are stored in the current browser. Authentication, synchronized history, and admin APIs require MongoDB.

## Useful commands

- `npm run dev` starts the client and API.
- `npm run build` creates the production client bundle in `client/dist/`.
- `npm start` starts the API in production mode.

The API listens on port `4000` by default. The client proxies `/api` requests to it. Configure `PORT` and `CLIENT_URL` in `.env` when deploying.

## Publish with Vercel and Render

The repository includes `vercel.json` for the React client and `render.yaml` for the API. Push the project to a Git provider, then import the same repository into Vercel and Render. Render can create the API service from the blueprint; Vercel builds from the project root and publishes `client/dist/`.

Create a MongoDB Atlas database and set `MONGODB_URI`, `CLIENT_URL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in the Render service environment. Render generates `JWT_SECRET`. For a legacy email-based administrator, use `ADMIN_EMAIL` and `ADMIN_PASSWORD` instead. Set `CLIENT_URL` to the exact client site origin. Keep all secrets in provider dashboards, never in committed files.

## Project layout

- `client/src/components/` contains shared controls and navigation.
- `client/src/pages.jsx` contains the landing, explore, quiz, results, dashboard, leaderboard, auth, and admin screens.
- `client/src/services/api.js` handles API requests and browser-demo persistence.
- `server/src/models/` contains the Mongoose models.
- `server/src/routes/` contains the REST API routes.
- `server/src/seed.js` seeds the starter categories, quizzes, and preserved legacy question bank.

Registration creates a normal user account. The first administrator is provisioned from the private environment variables; admin authorization is checked on the server for every protected endpoint.