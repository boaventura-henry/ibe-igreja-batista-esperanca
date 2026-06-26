import { userRepository } from "@/repositories";
import type { AuthSessionUser } from "@/types";
import { verifyPassword } from "@/utils";
import { loginSchema, type LoginInput } from "@/validators";

export const authService = {
  async validateCredentials(input: unknown): Promise<AuthSessionUser | null> {
    const parsed = loginSchema.safeParse(input);

    if (!parsed.success) {
      return null;
    }

    return this.login(parsed.data);
  },

  async login(input: LoginInput): Promise<AuthSessionUser | null> {
    const user = await userRepository.findByEmailWithPassword(input.email);

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return null;
    }

    const isValidPassword = await verifyPassword(input.password, user.passwordHash);

    if (!isValidPassword) {
      await userRepository.registerFailedLogin(user.id);

      return null;
    }

    await userRepository.registerSuccessfulLogin(user.id);

    return {
      id: user.id,
      name: user.name,
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
