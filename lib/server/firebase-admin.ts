import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ApiError } from "@/lib/server/api-error";
import { readEnv, requireEnv } from "@/lib/server/env";

function decodePrivateKey(input: string) {
  return input.replace(/\\n/g, "\n");
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const storageBucket = requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  const clientEmail = readEnv("NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL");
  const privateKey = readEnv("NEXT_PUBLIC_FIREBASE_PRIVATE_KEY");
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
  return getFirestore(initializeFirebaseAdmin());
}

export function storageBucket() {
  return getStorage(initializeFirebaseAdmin()).bucket(requireEnv("FIREBASE_STORAGE_BUCKET"));
}
