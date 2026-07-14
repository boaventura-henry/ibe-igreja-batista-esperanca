export type SongSummary = {
  id: string; title: string; artist: string | null; youtubeUrl: string | null; referenceKey: string | null;
  resourceUrl: string | null; simplifiedResourceUrl: string | null; notes: string | null; isActive: boolean;
  usageCount: number; lastUsedAt: string | null; lastPerformanceKey: string | null; createdAt: string; updatedAt: string;
};
export type SongFormValues = Omit<SongSummary, "id" | "usageCount" | "lastUsedAt" | "lastPerformanceKey" | "createdAt" | "updatedAt">;
export type SongListResult = { songs: SongSummary[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
