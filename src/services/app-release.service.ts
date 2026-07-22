import { appReleases, type AppRelease } from "@/config/app-releases";
import { AppError } from "@/lib/errors";
import { compareSemanticVersions, isSemanticVersion } from "@/lib/semantic-version";
import { userRepository } from "@/repositories/user.repository";

export type PublicAppRelease = Omit<AppRelease, "technicalNotes">;

function validateReleaseCatalog(releases: readonly AppRelease[]) {
  const versions = new Set<string>();
  for (const release of releases) {
    if (!isSemanticVersion(release.version) || versions.has(release.version)) throw new Error("Catalogo de releases invalido.");
    if (release.status === "PUBLISHED" && !release.releaseDate) throw new Error("Release publicada sem data real.");
    if (release.status === "UNRELEASED" && release.releaseDate) throw new Error("Release nao publicada nao pode possuir data.");
    if (release.title.length > 120 || release.summary.length > 500 || release.highlights.length > 12 || release.highlights.some((item) => item.length > 160 || /<[^>]+>/.test(item))) throw new Error("Conteudo de release fora dos limites seguros.");
    versions.add(release.version);
  }
}

validateReleaseCatalog(appReleases);

export function getPublishedReleases(releases: readonly AppRelease[] = appReleases): PublicAppRelease[] {
  return releases
    .filter((release) => release.status === "PUBLISHED")
    .sort((left, right) => compareSemanticVersions(right.version, left.version))
    .map((release) => ({ version: release.version, title: release.title, summary: release.summary, type: release.type, status: release.status, releaseDate: release.releaseDate, highlights: release.highlights }));
}

export function getLatestPublishedRelease(releases: readonly AppRelease[] = appReleases) {
  return getPublishedReleases(releases)[0] ?? null;
}

export function getPendingPublishedRelease(lastSeenAppVersion: string | null, releases: readonly AppRelease[] = appReleases) {
  const latest = getLatestPublishedRelease(releases);
  if (!latest) return null;
  if (!lastSeenAppVersion || !isSemanticVersion(lastSeenAppVersion)) return latest;
  return compareSemanticVersions(latest.version, lastSeenAppVersion) > 0 ? latest : null;
}

export async function markPublishedReleaseAsSeen(input: { userId: string; version: string }, options?: { releases?: readonly AppRelease[]; update?: (value: { userId: string; version: string }) => PromiseLike<{ id: string; lastSeenAppVersion: string | null }> }) {
  if (!isSemanticVersion(input.version)) throw new AppError("Versao invalida.", 400, "INVALID_VERSION");
  const release = (options?.releases ?? appReleases).find((item) => item.version === input.version);
  if (!release) throw new AppError("Versao nao encontrada.", 404, "RELEASE_NOT_FOUND");
  if (release.status !== "PUBLISHED") throw new AppError("Esta versao ainda nao foi publicada.", 409, "RELEASE_NOT_PUBLISHED");
  const update = options?.update ?? userRepository.updateLastSeenAppVersion.bind(userRepository);
  await update({ userId: input.userId, version: release.version });
  return { version: release.version };
}

export const appReleaseService = {
  getLatestPublishedRelease,
  getPublishedReleases,
  async getPendingReleaseForUser(userId: string) {
    if (!getLatestPublishedRelease()) return null;
    const preference = await userRepository.findReleasePreference(userId);
    if (!preference) throw new AppError("Usuario nao encontrado.", 404, "USER_NOT_FOUND");
    return getPendingPublishedRelease(preference.lastSeenAppVersion);
  },
  markReleaseAsSeen: markPublishedReleaseAsSeen
};
