import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authService } from "@/services";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login"
  },
  session: {
    strategy: "jwt"
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Telefone ou CPF", type: "text" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        return authService.validateCredentials(credentials);
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.memberId = user.memberId;
        token.accessRoleId = user.accessRoleId;
        token.mustChangePassword = user.mustChangePassword;
        token.permissions = user.permissions;
        token.permissionCodes = user.permissionCodes;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
        session.user.memberId = token.memberId;
        session.user.accessRoleId = token.accessRoleId;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
        session.user.permissions = token.permissions ?? [];
        session.user.permissionCodes = token.permissionCodes ?? [];
      }

      return session;
    }
  }
};
