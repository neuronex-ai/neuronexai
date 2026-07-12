const WINDOWS_1252_CODE_POINT_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

const MOJIBAKE_MARKER = /(?:Ã[\u0080-\u00bf]|Â[\u0080-\u00bf]|â[€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]|ðŸ)/g;

const markerCount = (value: string) => value.match(MOJIBAKE_MARKER)?.length ?? 0;

const toLegacyBytes = (value: string) => {
  const bytes: number[] = [];

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    const byte = WINDOWS_1252_CODE_POINT_TO_BYTE[codePoint] ?? codePoint;
    if (byte > 0xff) return null;
    bytes.push(byte);
  }

  return new Uint8Array(bytes);
};

/**
 * Repairs UTF-8 text that was previously decoded as Windows-1252/Latin-1.
 * Correct Portuguese text is left untouched because conversion only runs when
 * characteristic mojibake byte pairs are present and the marker score falls.
 */
export const repairMojibake = (value: string) => {
  let current = value;

  for (let pass = 0; pass < 2; pass += 1) {
    const before = markerCount(current);
    if (before === 0) break;

    const bytes = toLegacyBytes(current);
    if (!bytes) break;

    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (markerCount(decoded) >= before) break;
      current = decoded;
    } catch {
      break;
    }
  }

  return current;
};

export const repairTextEncodingDeep = <T>(value: T): T => {
  if (typeof value === "string") return repairMojibake(value) as T;
  if (Array.isArray(value)) return value.map(repairTextEncodingDeep) as T;
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      repairTextEncodingDeep(item),
    ]),
  ) as T;
};
