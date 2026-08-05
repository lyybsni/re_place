import { randomUUID } from "node:crypto";
import type { File } from "@google-cloud/storage";
import { ApiError } from "@/lib/server/api-error";
import { storageBucket } from "@/lib/server/firebase-admin";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

type ParsedDataUrl = {
  mimeType: string;
  buffer: Buffer;
};

function parseImageDataUrl(value: string): ParsedDataUrl {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new ApiError(400, "Each image must be a base64 data URL.");
  }

  const mimeType = match[1].toLowerCase();
  const extension = ALLOWED_MIME_TO_EXTENSION[mimeType];
  if (!extension) {
    throw new ApiError(400, `Unsupported image type: ${mimeType}`);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    throw new ApiError(400, "Invalid base64 image payload.");
  }

  if (buffer.length <= 0) {
    throw new ApiError(400, "Image payload is empty.");
  }
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new ApiError(400, `Each image must be <= ${MAX_IMAGE_SIZE_BYTES} bytes.`);
  }

  return { mimeType, buffer };
}

async function uploadSingleImage(
  userId: string,
  articleId: string,
  index: number,
  dataUrl: string,
) {
  const { mimeType, buffer } = parseImageDataUrl(dataUrl);
  const extension = ALLOWED_MIME_TO_EXTENSION[mimeType];
  const token = randomUUID();
  const objectPath = `users/${userId}/articles/${articleId}/${index + 1}-${token}.${extension}`;
  const file = storageBucket().file(objectPath);

  await file.save(buffer, {
    contentType: mimeType,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000",
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const encodedPath = encodeURIComponent(objectPath);
  const bucketName = storageBucket().name;
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

  return {
    path: objectPath,
    url,
    mimeType,
    sizeBytes: buffer.length,
  };
}

export async function uploadArticleImages(
  userId: string,
  articleId: string,
  images: string[],
) {
  const uploaded = [];
  for (let i = 0; i < images.length; i += 1) {
    uploaded.push(await uploadSingleImage(userId, articleId, i, images[i]));
  }
  return uploaded;
}

export async function deleteStorageObjects(objectPaths: string[]) {
  if (!objectPaths.length) {
    return;
  }

  const files: File[] = objectPaths.map((path) => storageBucket().file(path));
  await Promise.all(
    files.map(async (file) => {
      try {
        await file.delete({ ignoreNotFound: true });
      } catch (error) {
        console.error("Failed to cleanup storage object:", file.name, error);
      }
    }),
  );
}
