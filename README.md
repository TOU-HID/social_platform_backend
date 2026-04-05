# Social Platform Backend

Backend API for the Social Platform assignment.

## Tech Stack

- Node.js
- Express
- TypeScript
- MongoDB + Mongoose
- JWT auth (access + refresh)

## Prerequisites

- Node.js 18+ (recommended: Node 20 LTS)
- npm 9+
- MongoDB (local or cloud)

## Environment Setup

1. Copy env file:

```bash
cp .env.example .env
```

2. Update `.env` values:

```dotenv
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/social_platform
CLIENT_ORIGIN=http://localhost:5173
ACCESS_TOKEN_SECRET=change_me_access
REFRESH_TOKEN_SECRET=change_me_refresh
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
USE_CLOUDINARY=false
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=social-platform/posts
```

> If you use Cloudinary uploads, set `USE_CLOUDINARY=true` and provide Cloudinary credentials.

## Install Dependencies

```bash
npm install
```

## Run the Project

Start in development mode (auto-reload):

```bash
npm run dev
```

Default local URL:

```text
http://localhost:5050
```

## Build and Start (Production Mode)

Build TypeScript:

```bash
npm run build
```

Run compiled app:

```bash
npm start
```

## Common Commands

- `npm run dev` → Run with watch mode (`tsx`)
- `npm run build` → Compile TypeScript into `dist/`
- `npm start` → Start compiled server from `dist/server.js`

## API Base Path

All routes are served under:

```text
/api/v1
```

## Notes

- CORS is configured using `CLIENT_ORIGIN`.
- Frontend uses cookies (`credentials: include`) for refresh token flow.
- Ensure `CLIENT_ORIGIN` exactly matches frontend URL in local/prod.
