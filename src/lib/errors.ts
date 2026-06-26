export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
    readonly code = "APP_ERROR"
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError("Unexpected application error", 500, "INTERNAL_ERROR");
}
