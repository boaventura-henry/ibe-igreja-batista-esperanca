export type AuthRole = "ADMIN" | "LEADER" | "TREASURER";

export type AuthSessionUser = {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
};
