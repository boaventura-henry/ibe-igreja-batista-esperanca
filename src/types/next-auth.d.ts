import type { DefaultSession } from "next-auth";
import type { AuthRole } from "@/types/auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AuthRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: AuthRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AuthRole;
  }
}
