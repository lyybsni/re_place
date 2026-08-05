import { ApiError } from "@/lib/server/api-error";

function readValue(name: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function requireEnv(name: string) {
  const value = readValue(name);
  if (!value) {
    throw new ApiError(500, `Missing required environment variable: ${name}`);
  }
  return value;
}

export function readEnv(name: string) {
  return readValue(name);
}
