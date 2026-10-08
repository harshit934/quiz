# Quizly

A React quiz experience backed by an Express API and MongoDB. The original single-page quiz remains in `quiz.html`; the new application lives in `client/` and `server/`.

## Run locally

Prerequisites: Node.js 20 or newer and a MongoDB connection string (local MongoDB or MongoDB Atlas).

1. Install dependencies from the project root with `npm install`.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a long, private `JWT_SECRET`. Set private `ADMIN_USERNAME` and `ADMIN_PASSWORD` values for the initial username-based administrator account. `ADMIN_EMAIL` remains supported for legacy email-based provisioning. To enable Google sign-in, set `GOOGLE_CLIENT_ID` in the API environment and the same public OAuth web client ID as `VITE_GOOGLE_CLIENT_ID` in `client/.env.local`.
3. Start both applications with `npm run dev`.
4. Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

On first connection the API seeds the seven categories, six subject quizzes, and the original 45 general-knowledge questions. It creates the configured administrator only when both admin environment variables are set and the account does not already exist. Username-based administrators sign in with their username and receive the same JWT and server-side admin authorization as email-based administrators. Never put admin credentials or JWT secrets in client code or shared source control.

Google sign-in uses Google Identity Services' OIDC popup and the existing `/api/auth/google` API route. Google displays its account chooser; the API verifies the returned signed ID token and issues the same Quizly JWT used by email/password login. A Google client secret is not used or needed for this popup flow.

Create an OAuth 2.0 Client ID of type **Web application** in Google Cloud Console. Configure its **Authorized JavaScript origins** with:

- `http://localhost:5173` for local Vite development (also add `http://127.0.0.1:5173` if you open the app using that host).
- The production frontend origin `https://cheerful-shortbread-db3e79.netlify.app` (no path or trailing slash).

No **Authorized redirect URI** is required for this popup/ID-token flow. For local development, put the client ID in `client/.env.local` as `VITE_GOOGLE_CLIENT_ID=...` and in the API's root `.env` as `GOOGLE_CLIENT_ID=...` (the API loads this file at startup). For Netlify, add `VITE_GOOGLE_CLIENT_ID` to **Site configuration → Environment variables** for the production deploy context; Vite embeds it at build time, so trigger a new deploy after adding/changing it. For Render, add `GOOGLE_CLIENT_ID` to the backend web service environment (also declared as a non-synchronized variable in `render.yaml`) and restart/redeploy the service. Both variables must contain the same Web application client ID. `VITE_GOOGLE_CLIENT_ID` is public and must never contain a client secret. Do not set `GOOGLE_CLIENT_SECRET` for this flow.

The production frontend origin is `https://cheerful-shortbread-db3e79.netlify.app`, and its API URL is `https://quiz-1-f2c7.onrender.com`. Add the frontend origin (no path or trailing slash) to Google Cloud's authorized JavaScript origins and set Render's `CLIENT_URL` to the same origin for API CORS. The API URL is not a Google redirect URI.

Without MongoDB, the client remains usable in local demo mode: quiz answers and results are stored in the current browser. Authentication, synchronized history, and admin APIs require MongoDB.

## Useful commands

## Technology coding practice

Open **Coding** in the navigation to practice all 18 technology subjects, with separate Easy (40 points), Medium (60 points), and Hard (100 points) exercises. Each subject uses its corresponding language and starter code: Python for Python/data/AI/security, HTML and CSS for web markup and styling, React JSX for React, SQLite SQL for database queries, and MongoDB JSON aggregation pipelines for MongoDB. Python loads Pyodide from jsDelivr on first run; an internet connection is required. SQLite, MongoDB's in-memory query engine, and JSX compilation run in disposable browser workers. HTML/CSS and rendered React markup use script-disabled previews and DOM/computed-style assertions. Execution has a three-second limit after loading the runtime.

Java, Node.js, Git and cloud Bash exercises use an optional isolated Judge0 compiler. Configure `JUDGE0_URL` and any required server-side authentication variables from `.env.example`; verify language IDs against the service's `/languages` endpoint. Git exercises require Git installed in the compiler's Bash environment. Learner programs never execute on the Express host. Missing compiler configuration shows a setup message. Compiler runs require a signed-in account and are rate limited; credentials stay on the API server. Deploy the updated API to enable `/api/coding/run`.

The list shows difficulty, passed tests, score and status. **New attempt** generates another variation; running tests retains the question for debugging. **Save code** and **Resume saved code** retain native-language drafts. Practice progress and attempt sequence persist in browser storage; results are local and are not graded quiz or exam attempts.

## Development commands

- `npm run dev` starts the client and API.
- `npm run build` creates the production client bundle in `client/dist/`.
- `npm start` starts the API in production mode.
- `npm run validate:question-batches -- path\\to\\batch.json` validates reviewable question-batch JSON without connecting to MongoDB.
- `npm run inventory:quizzes -- --confirm-non-production` creates a read-only quiz inventory using `QUIZLY_INVENTORY_MONGODB_URI`.
- `npm run plan:question-generation` creates a generation plan and small question-batch templates from the saved inventory, without connecting to MongoDB.
- `npm run export:quiz-bank -- --confirm-source` creates a read-only quiz-bank JSON export using `QUIZLY_QUIZ_BANK_EXPORT_MONGODB_URI`.
- `npm run migrate:quiz-questions -- --confirm-non-production --batch path\\to\\reviewed-batch.json` safely fills quiz question counts from reviewed question batches.

The API listens on port `4000` by default. The client proxies `/api` requests to it. Configure `PORT` and `CLIENT_URL` in `.env` when deploying.

## Offline question-bank batches

Create reviewable JSON files using [server/question-batch.schema.json](./server/question-batch.schema.json). A batch has a `formatVersion`, a unique `batchId`, and one or more quiz entries identified by `categorySlug`, the exact `title`, and `difficulty` (`Easy`, `Medium`, or `Hard`). Each question contains only `text`, four unique `options`, a zero-based `correctAnswer` index, and a non-empty `explanation`. Do not include MongoDB IDs or `position`; the importer assigns positions after the existing questions.

Run the offline validator against one or more files:

```powershell
npm run validate:question-batches -- server/question-batches/easy-001.json
npm run validate:question-batches -- server/question-batches/easy-001.json server/question-batches/medium-001.json
```

The validator reads JSON files and checks their fields and duplicate question text within each quiz. It never imports database models or opens a database connection. Keep batches small enough to review, and validate every batch before review/approval.

The importer is an explicit function in `server/src/questionBatchImporter.js`; it has no connection behavior. Its MongoDB repository adapter is `server/src/mongooseQuestionBatchRepository.js`, which also does not connect by itself. A future migration must be a separately reviewed script: load the batch JSON, explicitly verify a **local, non-production** MongoDB URI, connect, import `Category`, `Quiz`, and `Question`, construct the adapter, and call:

```js
const repository = createMongooseQuestionBatchRepository({ Category, Quiz, Question })
const result = await importQuestionBatch({ batch, repository })
console.log(result)
```

Disconnect in a `finally` block after importing. Run imports serially. The importer resolves category slug plus exact title and difficulty, fails on missing/ambiguous matches or a difficulty mismatch, skips normalized duplicate text, refuses to exceed the 5/10/15-question difficulty target, inserts at positions after existing questions, and adds question references without removing existing ones. Re-running the same batch skips previously inserted questions. The validator command never imports models or connects to a database; it must never be used as an import command.

## Read-only quiz inventory

Generate the planning inventory only after selecting a non-production database and explicitly setting its URI in the current shell. The inventory command does not load `.env`, and it refuses to connect unless both the environment variable and confirmation flag are present. Never point it at production.

```powershell
$env:QUIZLY_INVENTORY_MONGODB_URI = 'mongodb://127.0.0.1:27017/quiz-platform'
npm run inventory:quizzes -- --confirm-non-production
Remove-Item Env:QUIZLY_INVENTORY_MONGODB_URI
```

The default output is `server/question-batches/quiz-inventory.json`. Use `--output path` to select another path; existing files are not overwritten. The command prints a human-readable totals summary and writes JSON records containing each quiz’s category slug, exact title, difficulty, current question count, target, and missing count. It performs database reads only; it does not create, update, or delete database records.

The stable identity is the exact tuple `categorySlug + title + difficulty`; MongoDB IDs are not used for batch planning. If duplicate identities or invalid quiz/category data are found, the command reports an error and fails without writing an inventory. This inventory is needed before generating question batches so each quiz’s actual remaining question count can be planned rather than estimated from aggregate totals.

## Question-generation planning

First generate or provide `server/question-batches/quiz-inventory.json` using the read-only inventory workflow above. Then run:

```powershell
npm run plan:question-generation
```

The planner reads that JSON as its sole source of quiz counts; it has no MongoDB dependency or connection code. It verifies each record’s difficulty target and missing-count arithmetic, preserves the stable identity `categorySlug + exact title + difficulty`, excludes quizzes at target, and flags above-target quizzes. It writes `server/question-batches/generation-plan.json` with the exact number required per quiz and a human-readable console summary.

The plan groups up to 10 quiz identities per template under `server/question-batches/templates/`. Templates deliberately have empty `questions` arrays: they are planning scaffolds, not valid import batches and contain no generated question content. The exact `missingQuestionCount` for each identity is in `generation-plan.json`. Fill templates in small reviewed batches, then run `npm run validate:question-batches -- <filled-batch.json>` before any separately approved import. The planner refuses to overwrite existing plan or template files; move reviewed outputs aside before regenerating from a refreshed inventory.

## Safe question-count migration

Prepare reviewed question batches for every quiz below its target using the inventory and generation-plan workflow above. A migration batch contains actual question text, four unique options, a correct-answer index, and an explanation; empty templates are not importable. The migration scans every quiz and its existing question documents before writing anything, verifies that the supplied batches contain enough unique questions to bring every below-target quiz to its target, and refuses the entire run before writing if any quiz is missing sufficient content. It adds at most the exact shortfall, skips case-insensitive duplicate question text, preserves existing question documents and quiz references, and uses the existing Mongoose models. Quizzes already at or above target are reported with zero questions added.

The command intentionally does not load `.env` or use the API's general `MONGODB_URI`. Set a dedicated URI only after verifying that it points to a non-production database, validate the reviewed batch files, then run:

```powershell
$env:QUIZLY_QUESTION_MIGRATION_MONGODB_URI = 'mongodb://127.0.0.1:27017/quiz-platform'
npm run validate:question-batches -- server/question-batches/reviewed-batch-001.json
npm run migrate:quiz-questions -- --confirm-non-production --batch server/question-batches/reviewed-batch-001.json --batch server/question-batches/reviewed-batch-002.json
Remove-Item Env:QUIZLY_QUESTION_MIGRATION_MONGODB_URI
```

After migration the command prints each quiz's category, title, difficulty, old question count, number added, and final question count. The script never deletes questions and does not overwrite existing question records. It updates only the quiz's question references and `totalQuestions` when it inserts questions. Do not use it with a production URI.

## Read-only quiz-bank export

The export command is for an authorized database owner/operator only. It reads quiz-bank data and exports only categories, quizzes, and questions, preserving category-to-quiz and quiz-to-question references. User accounts, attempts, and other application data are intentionally excluded. The command does not load `.env` and never reads the application's normal `MONGODB_URI`.

Set the dedicated URI explicitly in the current shell only after verifying that you are authorized to access the selected source. Do not use production unless the database owner explicitly authorizes that export; prefer a verified non-production source.

```powershell
$env:QUIZLY_QUIZ_BANK_EXPORT_MONGODB_URI = '<authorized source MongoDB URI>'
npm run export:quiz-bank -- --confirm-source
Remove-Item Env:QUIZLY_QUIZ_BANK_EXPORT_MONGODB_URI
```

The default output is `server/question-batches/current-quiz-bank-export.json`. It includes string IDs and export metadata but never includes the URI. Existing files are not overwritten; choose `--output <new-path>` or explicitly pass `--overwrite` to replace an output. The exporter validates all references, IDs, quiz difficulty, and question counts before writing, and refuses structurally inconsistent data. Its database adapter only uses `find`, projection, and `lean`; automatic index creation is disabled.

Restore an authorized export only into a fresh, isolated **non-production** MongoDB database. Verify the restored category, quiz, and question data, then use that restored copy to generate the exact read-only quiz inventory. Do not point batch-generation or import work at production.

## Publish with Vercel and Render

The repository includes `vercel.json` for the React client and `render.yaml` for the API. Push the project to a Git provider, then import the same repository into Vercel and Render. Render can create the API service from the blueprint; Vercel builds from the project root and publishes `client/dist/`.

Create a MongoDB Atlas database and set `MONGODB_URI`, `CLIENT_URL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in the Render service environment. Render generates `JWT_SECRET`. For Google sign-in, set `GOOGLE_CLIENT_ID` in Render and the same value as `VITE_GOOGLE_CLIENT_ID` in the frontend hosting provider's build environment, then authorize the exact frontend site origin in Google Cloud Console. For a legacy email-based administrator, use `ADMIN_EMAIL` and `ADMIN_PASSWORD` instead. Set `CLIENT_URL` to the exact client site origin. Keep all secrets in provider dashboards, never in committed files.

## Project layout

- `client/src/components/` contains shared controls and navigation.
- `client/src/pages.jsx` contains the landing, explore, quiz, results, dashboard, leaderboard, auth, and admin screens.
- `client/src/services/api.js` handles API requests and browser-demo persistence.
- `server/src/models/` contains the Mongoose models.
- `server/src/routes/` contains the REST API routes.
- `server/src/seed.js` seeds the starter categories, quizzes, and preserved legacy question bank.

Registration creates a normal user account. The first administrator is provisioned from the private environment variables; admin authorization is checked on the server for every protected endpoint.
The app opens on login for signed-out visitors. Starting and submitting quizzes requires a verified account session. Google sign-in is available on login and registration: configure matching GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID values and authorize the frontend origin in Google Cloud. Theme preference persists across visits.
