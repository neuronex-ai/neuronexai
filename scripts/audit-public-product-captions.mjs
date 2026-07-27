import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicMediaCaption } from "./lib/public-media-captions.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(
  scriptDirectory,
  "..",
  "src",
  "content",
  "public-product-media.generated.json",
);
const manifestPath = path.join(
  scriptDirectory,
  "..",
  "docs",
  "prints-desktop-manifest.csv",
);

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const [manifestHeader, ...manifestLines] = (await readFile(manifestPath, "utf8"))
  .replace(/^\uFEFF/u, "")
  .trim()
  .split(/\r?\n/u);
const manifestColumns = manifestHeader.split(";");
const manifestRows = manifestLines
  .map((line) => {
    const values = line.split(";");
    return Object.fromEntries(
      manifestColumns.map((column, index) => [column, values[index] ?? ""]),
    );
  })
  .filter((row) => row.tipo !== "duplicata");
const manifestByName = new Map(
  manifestRows.map((row) => [row.arquivo_novo, row]),
);
const images = Object.entries(catalog).flatMap(([moduleKey, themes]) =>
  Object.entries(themes).flatMap(([theme, themeImages]) =>
    themeImages.map((image) => ({ moduleKey, theme, ...image })),
  ),
);

const unaccentedPortuguese =
  /\b(?:acoes|analise|area|audio|automatica|avancados|calendario|camera|cartao|cartoes|clinica|clinicas|clinico|clinicos|cobranca|cobrancas|codigo|competencia|comunicacao|concluida|concluidas|conexoes|configuracao|consequencia|consequencias|criacao|declaracao|diagnostico|diario|documentacao|edicao|endereco|exclusao|exportacao|formulario|grafico|historico|horario|integracoes|inicio|lancamento|lancamentos|missoes|movimentacoes|navegacao|notificacoes|pendencias|politica|politicas|prontuario|proxima|proximo|publico|rapido|recorrencia|reflexao|relatorio|remarcacao|responsavel|revisao|saudacao|saude|seguranca|selecao|serie|sessao|sessoes|sintese|sugestoes|tendencia|terapeuticos|transcricao|tres|validas|visao|visualizacao)\b/iu;

const failures = [];

if (images.length !== manifestRows.length) {
  failures.push(
    `catálogo com ${images.length} imagens; manifesto com ${manifestRows.length} capturas únicas`,
  );
}

for (const image of images) {
  const expectedCaption = createPublicMediaCaption(image.name);
  const manifestRow = manifestByName.get(image.name);

  if (!image.caption?.trim()) failures.push(`${image.name}: legenda vazia`);
  if (!manifestRow) failures.push(`${image.name}: imagem ausente no manifesto`);
  if (manifestRow && image.alt !== manifestRow.descricao) {
    failures.push(`${image.name}: texto alternativo diverge da descrição detalhada`);
  }
  if (image.caption !== expectedCaption) {
    failures.push(`${image.name}: legenda fora da fonte semântica`);
  }
  if (image.caption === image.alt) {
    failures.push(`${image.name}: legenda não foi separada do texto alternativo`);
  }
  if (image.caption.length > 64) {
    failures.push(`${image.name}: legenda excede 64 caracteres (${image.caption.length})`);
  }
  if (unaccentedPortuguese.test(image.caption)) {
    failures.push(`${image.name}: possível palavra sem acento em “${image.caption}”`);
  }
  if (image.caption !== image.caption.normalize("NFC")) {
    failures.push(`${image.name}: legenda não está normalizada em Unicode NFC`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  const modules = Object.keys(catalog).length;
  const longestCaption = images.reduce((longest, image) =>
    image.caption.length > longest.caption.length ? image : longest,
  );

  console.log(
    `Legendas públicas auditadas: ${images.length} imagens em ${modules} módulos.`,
  );
  console.log(
    `Maior legenda: ${longestCaption.caption.length}/64 caracteres — ${longestCaption.caption}`,
  );
}
