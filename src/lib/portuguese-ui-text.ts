import { repairMojibake } from '@/lib/text-encoding';

const ACCENT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bcobrancas\b/giu, 'cobranças'],
  [/\bcobranca\b/giu, 'cobrança'],
  [/\bsessoes\b/giu, 'sessões'],
  [/\bsessao\b/giu, 'sessão'],
  [/\bprontuarios\b/giu, 'prontuários'],
  [/\bprontuario\b/giu, 'prontuário'],
  [/\brevisoes\b/giu, 'revisões'],
  [/\brevisao\b/giu, 'revisão'],
  [/\btranscricoes\b/giu, 'transcrições'],
  [/\btranscricao\b/giu, 'transcrição'],
  [/\bnotificacoes\b/giu, 'notificações'],
  [/\bnotificacao\b/giu, 'notificação'],
  [/\bconfiguracoes\b/giu, 'configurações'],
  [/\bconfiguracao\b/giu, 'configuração'],
  [/\bintegracoes\b/giu, 'integrações'],
  [/\bintegracao\b/giu, 'integração'],
  [/\batualizacoes\b/giu, 'atualizações'],
  [/\batualizacao\b/giu, 'atualização'],
  [/\bconfirmacao\b/giu, 'confirmação'],
  [/\bsolicitacoes\b/giu, 'solicitações'],
  [/\bsolicitacao\b/giu, 'solicitação'],
  [/\breagendamentos\b/giu, 'reagendamentos'],
  [/\breagendamento\b/giu, 'reagendamento'],
  [/\bcancelamentos\b/giu, 'cancelamentos'],
  [/\bcancelamento\b/giu, 'cancelamento'],
  [/\bautomacao\b/giu, 'automação'],
  [/\bsituacao\b/giu, 'situação'],
  [/\bconsequencia\b/giu, 'consequência'],
  [/\balteracao\b/giu, 'alteração'],
  [/\bhorarios\b/giu, 'horários'],
  [/\bhorario\b/giu, 'horário'],
  [/\bperiodo\b/giu, 'período'],
  [/\bclinicos\b/giu, 'clínicos'],
  [/\bclinico\b/giu, 'clínico'],
  [/\bproximas\b/giu, 'próximas'],
  [/\bproxima\b/giu, 'próxima'],
  [/\bproximos\b/giu, 'próximos'],
  [/\bproximo\b/giu, 'próximo'],
  [/\bpossivel\b/giu, 'possível'],
  [/\bnao\b/giu, 'não'],
];

const preserveCase = (source: string, replacement: string) => {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
};

/**
 * Repairs legacy encoding and the most common unaccented operational copy
 * before it reaches Dashboard/notification surfaces. Stored records remain
 * untouched; only their presentation is normalized.
 */
export const polishPortugueseUiText = (value?: string | null) => {
  let text = repairMojibake(String(value ?? '').trim());

  for (const [pattern, replacement] of ACCENT_REPLACEMENTS) {
    text = text.replace(pattern, (match) => preserveCase(match, replacement));
  }

  text = text.replace(/\bResumo de teleconsulta pendente\b/giu, (match) =>
    preserveCase(match, 'resumo da teleconsulta pendente'),
  );
  text = text.replace(
    /precisa ser validado antes de entrar definitivo no prontuário/giu,
    'precisa ser validado antes de ser incluído definitivamente no prontuário',
  );

  return text;
};
