/**
 * Validates only the local CRP text format. This does not confirm that the
 * registration exists, belongs to the professional, or is active at the CFP.
 */
export function isValidCRPFormat(crp: string): boolean {
  const normalizedCRP = crp.trim().toUpperCase().replace(/\s+/g, "");
  const match = normalizedCRP.match(/^(\d{2})\/(\d{4,6})$/);

  if (!match) return false;

  const regionalCode = Number.parseInt(match[1], 10);
  return regionalCode >= 1 && regionalCode <= 27;
}

export function formatCRP(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length > 2) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 7)}`;
  }
  return numbers;
}

export const CRP_REGIONS: Record<string, string> = {
  "01": "Distrito Federal",
  "02": "Pernambuco",
  "03": "Bahia",
  "04": "Minas Gerais",
  "05": "Rio de Janeiro",
  "06": "São Paulo",
  "07": "Rio Grande do Sul",
  "08": "Paraná",
  "09": "Goiás/Tocantins",
  "10": "Pará/Amapá",
  "11": "Ceará",
  "12": "Santa Catarina",
  "13": "Paraíba",
  "14": "Mato Grosso do Sul",
  "15": "Alagoas",
  "16": "Espírito Santo",
  "17": "Rio Grande do Norte",
  "18": "Mato Grosso",
  "19": "Sergipe",
  "20": "Amazonas/Roraima/Acre/Rondônia",
  "21": "Piauí",
  "22": "Maranhão",
  "23": "Tocantins",
  "24": "Aracaju",
  "25": "Fortaleza",
  "26": "Brasília",
  "27": "Curitiba",
};

export function getRegionFromCRP(crp: string): string | null {
  const match = crp.match(/^(\d{2})\//);
  return match ? CRP_REGIONS[match[1]] ?? null : null;
}
