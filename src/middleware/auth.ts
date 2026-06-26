import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET;
}

export async function getAuthSession(request: NextRequest) {
  return getToken({
    req: request,
    secret: getAuthSecret()
  });
}
