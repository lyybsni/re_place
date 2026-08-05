This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Backend Environment Variables

Create `.env.local` with:

```bash
# Firebase Auth REST API (for login/session endpoints)
FIREBASE_API_KEY=your_firebase_web_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_web_client_id

# Firebase Admin SDK (for Firestore/Storage-backed BFF)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

If you prefer ADC credentials, set `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/service-account.json` and keep `FIREBASE_PROJECT_ID` + `FIREBASE_STORAGE_BUCKET`.

## Backend Coverage

The BFF now uses Firebase for:

- Authentication: `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/auth/session`
- Firestore data: `/api/articles`, `/api/admin/ai-options`, `/api/recommendations/today`, `/api/idealization/today`, `/api/places/digest`
- Storage upload: article images are received as base64 data URLs and written to Firebase Storage during `POST /api/articles`.

## Network / Proxy Note

If you use VPN or a local proxy, make sure the Node.js process can reach Google APIs. Example:

```bash
export NODE_USE_ENV_PROXY=1
export HTTPS_PROXY=http://127.0.0.1:7890
export HTTP_PROXY=http://127.0.0.1:7890
```

Then restart `npm run dev`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
