# Quizly

A React quiz experience backed by an Express API and MongoDB. The original single-page quiz remains in `quiz.html`; the new application lives in `client/` and `server/`.

## Run locally

Prerequisites: Node.js 20 or newer and a MongoDB connection string (local MongoDB or MongoDB Atlas).

1. Install dependencies from the project root with `npm install`.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a long, private `JWT_SECRET`. Set a private `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the initial administrator account.
3. Start both applications with `npm run dev`.
4. Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

On first connection the API seeds the seven categories, six subject quizzes, and the original 45 general-knowledge questions. It creates the initial administrator only when both admin environment variables are set and the account does not already exist. Do not use the example admin credentials in a shared environment.

Without MongoDB, the client remains usable in local demo mode: quiz answers and results are stored in the current browser. Authentication, synchronized history, and admin APIs require MongoDB.

## Useful commands

- `npm run dev` starts the client and API.
- `npm run build` creates the production client bundle in `client/dist/`.
- `npm start` starts the API in production mode.

The API listens on port `4000` by default. The client proxies `/api` requests to it. Configure `PORT` and `CLIENT_URL` in `.env` when deploying.

## Publish with Vercel and Render

The repository includes `vercel.json` for the React client and `render.yaml` for the API. Push the project to a Git provider, then import the same repository into Vercel and Render. Render can create the API service from the blueprint; Vercel builds from the project root and publishes `client/dist/`.

Create a MongoDB Atlas database and set `MONGODB_URI`, `CLIENT_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the Render service environment. Render generates `JWT_SECRET`. Set `CLIENT_URL` to the exact Vercel site origin, for example `https://your-project.vercel.app`. In Vercel, set `VITE_API_URL` to the Render service origin, for example `https://quiz-platform-api.onrender.com`, then redeploy the client. Keep all secrets in the provider dashboards, never in committed files.

## Project layout

- `client/src/components/` contains shared controls and navigation.
- `client/src/pages.jsx` contains the landing, explore, quiz, results, dashboard, leaderboard, auth, and admin screens.
- `client/src/services/api.js` handles API requests and browser-demo persistence.
- `server/src/models/` contains the Mongoose models.
- `server/src/routes/` contains the REST API routes.
- `server/src/seed.js` seeds the starter categories, quizzes, and preserved legacy question bank.

Registration creates a normal user account. The first administrator is provisioned from the private environment variables; admin authorization is checked on the server for every protected endpoint.