import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof Error) {
    return new ApiError(500, error.message);
  }
  return new ApiError(500, "Unknown server error.");
}

export function errorResponse(error: unknown) {
  const apiError = toApiError(error);
  if (error instanceof Error) {
    console.error("[API ERROR]", {
      status: apiError.status,
      code: apiError.code,
      message: apiError.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
    });
  } else {
    console.error("[API ERROR]", {
      status: apiError.status,
      code: apiError.code,
      message: apiError.message,
      error,
    });
  }
  return NextResponse.json(
    {
      message: apiError.message,
      code: apiError.code,
    },
    { status: apiError.status },
  );
}
