import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TranscriptionConsentPanel } from './TranscriptionConsentPanel';

describe('TranscriptionConsentPanel', () => {
  it('submits the affirmative digital decision through the modal action', async () => {
    const onGrant = vi.fn().mockResolvedValue(undefined);
    render(<TranscriptionConsentPanel patientName="Marina" onGrant={onGrant} onDecline={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Transcrever teleconsulta' }));

    await waitFor(() => expect(onGrant).toHaveBeenCalledWith(
      'digital',
      'Transcrição autorizada pelo profissional no início da teleconsulta.',
    ));
  });

  it('submits the negative decision without enabling transcription', async () => {
    const onDecline = vi.fn().mockResolvedValue(undefined);
    render(<TranscriptionConsentPanel patientName="Marina" onGrant={vi.fn()} onDecline={onDecline} />);

    fireEvent.click(screen.getByRole('button', { name: 'Não transcrever' }));

    await waitFor(() => expect(onDecline).toHaveBeenCalledWith(
      'Profissional optou por conduzir a sessão sem transcrição.',
    ));
  });
});
