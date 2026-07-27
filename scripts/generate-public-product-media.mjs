import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicMediaCaption } from "./lib/public-media-captions.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(repositoryRoot, "docs", "prints-desktop-manifest.csv");
const outputPath = path.join(
  repositoryRoot,
  "src",
  "content",
  "public-product-media.generated.json",
);

const moduleOrder = [
  "dashboard",
  "agenda",
  "teleconsulta",
  "pacientes",
  "prontuario",
  "neurodrive",
  "neuroview",
  "neuroflow",
  "neuropulse",
  "gestao-financeira",
  "neurofinance",
  "neuroid",
  "ajustes",
  "busca-global",
  "portal-paciente",
  "synapse",
];

const typePriority = new Map([
  ["pagina", 0],
  ["painel", 1],
  ["estado", 2],
  ["drawer", 3],
  ["modal", 4],
  ["popover", 5],
]);

function parseManifest(source) {
  const [headerLine, ...dataLines] = source.replace(/^\uFEFF/u, "").trim().split(/\r?\n/u);
  const headers = headerLine.split(";");

  return dataLines.map((line) => {
    const values = line.split(";");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function getModuleKey(row) {
  if (row.pasta.includes("1. DASHBOARD")) return "dashboard";
  if (row.pasta.includes("2. AGENDA")) return "agenda";
  if (row.pasta.includes("TELECONSULTA")) return "teleconsulta";
  if (row.pasta.includes("4. PACIENTES")) return "pacientes";
  if (row.pasta.includes("5. PRONTU")) return "prontuario";
  if (row.pasta.includes("6. NEURODRIVE")) {
    if (row.arquivo_novo.startsWith("neuroview--")) return "neuroview";
    if (row.arquivo_novo.startsWith("neuroflow--")) return "neuroflow";
    if (row.arquivo_novo.startsWith("neuropulse--")) return "neuropulse";
    return "neurodrive";
  }
  if (row.pasta.includes("7. GEST")) return "gestao-financeira";
  if (row.pasta.includes("8. NEUROFINANCE")) return "neurofinance";
  if (row.pasta.includes("9. NEUROID")) return "neuroid";
  if (row.pasta.includes("10. AJUSTES")) return "ajustes";
  if (row.pasta.includes("11. ABA DE BUSCA")) return "busca-global";
  if (row.pasta.includes("12. PORTAL PACIENTES")) return "portal-paciente";
  if (row.pasta.includes("13. SYNAPSE AI")) return "synapse";
  throw new Error(`Pasta sem modulo publico: ${row.pasta}`);
}

function getEffectiveTheme(row) {
  if (row.tema === "claro") return "light";
  if (row.tema === "escuro") return "dark";
  return row.pasta.startsWith("CLARO") ? "light" : "dark";
}

function createEmptyCatalog() {
  return Object.fromEntries(
    moduleOrder.map((moduleKey) => [moduleKey, { light: [], dark: [] }]),
  );
}

const manifestSource = await readFile(manifestPath, "utf8");
const rows = parseManifest(manifestSource).filter((row) => row.tipo !== "duplicata");
const catalog = createEmptyCatalog();

for (const [sourceIndex, row] of rows.entries()) {
  const moduleKey = getModuleKey(row);
  const theme = getEffectiveTheme(row);
  const relativePath = `${row.pasta}/${row.arquivo_novo}`.replaceAll("\\", "/");

  catalog[moduleKey][theme].push({
    src: `/images/prints-sistema/DESKTOP/${relativePath}`,
    alt: row.descricao,
    caption: createPublicMediaCaption(row.arquivo_novo),
    name: row.arquivo_novo,
    kind: row.tipo,
    sourceIndex,
  });
}

for (const moduleEntry of Object.values(catalog)) {
  for (const theme of ["light", "dark"]) {
    moduleEntry[theme].sort((left, right) => {
      const priorityDifference =
        (typePriority.get(left.kind) ?? 99) - (typePriority.get(right.kind) ?? 99);
      return priorityDifference || left.sourceIndex - right.sourceIndex;
    });
    moduleEntry[theme] = moduleEntry[theme].map(({ sourceIndex: _sourceIndex, ...item }) => item);
  }
}

await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

const imageCount = Object.values(catalog).reduce(
  (total, entry) => total + entry.light.length + entry.dark.length,
  0,
);

console.log(`Catalogo publico gerado com ${imageCount} capturas unicas em ${outputPath}`);
