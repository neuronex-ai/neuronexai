import { describe, expect, it } from 'vitest';

import { polishPortugueseUiText } from '@/lib/portuguese-ui-text';

describe('polishPortugueseUiText', () => {
  it('repairs mojibake and common missing accents without changing storage', () => {
    expect(polishPortugueseUiText('Cobranca criada para a proxima sessÃ£o')).toBe(
      'Cobrança criada para a próxima sessão',
    );
  });

  it('improves the pending teleconsultation copy', () => {
    expect(polishPortugueseUiText('Resumo de teleconsulta pendente')).toBe(
      'Resumo da teleconsulta pendente',
    );
  });
});
