import { userRepository } from "@/repositories";
import type { AuthSessionUser } from "@/types";
import { verifyPassword } from "@/utils";
import { loginSchema, type LoginInput } from "@/validators";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

export const authService = {
  async validateCredentials(input: unknown): Promise<AuthSessionUser | null> {
    const parsed = loginSchema.safeParse(input);

    if (!parsed.success) {
      return null;
    }

    return this.login(parsed.data);
  },

  async login(input: LoginInput): Promise<AuthSessionUser | null> {
    const user = await userRepository.findByLoginIdentifierWithPassword(input.username);

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return null;
    }

    if (user.accessRoleId && (!user.accessRole || !user.accessRole.isActive || user.accessRole.deletedAt)) {
      return null;
    }

    const isValidPassword = await verifyPassword(input.password, user.passwordHash);

    if (!isValidPassword) {
      const failedLogin = await userRepository.registerFailedLogin(user.id);

      if (failedLogin.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        await userRepository.lock(user.id, new Date(Date.now() + LOGIN_LOCK_DURATION_MS));
      }

      return null;
    }

    await userRepository.registerSuccessfulLogin(user.id);

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      memberId: user.memberId,
      accessRoleId: user.accessRoleId,
      mustChangePassword: user.mustChangePassword,
      permissions: user.accessRole?.permissions ?? [],
      permissionCodes: user.accessRole?.permissions.map((permission) => permission.code) ?? []
    };
  }
};
