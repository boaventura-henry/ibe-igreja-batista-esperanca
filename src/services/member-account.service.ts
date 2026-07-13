import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { memberAccountRepository, type MemberAccountRecord } from "@/repositories";
import type { MemberAccountData } from "@/types";
import { hashPassword, onlyDigits, verifyPassword } from "@/utils";
import type { MemberAccountChangePasswordInput, MemberAccountUpdateInput } from "@/validators";

type SessionUser = {
  id: string;
  memberId?: string | null;
  mustChangePassword?: boolean;
};

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function maskLogin(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.***.***-${digits.slice(-2)}`;
  }

  if (digits.length === 10) {
    return `(**) ****-${digits.slice(-4)}`;
  }

  return value.length > 4 ? `${value.slice(0, 2)}***${value.slice(-2)}` : value;
}

function isPhoneLike(value: string) {
  return /^\d{10,11}$/.test(value);
}

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function serializeAccount(user: MemberAccountRecord): MemberAccountData {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    maskedLogin: maskLogin(user.username),
    email: user.member?.email ?? null,
    phone: user.member?.mobilePhone ?? user.member?.phone ?? user.member?.whatsapp ?? null,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: serializeDate(user.lastLoginAt),
    accessRole: user.accessRole,
    member: user.member
  };
}

export const memberAccountService = {
  async getAccount(user: SessionUser) {
    const account = await memberAccountRepository.findByUserId(user.id);

    if (!account) {
      throw new AppError("Usuario nao encontrado.", 404, "USER_NOT_FOUND");
    }

    return serializeAccount(account);
  },

  async updateAccount(user: SessionUser, data: MemberAccountUpdateInput) {
    const account = await memberAccountRepository.findByUserId(user.id);

    if (!account) {
      throw new AppError("Usuario nao encontrado.", 404, "USER_NOT_FOUND");
    }

    if (!account.isActive) {
      throw new AppError("Usuario inativo nao pode alterar dados da conta.", 403, "USER_INACTIVE");
    }

    const normalizedPhone = typeof data.phone === "string" ? onlyDigits(data.phone) : data.phone;
    const normalizedEmail = typeof data.email === "string" ? data.email.trim().toLowerCase() : data.email;

    if (normalizedPhone && (normalizedPhone.length < 10 || normalizedPhone.length > 11)) {
      throw new AppError("Informe um telefone valido.", 400, "INVALID_PHONE");
    }

    if (normalizedPhone) {
      const conflicts = await memberAccountRepository.countPhoneMatches(normalizedPhone, account.id);

      if (conflicts > 0) {
        throw new AppError("Este telefone ja esta vinculado a outro usuario.", 409, "PHONE_ALREADY_LINKED");
      }
    }

    if (normalizedEmail) {
      const conflict = await memberAccountRepository.findEmailConflict(normalizedEmail, account.id, account.member?.id);

      if (conflict) {
        throw new AppError("Este e-mail ja esta vinculado a outro cadastro.", 409, "EMAIL_ALREADY_LINKED");
      }
    }

    const oldPhoneValues = [account.member?.phone, account.member?.mobilePhone, account.member?.whatsapp].filter(Boolean);
    const shouldUpdateUsername = Boolean(normalizedPhone && (isPhoneLike(account.username) || oldPhoneValues.includes(account.username)));

    if (normalizedPhone === null && (isPhoneLike(account.username) || oldPhoneValues.includes(account.username))) {
      throw new AppError("Informe um telefone valido para manter seu acesso.", 400, "PHONE_REQUIRED_FOR_LOGIN");
    }

    const memberPhones =
      normalizedPhone === undefined
        ? undefined
        : {
            phone: account.member?.phone === account.username ? normalizedPhone : undefined,
            mobilePhone: normalizedPhone,
            whatsapp: account.member?.whatsapp === account.username ? normalizedPhone : undefined
          };

    try {
      return serializeAccount(
        await memberAccountRepository.updateAccount(account.id, account.member?.id, {
          phone: normalizedPhone,
          email: normalizedEmail,
          username: shouldUpdateUsername ? normalizedPhone ?? undefined : undefined,
          memberPhones
        })
      );
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AppError("Este telefone ou e-mail ja esta vinculado a outro cadastro.", 409, "ACCOUNT_UNIQUE_CONFLICT");
      }

      throw error;
    }
  },

  async changePassword(user: SessionUser, data: MemberAccountChangePasswordInput) {
    if (user.mustChangePassword) {
      throw new AppError("Use a tela de troca obrigatoria de senha para concluir o acesso.", 409, "PASSWORD_CHANGE_REQUIRED");
    }

    const account = await memberAccountRepository.findByUserIdWithPassword(user.id);

    if (!account) {
      throw new AppError("Usuario nao encontrado.", 404, "USER_NOT_FOUND");
    }

    if (!account.isActive) {
      throw new AppError("Usuario inativo nao pode alterar senha.", 403, "USER_INACTIVE");
    }

    const isCurrentPasswordValid = await verifyPassword(data.currentPassword, account.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new AppError("A senha atual informada esta incorreta.", 400, "INVALID_CURRENT_PASSWORD");
    }

    const passwordHash = await hashPassword(data.newPassword);

    return serializeAccount(await memberAccountRepository.changePassword(account.id, passwordHash));
  }
};

