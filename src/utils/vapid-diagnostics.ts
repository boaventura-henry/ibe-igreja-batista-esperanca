export type VapidPublicKeyDiagnostics = {
  publicKeyExists: boolean;
  publicKeyLength: number;
  publicKeyFormatValid: boolean;
  publicKeyStartsWithB: boolean;
  publicKeyLooksLikeUrl: boolean;
  publicKeyContainsWhitespace: boolean;
  publicKeyContainsQuotes: boolean;
};

export type VapidPrivateKeyDiagnostics = {
  privateKeyExists: boolean;
  privateKeyLength: number;
  privateKeyFormatValid: boolean;
};

export type VapidSubjectDiagnostics = {
  subjectExists: boolean;
  subjectFormatValid: boolean;
};

const base64UrlPattern = /^[A-Za-z0-9_-]+={0,2}$/;

function normalize(value: string | undefined) {
  return value?.trim() ?? "";
}

function base64UrlToBytes(value: string) {
  const trimmed = normalize(value);
  if (!trimmed || trimmed.length % 4 === 1 || !base64UrlPattern.test(trimmed)) return null;
  const padding = "=".repeat((4 - (trimmed.length % 4)) % 4);
  const base64 = `${trimmed}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = globalThis.atob(base64);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function diagnoseVapidPublicKey(value: string | undefined): VapidPublicKeyDiagnostics {
  const trimmed = normalize(value);
  const bytes = base64UrlToBytes(trimmed);
  const publicKeyLooksLikeUrl = /^https?:\/\//i.test(trimmed);
  const publicKeyContainsWhitespace = /\s/.test(trimmed);
  const publicKeyContainsQuotes = /['"]/.test(trimmed);
  const publicKeyFormatValid = Boolean(
    trimmed &&
    !publicKeyLooksLikeUrl &&
    !publicKeyContainsWhitespace &&
    !publicKeyContainsQuotes &&
    base64UrlPattern.test(trimmed) &&
    [87, 88].includes(trimmed.length) &&
    bytes?.length === 65 &&
    bytes[0] === 0x04
  );

  return {
    publicKeyExists: Boolean(trimmed),
    publicKeyLength: trimmed.length,
    publicKeyFormatValid,
    publicKeyStartsWithB: trimmed.startsWith("B"),
    publicKeyLooksLikeUrl,
    publicKeyContainsWhitespace,
    publicKeyContainsQuotes
  };
}

export function diagnoseVapidPrivateKey(value: string | undefined): VapidPrivateKeyDiagnostics {
  const trimmed = normalize(value);
  const bytes = base64UrlToBytes(trimmed);
  return {
    privateKeyExists: Boolean(trimmed),
    privateKeyLength: trimmed.length,
    privateKeyFormatValid: Boolean(trimmed && !/\s/.test(trimmed) && !/['"]/.test(trimmed) && !/^https?:\/\//i.test(trimmed) && base64UrlPattern.test(trimmed) && [43, 44].includes(trimmed.length) && bytes?.length === 32)
  };
}

export function diagnoseVapidSubject(value: string | undefined): VapidSubjectDiagnostics {
  const trimmed = normalize(value);
  if (!trimmed) return { subjectExists: false, subjectFormatValid: false };
  try {
    if (trimmed.startsWith("mailto:")) return { subjectExists: true, subjectFormatValid: trimmed.length > "mailto:".length };
    const url = new URL(trimmed);
    return { subjectExists: true, subjectFormatValid: ["http:", "https:"].includes(url.protocol) };
  } catch {
    return { subjectExists: true, subjectFormatValid: false };
  }
}