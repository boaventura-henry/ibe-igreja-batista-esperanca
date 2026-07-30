import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuthorizationResult =
  | { authorized: true }
  | {
      authorized: false;
      status: 401 | 503;
      code: "CRON_UNAUTHORIZED" | "CRON_SECRET_NOT_CONFIGURED";
      message: string;
    };

function secureEquals(received: string, expected: string) {
  const receivedBuffer = createHash("sha256").update(received, "utf8").digest();
  const expectedBuffer = createHash("sha256").update(expected, "utf8").digest();

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function authorizeCronRequest(
  request: Request,
  configuredSecret = process.env.CRON_SECRET
): CronAuthorizationResult {
  const expectedSecret = configuredSecret?.trim();
  if (!expectedSecret) {
    return {
      authorized: false,
      status: 503,
      code: "CRON_SECRET_NOT_CONFIGURED",
      message: "O processamento automatico nao esta configurado."
    };
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  if (!match || !secureEquals(match[1], expectedSecret)) {
    return {
      authorized: false,
      status: 401,
      code: "CRON_UNAUTHORIZED",
      message: "Chamada automatizada nao autorizada."
    };
  }

  return { authorized: true };
}
