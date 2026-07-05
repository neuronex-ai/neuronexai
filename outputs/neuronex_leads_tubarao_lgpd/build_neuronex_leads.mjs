import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/Administrator/dyad-apps/neurobackupofc/outputs/neuronex_leads_tubarao_lgpd";
const workbook = Workbook.create();

const rows = 1001;
const leadRange = `'Leads'!$A$2:$A$${rows}`;
const maxRowsNote = "Reservado para ate 1000 leads. Preencha apenas contatos institucionais/publicados ou opt-in.";

const colors = {
  navy: "#17324D",
  blue: "#2F80ED",
  mint: "#DDF4E7",
  paleBlue: "#EAF3FF",
  paleYellow: "#FFF6D6",
  paleRed: "#FCE7E7",
  paleGray: "#F5F7FA",
  gray: "#E1E7EF",
  darkGray: "#334155",
  white: "#FFFFFF",
  green: "#16A34A",
  orange: "#F59E0B",
  red: "#DC2626",
};

function styleTitle(range) {
  range.format = {
    fill: colors.navy,
    font: { bold: true, color: colors.white, size: 16 },
    horizontalAlignment: "left",
    verticalAlignment: "middle",
  };
}

function styleHeader(range, fill = colors.navy) {
  range.format = {
    fill,
    font: { bold: true, color: colors.white },
    horizontalAlignment: "center",
    verticalAlignment: "middle",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: colors.gray },
  };
}

function styleSection(range, fill = colors.paleBlue) {
  range.format = {
    fill,
    font: { bold: true, color: colors.darkGray },
    horizontalAlignment: "left",
    verticalAlignment: "middle",
  };
}

function addLegend(sheet) {
  sheet.getRange("A2:G2").values = [["Legenda", "Entrada manual", "Calculado", "Bloqueio", "Permitido", "Cautela", "Nao usar"]];
  sheet.getRange("A2").format = { font: { bold: true, color: colors.darkGray } };
  sheet.getRange("B2").format.fill = colors.paleYellow;
  sheet.getRange("C2").format.fill = colors.paleBlue;
  sheet.getRange("D2").format.fill = colors.paleRed;
  sheet.getRange("E2").format.fill = colors.mint;
  sheet.getRange("F2").format.fill = "#FEF3C7";
  sheet.getRange("G2").format.fill = "#FEE2E2";
  sheet.getRange("A2:G2").format.borders = { preset: "outside", style: "thin", color: colors.gray };
}

const resumo = workbook.worksheets.add("Resumo");
const leads = workbook.worksheets.add("Leads");
const fontes = workbook.worksheets.add("Fontes Permitidas");
const compliance = workbook.worksheets.add("Compliance");
const naoContatar = workbook.worksheets.add("Nao Contatar");
const mensagens = workbook.worksheets.add("Mensagens");
const listas = workbook.worksheets.add("Listas");

for (const sheet of [resumo, leads, fontes, compliance, naoContatar, mensagens, listas]) {
  sheet.showGridLines = false;
}

// Lists
listas.getRange("A1:H1").values = [["Tipo", "Status", "Prioridade", "Canal", "Base legal", "Fonte", "Persona", "Contato permitido"]];
styleHeader(listas.getRange("A1:H1"));
listas.getRange("A2:A8").values = [["Psicologo"], ["Clinica"], ["Consultorio"], ["Instituicao de saude"], ["Escola/Universidade"], ["Empresa/RH"], ["Outro"]];
listas.getRange("B2:B11").values = [["Novo"], ["Qualificar"], ["Apto"], ["Contatado"], ["Respondeu"], ["Reuniao marcada"], ["Convertido"], ["Nao aderente"], ["Nao contatar"], ["Duplicado"]];
listas.getRange("C2:C5").values = [["Alta"], ["Media"], ["Baixa"], ["Pendente"]];
listas.getRange("D2:D8").values = [["E-mail institucional"], ["Telefone comercial"], ["WhatsApp opt-in"], ["Formulario do site"], ["LinkedIn institucional"], ["Indicacao"], ["Evento/parceria"]];
listas.getRange("E2:E7").values = [["Opt-in explicito"], ["Contato institucional publicado"], ["Indicacao/parceria"], ["Evento com consentimento"], ["Interesse demonstrado"], ["Validar antes de contato"]];
listas.getRange("F2:F9").values = [["Site oficial"], ["Google Business Profile manual"], ["Diretorio com permissao de uso"], ["Evento/lista opt-in"], ["Formulario inbound"], ["Parceria"], ["Rede social institucional"], ["Outra fonte documentada"]];
listas.getRange("G2:G8").values = [["Psicologo clinico"], ["Neuropsicologo"], ["Clinica multiprofissional"], ["Psiquiatria/saude mental"], ["Fono/TO/fisio neuro"], ["Gestor de clinica"], ["Outro"]];
listas.getRange("H2:H4").values = [["Sim"], ["Validar"], ["Nao"]];
listas.getRange("A1:H11").format.borders = { preset: "inside", style: "thin", color: colors.gray };
listas.getRange("A1:H11").format.autofitColumns();

// Leads sheet
leads.getRange("A1:T1").values = [[
  "Nome / Organizacao",
  "Tipo",
  "Persona",
  "Contato principal",
  "Cargo/funcao",
  "E-mail institucional/opt-in",
  "Telefone comercial",
  "WhatsApp opt-in?",
  "Bairro / regiao",
  "Cidade",
  "UF",
  "Distancia estimada da Neuronex (km)",
  "Fonte",
  "URL da fonte",
  "Data da coleta",
  "Base legal / consentimento",
  "Contato permitido?",
  "Prioridade",
  "Status",
  "Score",
]];
styleHeader(leads.getRange("A1:T1"));
leads.freezePanes.freezeRows(1);
leads.freezePanes.freezeColumns(3);
leads.getRange("A2:T1001").format = {
  fill: colors.paleYellow,
  font: { color: "#111827" },
  verticalAlignment: "top",
  wrapText: true,
  borders: { preset: "inside", style: "thin", color: "#EEF2F7" },
};
leads.getRange("P2:T1001").format.fill = colors.paleBlue;
leads.getRange("J2:J1001").values = Array.from({ length: 1000 }, () => ["Tubarao"]);
leads.getRange("K2:K1001").values = Array.from({ length: 1000 }, () => ["SC"]);
leads.getRange("O2:O1001").setNumberFormat("yyyy-mm-dd");
leads.getRange("L2:L1001").setNumberFormat("0.0");
leads.getRange("T2").formulas = [[
  '=IF(A2="","",MIN(100,IF(B2="Psicologo",25,IF(B2="Clinica",18,10))+IF(C2="Neuropsicologo",20,IF(C2="Psicologo clinico",15,8))+IF(F2<>"",15,0)+IF(G2<>"",8,0)+IF(N2<>"",12,0)+IF(Q2="Sim",15,IF(Q2="Validar",5,-30))+IF(AND(ISNUMBER(L2),L2<=5),5,IF(AND(ISNUMBER(L2),L2<=15),3,0))))'
]];
leads.getRange("T2:T1001").fillDown();
leads.getRange("T2:T1001").format.fill = colors.paleBlue;
leads.getRange("T2:T1001").setNumberFormat("0");
leads.getRange("A2:T1001").conditionalFormats.add("expression", {
  formula: '=$Q2="Nao"',
  format: { fill: colors.paleRed, font: { color: "#7F1D1D" } },
});
leads.getRange("A2:T1001").conditionalFormats.add("expression", {
  formula: '=$Q2="Sim"',
  format: { fill: colors.mint },
});
leads.getRange("T2:T1001").conditionalFormats.add("expression", {
  formula: '=AND($A2<>"",$T2>=70)',
  format: { fill: colors.mint, font: { color: "#14532D", bold: true } },
});
leads.getRange("T2:T1001").conditionalFormats.add("expression", {
  formula: '=AND($A2<>"",$T2>=40,$T2<70)',
  format: { fill: "#FEF3C7", font: { color: "#78350F", bold: true } },
});
leads.getRange("T2:T1001").conditionalFormats.add("expression", {
  formula: '=AND($A2<>"",$T2<40)',
  format: { fill: colors.paleRed, font: { color: "#7F1D1D", bold: true } },
});
leads.getRange("B2:B1001").dataValidation = { rule: { type: "list", formula1: "'Listas'!$A$2:$A$8" } };
leads.getRange("C2:C1001").dataValidation = { rule: { type: "list", formula1: "'Listas'!$G$2:$G$8" } };
leads.getRange("H2:H1001").dataValidation = { rule: { type: "list", values: ["Sim", "Nao", "Validar"] } };
leads.getRange("M2:M1001").dataValidation = { rule: { type: "list", formula1: "'Listas'!$F$2:$F$9" } };
leads.getRange("P2:P1001").dataValidation = { rule: { type: "list", formula1: "'Listas'!$E$2:$E$7" } };
leads.getRange("Q2:Q1001").dataValidation = { rule: { type: "list", formula1: "'Listas'!$H$2:$H$4" } };
leads.getRange("R2:R1001").dataValidation = { rule: { type: "list", formula1: "'Listas'!$C$2:$C$5" } };
leads.getRange("S2:S1001").dataValidation = { rule: { type: "list", formula1: "'Listas'!$B$2:$B$11" } };
const leadTable = leads.tables.add("A1:T1001", true, "LeadsPermitidos");
leadTable.style = "TableStyleMedium2";
leadTable.showFilterButton = true;
leads.getRange("A1:T1001").format.autofitColumns();
leads.getRange("A1:A1001").format.columnWidthPx = 230;
leads.getRange("D1:D1001").format.columnWidthPx = 160;
leads.getRange("F1:G1001").format.columnWidthPx = 180;
leads.getRange("N1:N1001").format.columnWidthPx = 260;
leads.getRange("P1:P1001").format.columnWidthPx = 190;
leads.getRange("Q1:Q1001").format.columnWidthPx = 130;
leads.getRange("T1:T1001").format.columnWidthPx = 80;

// Resumo
resumo.getRange("A1:H1").merge();
resumo.getRange("A1").values = [["Neuronex - CRM de prospeccao responsavel em Tubarao/SC"]];
styleTitle(resumo.getRange("A1:H1"));
addLegend(resumo);
resumo.getRange("A4:H4").values = [["Metrica", "Valor", "Meta/Observacao", "", "Distribuicao", "Valor", "Acao recomendada", ""]];
styleHeader(resumo.getRange("A4:H4"));
resumo.getRange("A5:C12").values = [
  ["Leads preenchidos", null, "Meta: 500-1000 leads permitidos"],
  ["Psicologos", null, "Foco principal"],
  ["Contatos permitidos", null, "Somente estes devem entrar em campanha"],
  ["A validar", null, "Revisar antes de qualquer contato"],
  ["Bloqueados", null, "Nunca disparar"],
  ["Com e-mail", null, "Preferir e-mail institucional/opt-in"],
  ["Com telefone", null, "Telefone comercial ou opt-in"],
  ["Score medio", null, "Priorizar acima de 70"],
];
resumo.getRange("B5:B12").formulas = [
  [`=COUNTA(${leadRange})`],
  [`=COUNTIF('Leads'!$B$2:$B$${rows},"Psicologo")`],
  [`=COUNTIF('Leads'!$Q$2:$Q$${rows},"Sim")`],
  [`=COUNTIF('Leads'!$Q$2:$Q$${rows},"Validar")`],
  [`=COUNTIF('Leads'!$Q$2:$Q$${rows},"Nao")+COUNTIF('Leads'!$S$2:$S$${rows},"Nao contatar")`],
  [`=COUNTIF('Leads'!$F$2:$F$${rows},"<>")`],
  [`=COUNTIF('Leads'!$G$2:$G$${rows},"<>")`],
  [`=IFERROR(AVERAGEIF('Leads'!$T$2:$T$${rows},">0"),0)`],
];
resumo.getRange("B5:B12").setNumberFormat("#,##0");
resumo.getRange("A5:C12").format.borders = { preset: "inside", style: "thin", color: colors.gray };
resumo.getRange("A5:C12").format.wrapText = true;
resumo.getRange("A5:A12").format.fill = colors.paleGray;
resumo.getRange("B5:B12").format = { fill: colors.paleBlue, font: { bold: true, color: colors.navy }, horizontalAlignment: "center" };
resumo.getRange("E5:G10").values = [
  ["Novo", null, "Qualificar fonte e consentimento"],
  ["Qualificar", null, "Confirmar fit e contato permitido"],
  ["Apto", null, "Pode entrar em cadencia consentida"],
  ["Contatado", null, "Aguardar resposta sem excesso"],
  ["Respondeu/Reuniao", null, "Mover para pipeline comercial"],
  ["Nao contatar/Duplicado", null, "Excluir de campanhas"],
];
resumo.getRange("F5:F10").formulas = [
  [`=COUNTIF('Leads'!$S$2:$S$${rows},"Novo")`],
  [`=COUNTIF('Leads'!$S$2:$S$${rows},"Qualificar")`],
  [`=COUNTIF('Leads'!$S$2:$S$${rows},"Apto")`],
  [`=COUNTIF('Leads'!$S$2:$S$${rows},"Contatado")`],
  [`=COUNTIF('Leads'!$S$2:$S$${rows},"Respondeu")+COUNTIF('Leads'!$S$2:$S$${rows},"Reuniao marcada")`],
  [`=COUNTIF('Leads'!$S$2:$S$${rows},"Nao contatar")+COUNTIF('Leads'!$S$2:$S$${rows},"Duplicado")`],
];
resumo.getRange("E5:G10").format.borders = { preset: "inside", style: "thin", color: colors.gray };
resumo.getRange("E5:E10").format.fill = colors.paleGray;
resumo.getRange("F5:F10").format = { fill: colors.paleBlue, font: { bold: true, color: colors.navy }, horizontalAlignment: "center" };
resumo.getRange("A14:H18").values = [
  ["Uso correto desta planilha", "", "", "", "", "", "", ""],
  ["1. Nao raspar dados pessoais em massa de profissionais individuais.", "", "", "", "", "", "", ""],
  ["2. Priorizar contatos institucionais publicados, formularios oficiais, indicacoes, eventos opt-in e parcerias.", "", "", "", "", "", "", ""],
  ["3. Registrar URL, data de coleta, base legal/consentimento e motivo de contato antes de qualquer campanha.", "", "", "", "", "", "", ""],
  ["4. Respeitar descadastro, oposicao e lista de Nao Contatar.", "", "", "", "", "", "", ""],
];
resumo.getRange("A14:H14").merge();
styleSection(resumo.getRange("A14:H14"), colors.paleBlue);
for (let r = 15; r <= 18; r++) resumo.getRange(`A${r}:H${r}`).merge();
resumo.getRange("A15:H18").format = { fill: colors.paleYellow, wrapText: true, verticalAlignment: "top" };
resumo.getRange("A1:H18").format.autofitColumns();
resumo.getRange("A1:H18").format.autofitRows();
resumo.getRange("A:A").format.columnWidthPx = 170;
resumo.getRange("C:C").format.columnWidthPx = 330;
resumo.getRange("E:E").format.columnWidthPx = 150;
resumo.getRange("G:G").format.columnWidthPx = 300;

// Fontes Permitidas
fontes.getRange("A1:G1").values = [["Fonte/canal", "Uso recomendado", "Pode automatizar?", "Dados aceitaveis", "Risco", "Como registrar", "Observacao"]];
styleHeader(fontes.getRange("A1:G1"));
fontes.getRange("A2:G12").values = [
  ["Site oficial de clinicas/consultorios", "Coletar contato institucional publicado", "Nao, salvo permissao/API", "Nome da organizacao, telefone/email institucional, URL", "Baixo a medio", "URL + data + base legal", "Preferir formulario do site quando existir"],
  ["Google Business Profile manual", "Mapear empresas e confirmar contato comercial", "Nao usar scraping automatizado", "Contato comercial publicado", "Medio", "Nome + URL/fonte + data", "Evitar copiar dados de profissionais pessoa fisica sem base clara"],
  ["Diretorios com termos permissivos", "Usar apenas se os termos permitirem exportacao/uso comercial", "Somente com permissao/API", "Dados explicitamente licenciados", "Variavel", "URL dos termos + data", "Validar termos antes de importar"],
  ["Eventos, palestras e parcerias locais", "Gerar opt-in e relacionamento", "Sim, se lista foi cedida com consentimento", "Contato informado pelo participante", "Baixo", "Evento + consentimento + data", "Melhor qualidade para parceria B2B"],
  ["Formularios inbound e landing pages", "Capturar interesse ativo", "Sim", "Dados fornecidos voluntariamente", "Baixo", "Campanha + timestamp + consentimento", "Ideal para disparos recorrentes"],
  ["Redes sociais institucionais", "Registrar perfil/contato publico da organizacao", "Nao automatizar sem permissao", "Perfil institucional, link de contato", "Medio", "URL + data", "Nao extrair e-mails pessoais de posts"],
  ["CRP/associacoes profissionais", "Consultar apenas para verificacao/credibilidade", "Nao raspar", "Informacao publica conforme termos", "Alto", "Fonte + data + finalidade", "Nao transformar cadastro profissional em lista de disparo sem base legal"],
  ["Indicacoes de parceiros", "Validar permissao para contato", "Nao", "Contato autorizado pelo indicado", "Baixo", "Quem indicou + data + permissao", "Registrar contexto antes do envio"],
  ["Anuncios lead form", "Capturar opt-in com segmentacao local", "Sim, via plataforma", "Dados consentidos pelo lead", "Baixo", "Campanha + termo aceito", "Canal recomendado para escala"],
  ["Compra de bases", "Evitar", "Nao", "Somente com comprovacao de origem/consentimento", "Alto", "Contrato + origem + opt-out", "Usar apenas apos avaliacao juridica"],
  ["Scraping massivo de psicologos individuais", "Nao usar", "Nao", "Nao aplicavel", "Alto", "Bloquear", "Fora do escopo desta planilha"],
];
fontes.getRange("A1:G12").format.borders = { preset: "inside", style: "thin", color: colors.gray };
fontes.getRange("A2:G12").format.wrapText = true;
fontes.getRange("C2:C12").conditionalFormats.add("containsText", { text: "Nao", format: { fill: colors.paleRed, font: { color: "#7F1D1D" } } });
fontes.getRange("C2:C12").conditionalFormats.add("containsText", { text: "Sim", format: { fill: colors.mint } });
fontes.getRange("E2:E12").conditionalFormats.add("containsText", { text: "Alto", format: { fill: colors.paleRed, font: { color: "#7F1D1D" } } });
fontes.getRange("E2:E12").conditionalFormats.add("containsText", { text: "Baixo", format: { fill: colors.mint } });
fontes.getRange("A1:G12").format.autofitColumns();
fontes.getRange("A1:G12").format.autofitRows();
fontes.getRange("A:A").format.columnWidthPx = 260;
fontes.getRange("B:B").format.columnWidthPx = 290;
fontes.getRange("C:C").format.columnWidthPx = 260;
fontes.getRange("D:D").format.columnWidthPx = 340;
fontes.getRange("G:G").format.columnWidthPx = 330;
fontes.getRange("A2:G12").format.rowHeightPx = 42;

// Compliance
compliance.getRange("A1:D1").merge();
compliance.getRange("A1").values = [["Checklist de LGPD e boas praticas para prospeccao"]];
styleTitle(compliance.getRange("A1:D1"));
compliance.getRange("A3:D3").values = [["Item", "Obrigatorio?", "Como comprovar", "Status"]];
styleHeader(compliance.getRange("A3:D3"));
compliance.getRange("A4:D15").values = [
  ["Fonte e URL registradas para cada lead", "Sim", "Colunas Fonte, URL e Data da coleta", "Pendente"],
  ["Base legal/consentimento identificado", "Sim", "Coluna Base legal / consentimento", "Pendente"],
  ["Contato permitido marcado como Sim antes de campanha", "Sim", "Coluna Contato permitido?", "Pendente"],
  ["Lista Nao Contatar consultada antes do envio", "Sim", "Aba Nao Contatar", "Pendente"],
  ["Opt-out claro em toda comunicacao", "Sim", "Template/campanha", "Pendente"],
  ["Segmentacao coerente com interesse profissional", "Sim", "Persona e motivo do contato", "Pendente"],
  ["Sem dados de pacientes ou dados sensiveis", "Sim", "Revisao manual", "Pendente"],
  ["Sem scraping massivo de pessoas fisicas", "Sim", "Metodo de coleta documentado", "Pendente"],
  ["Frequencia de contato limitada", "Sim", "Regras da ferramenta de envio", "Pendente"],
  ["Registro de descadastro e oposicao", "Sim", "Aba Nao Contatar", "Pendente"],
  ["Validacao juridica para campanhas em escala", "Recomendado", "Parecer interno/externo", "Pendente"],
  ["Revisao periodica de dados antigos", "Recomendado", "Data de coleta e status", "Pendente"],
];
compliance.getRange("D4:D15").dataValidation = { rule: { type: "list", values: ["Pendente", "OK", "Bloqueado", "Nao se aplica"] } };
compliance.getRange("A3:D15").format.borders = { preset: "inside", style: "thin", color: colors.gray };
compliance.getRange("A4:D15").format.wrapText = true;
compliance.getRange("D4:D15").conditionalFormats.add("containsText", { text: "OK", format: { fill: colors.mint, font: { color: "#14532D" } } });
compliance.getRange("D4:D15").conditionalFormats.add("containsText", { text: "Bloqueado", format: { fill: colors.paleRed, font: { color: "#7F1D1D" } } });
compliance.getRange("D4:D15").conditionalFormats.add("containsText", { text: "Pendente", format: { fill: "#FEF3C7", font: { color: "#78350F" } } });
compliance.getRange("A17:D20").values = [
  ["Nota", "", "", ""],
  ["Esta planilha nao substitui orientacao juridica. Use-a para reduzir risco operacional, documentar consentimento/base legal e evitar disparos para pessoas sem permissao clara.", "", "", ""],
  ["Regra pratica: se a origem, a permissao ou o canal nao forem claros, marque Contato permitido? = Validar ou Nao.", "", "", ""],
  ["Endereco de referencia Neuronex: Av. Expedicionario Jose Pedro Coelho, 1120 - Centro, Tubarao - SC, 88704-201.", "", "", ""],
];
compliance.getRange("A17:D17").merge();
styleSection(compliance.getRange("A17:D17"), colors.paleBlue);
for (let r = 18; r <= 20; r++) compliance.getRange(`A${r}:D${r}`).merge();
compliance.getRange("A18:D20").format = { fill: colors.paleYellow, wrapText: true, verticalAlignment: "top" };
compliance.getRange("A1:D20").format.autofitColumns();
compliance.getRange("A:A").format.columnWidthPx = 280;
compliance.getRange("C:C").format.columnWidthPx = 280;

// Nao Contatar
naoContatar.getRange("A1:G1").values = [["Nome/Organizacao", "E-mail", "Telefone", "Motivo", "Data", "Origem", "Observacoes"]];
styleHeader(naoContatar.getRange("A1:G1"));
naoContatar.freezePanes.freezeRows(1);
naoContatar.getRange("A2:G501").format = {
  fill: colors.paleYellow,
  wrapText: true,
  borders: { preset: "inside", style: "thin", color: "#EEF2F7" },
};
naoContatar.getRange("E2:E501").setNumberFormat("yyyy-mm-dd");
const blockTable = naoContatar.tables.add("A1:G501", true, "ListaNaoContatar");
blockTable.style = "TableStyleMedium4";
blockTable.showFilterButton = true;
naoContatar.getRange("A1:G501").format.autofitColumns();
naoContatar.getRange("A:A").format.columnWidthPx = 220;
naoContatar.getRange("G:G").format.columnWidthPx = 300;

// Mensagens
mensagens.getRange("A1:E1").merge();
mensagens.getRange("A1").values = [["Modelos seguros de abordagem"]];
styleTitle(mensagens.getRange("A1:E1"));
mensagens.getRange("A3:E3").values = [["Contexto", "Quando usar", "Assunto", "Mensagem curta", "Cuidado"]];
styleHeader(mensagens.getRange("A3:E3"));
mensagens.getRange("A4:E8").values = [
  ["Contato institucional publicado", "Organizacao com e-mail/formulario no site", "Parceria local em saude mental - Neuronex", "Ola, tudo bem? Sou da Neuronex, em Tubarao. Vi o contato institucional de voces e gostaria de apresentar uma possibilidade de parceria local. Caso nao faça sentido, posso remover este contato da nossa lista.", "Incluir opt-out e nao insistir se nao houver resposta"],
  ["Indicacao", "Quando alguem autorizou o contato", "Indicacao para conversarmos sobre Neuronex", "Ola, recebi seu contato por indicacao de [nome/contexto] para falar sobre uma possivel parceria com a Neuronex. Faz sentido marcarmos uma conversa breve?", "Registrar quem indicou e permissao"],
  ["Evento/opt-in", "Lead aceitou receber contato", "Obrigado pelo interesse na Neuronex", "Ola, obrigado pelo interesse em saber mais sobre a Neuronex. Podemos enviar um resumo ou agendar uma conversa curta?", "Guardar origem do opt-in"],
  ["Formulario do site", "Preferivel quando existe formulario oficial", "Mensagem via formulario", "Somos da Neuronex, em Tubarao, e gostaríamos de conversar sobre parceria/encaminhamento. Qual o melhor canal institucional para seguirmos?", "Evitar anexos e textos longos"],
  ["Nao usar", "Contato pessoal sem base clara", "N/A", "Nao enviar.", "Marcar como Validar ou Nao"],
];
mensagens.getRange("A3:E8").format.borders = { preset: "inside", style: "thin", color: colors.gray };
mensagens.getRange("A4:E8").format.wrapText = true;
mensagens.getRange("A1:E8").format.autofitColumns();
mensagens.getRange("D:D").format.columnWidthPx = 460;
mensagens.getRange("E:E").format.columnWidthPx = 250;

// Final workbook comments / metadata
workbook.comments.setSelf({ displayName: "User" });
workbook.comments.addThread({ cell: leads.getRange("A1") }, maxRowsNote);
workbook.comments.addThread({ cell: leads.getRange("Q1") }, "Marque Sim somente quando houver contato institucional publicado, opt-in, indicacao autorizada ou outra base documentada.");
workbook.comments.addThread({ cell: fontes.getRange("A12") }, "Scraping massivo de psicologos individuais foi deixado fora por risco de privacidade e compliance.");

// Visual render and final export
const renderTargets = [
  { sheetName: "Resumo", range: "A1:H18" },
  { sheetName: "Leads", range: "A1:T25" },
  { sheetName: "Fontes Permitidas", range: "A1:G12" },
  { sheetName: "Compliance", range: "A1:D20" },
  { sheetName: "Nao Contatar", range: "A1:G25" },
  { sheetName: "Mensagens", range: "A1:E8" },
];
for (const { sheetName, range } of renderTargets) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${sheetName.replaceAll(" ", "_").replaceAll("/", "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const inspectLeads = await workbook.inspect({
  kind: "table",
  range: "Leads!A1:T8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 20,
  maxChars: 6000,
});
console.log(inspectLeads.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/neuronex_crm_prospeccao_tubarao_lgpd.xlsx`);
