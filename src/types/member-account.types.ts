export type MemberAccountData = {
  id: string;
  name: string;
  username: string;
  maskedLogin: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  accessRole: {
    id: string;
    name: string;
  } | null;
  member: {
    id: string;
    name: string;
    cpf: string | null;
    email: string | null;
    phone: string | null;
    mobilePhone: string | null;
    whatsapp: string | null;
  } | null;
};

export type MemberAccountUpdateInput = {
  phone?: string | null;
  email?: string | null;
};

export type MemberAccountChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};
