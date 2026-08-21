export type InstrumentUsageHistoryItem = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  changeReason: string | null;
  member: {
    id: string;
    name: string;
    displayName: string;
  };
  category: {
    id: string;
    name: string;
  };
  scheduleMember: {
    id: string;
    status: string;
  };
  schedule: {
    id: string;
    title: string;
    date: string;
    deletedAt: string | null;
  };
};

export type InstrumentUsageHistoryResult = {
  items: InstrumentUsageHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
