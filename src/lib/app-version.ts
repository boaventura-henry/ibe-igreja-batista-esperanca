import packageJson from "../../package.json";
import { isSemanticVersion } from "@/lib/semantic-version";

if (!isSemanticVersion(packageJson.version)) {
  throw new Error("A versao do package.json deve seguir SemVer.");
}

export const APP_VERSION = packageJson.version;
export const APP_RELEASE_NAME = "Evolucoes operacionais planejadas";

export type AppVersionInfo = {
  version: string;
  releaseName: string;
  environment: "production" | "preview" | "development";
  commitHash: string | null;
};

export function shortCommitHash(value: string | undefined) {
  return value && /^[0-9a-f]{7,40}$/i.test(value) ? value.slice(0, 7).toLowerCase() : null;
}

export function getAppVersionInfo(): AppVersionInfo {
  const environment = ["production", "preview", "development"].includes(process.env.VERCEL_ENV ?? "")
    ? (process.env.VERCEL_ENV as AppVersionInfo["environment"])
    : "development";

  return {
    version: APP_VERSION,
    releaseName: APP_RELEASE_NAME,
    environment,
    commitHash: shortCommitHash(process.env.VERCEL_GIT_COMMIT_SHA)
  };
}
