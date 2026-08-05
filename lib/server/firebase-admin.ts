import { getApps, initializeApp, cert } from "firebase-admin/app";
import { initializeFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ApiError } from "@/lib/server/api-error";
import { readEnv, requireEnv } from "@/lib/server/env";

function decodePrivateKey(input: string) {
  return input.replace(/\\n/g, "\n");
}

let firestoreInstance: Firestore | null = null;

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId =
    readEnv("FIREBASE_PROJECT_ID") ?? requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const storageBucket =
    readEnv("FIREBASE_STORAGE_BUCKET") ?? requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  const clientEmail =
    readEnv("FIREBASE_CLIENT_EMAIL") ?? readEnv("NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL");
  const privateKey =
    readEnv("FIREBASE_PRIVATE_KEY") ?? readEnv("NEXT_PUBLIC_FIREBASE_PRIVATE_KEY");
  const credentialsPath = readEnv("GOOGLE_APPLICATION_CREDENTIALS");

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: decodePrivateKey(privateKey),
      }),
      projectId,
      storageBucket,
    });
  }

  if (!credentialsPath) {
    throw new ApiError(
      500,
      "Firebase admin credentials are not configured. Set FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS.",
    );
  }

  return initializeApp({
    projectId,
    storageBucket,
  });
}

export function db() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  const app = initializeFirebaseAdmin();
  const databaseId = readEnv("NEXT_PUBLIC_FIRESTORE_DATABASE_ID") ?? "default";

  firestoreInstance = initializeFirestore(
    app,
    {
      preferRest: true,
    },
    databaseId,
  );

  return firestoreInstance;
}

export function storageBucket() {
  const bucketName =
    readEnv("FIREBASE_STORAGE_BUCKET") ?? requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  return getStorage(initializeFirebaseAdmin()).bucket(bucketName);
}
