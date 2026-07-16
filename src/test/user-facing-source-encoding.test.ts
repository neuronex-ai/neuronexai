import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = resolve(process.cwd());
const SOURCE_ROOTS = ["src", "supabase/functions", "public"];
const ROOT_SOURCE_FILES = ["index.html"];
const SOURCE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".mjs",
  ".ts",
  ".tsx",
  ".xml",
]);

// These production utilities intentionally contain malformed samples so they can
// repair legacy data. They never render those samples as copy for the user.
const INTENTIONAL_ENCODING_REMEDIATION = new Set([
  "src/lib/neurofinance-support.ts",
  "src/lib/portuguese-ui-text.ts",
  "src/lib/text-encoding.ts",
]);

const MOJIBAKE_SIGNATURES = [
  {
    name: "UTF-8 interpreted as Windows-1252",
    pattern:
      /\u00c3(?:[\u0080-\u00bf]|\u0192|\u201a|\u201e|\u2026|\u2020|\u2021|\u02c6|\u2030|\u0160|\u2039|\u0152|\u017d|\u2018|\u2019|\u201c|\u201d|\u2022|\u2013|\u2014|\u02dc|\u2122|\u0161|\u203a|\u0153|\u017e|\u0178)/gu,
  },
  { name: "stray UTF-8 continuation after C2", pattern: /\u00c2[\u0080-\u00bf]/gu },
  {
    name: "corrupted UTF-8 punctuation",
    pattern: /\u00e2(?:[\u0080-\u00bf]|\u201a|\u20ac|\u2122)/gu,
  },
  {
    name: "corrupted UTF-8 emoji",
    pattern: /\u00f0(?:[\u0080-\u00bf]|\u0178)/gu,
  },
  { name: "Unicode replacement character", pattern: /\ufffd/gu },
  {
    name: "Portuguese letter replaced by question mark",
    pattern:
      /\b(?:n\?o|poss\?vel|hor\?rio|sess\?o|cobran\?a|confirma\?\?o|solicita\?\?o)\b/giu,
  },
] as const;

type Finding = {
  file: string;
  line: number;
  column: number;
  signature: string;
  excerpt: string;
};

function normalizePath(path: string) {
  return path.replaceAll("\\", "/");
}

function isTestOrFixture(file: string) {
  const normalized = `/${normalizePath(file)}`;
  return (
    /\/(?:__tests__|fixtures?|snapshots?|tests?)\//u.test(normalized) ||
    /(?:^|[._-])(?:test|spec)\.[^.]+$/u.test(normalized) ||
    /_test\.[^.]+$/u.test(normalized) ||
    normalized.endsWith(".snap") ||
    normalized.endsWith("/deno.lock")
  );
}

function collectSourceFiles(path: string): string[] {
  const absolutePath = resolve(REPOSITORY_ROOT, path);
  if (!statSync(absolutePath).isDirectory()) return [absolutePath];

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(absolutePath, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relative(REPOSITORY_ROOT, child));
    return [child];
  });
}

function locate(content: string, index: number) {
  const preceding = content.slice(0, index);
  const lines = preceding.split("\n");
  return { line: lines.length, column: lines.at(-1)!.length + 1 };
}

function findMojibake(file: string): Finding[] {
  const content = readFileSync(file, "utf8");
  const repositoryPath = normalizePath(relative(REPOSITORY_ROOT, file));
  const findings: Finding[] = [];

  for (const { name, pattern } of MOJIBAKE_SIGNATURES) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const index = match.index ?? 0;
      const location = locate(content, index);
      const lineText = content.split("\n")[location.line - 1] ?? "";
      findings.push({
        file: repositoryPath,
        ...location,
        signature: name,
        excerpt: lineText.trim().slice(0, 180),
      });
    }
  }

  return findings;
}

describe("user-facing source encoding", () => {
  it("keeps malformed samples in tests, fixtures, and snapshots out of the scan", () => {
    expect(isTestOrFixture("src/features/__tests__/malformed-copy.ts")).toBe(true);
    expect(isTestOrFixture("src/features/fixtures/mojibake.json")).toBe(true);
    expect(isTestOrFixture("supabase/functions/tests/email/sample.ts")).toBe(true);
    expect(isTestOrFixture("src/features/copy.spec.ts")).toBe(true);
    expect(isTestOrFixture("src/features/copy.snap")).toBe(true);
    expect(isTestOrFixture("src/pages/PatientPortal.tsx")).toBe(false);
  });

  it("contains no mojibake outside explicit test fixtures and repair utilities", () => {
    const files = [
      ...SOURCE_ROOTS.flatMap(collectSourceFiles),
      ...ROOT_SOURCE_FILES.flatMap(collectSourceFiles),
    ].filter((file) => {
      const repositoryPath = normalizePath(relative(REPOSITORY_ROOT, file));
      return (
        SOURCE_EXTENSIONS.has(extname(file).toLowerCase()) &&
        !isTestOrFixture(repositoryPath) &&
        !INTENTIONAL_ENCODING_REMEDIATION.has(repositoryPath)
      );
    });

    const findings = files.flatMap(findMojibake);
    const report = findings
      .slice(0, 50)
      .map(
        ({ file, line, column, signature, excerpt }) =>
          `${file}:${line}:${column} [${signature}] ${excerpt}`,
      )
      .join("\n");

    expect(
      findings,
      findings.length > 0
        ? `Found ${findings.length} suspected encoding defect(s):\n${report}`
        : undefined,
    ).toEqual([]);
  });
});
