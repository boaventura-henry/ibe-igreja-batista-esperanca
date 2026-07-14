export type ScheduleSongSummary = {
  id: string; position: number; referenceKey: string | null; performanceKey: string | null; useSimplifiedVersion: boolean;
  youtubeUrlOverride: string | null; resourceUrlOverride: string | null; notes: string | null;
  song: { id: string; title: string; artist: string | null; youtubeUrl: string | null; referenceKey: string | null; resourceUrl: string | null; simplifiedResourceUrl: string | null; isActive: boolean; deletedAt: string | null };
  leadMember: { id: string; name: string; status: string } | null; createdAt: string; updatedAt: string;
};
export type ScheduleSongFormValues = { songId: string; position: number; referenceKey?: string; performanceKey?: string; leadMemberId?: string; youtubeUrlOverride?: string; resourceUrlOverride?: string; useSimplifiedVersion: boolean; notes?: string };
export type ScheduleRepertoireResult = { songs: ScheduleSongSummary[]; members: Array<{ id: string; name: string; status: string }>; sources: Array<{ id: string; title: string; date: string; songCount: number }> };
