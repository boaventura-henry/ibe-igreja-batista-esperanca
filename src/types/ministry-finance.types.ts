export type FinancialAccessContext = Readonly<{
  allMinistries: boolean;
  authorizedMinistryIds: readonly string[];
}>;

export type FinancialAuthorization = Readonly<{
  userId: string;
  accessContext: FinancialAccessContext;
}>;

export type MinistryFinancialAccessResult = {
  user: { id: string; name: string };
  ministries: Array<{ id: string; name: string; isActive: boolean; selected: boolean }>;
};
