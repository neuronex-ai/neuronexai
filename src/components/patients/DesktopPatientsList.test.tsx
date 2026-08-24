import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { Patient } from '@/types';
import { DesktopPatientsList } from './DesktopPatientsList';

const patient = {
  id: 'patient-1',
  user_id: 'professional-1',
  name: 'Marina Oliveira',
  email: 'marina@example.com',
  phone: '11999999999',
  status: 'active',
  last_session: null,
  next_session: '2026-08-25T14:00:00.000Z',
  diagnosis: 'Acompanhamento clínico',
  notes: null,
  created_at: '2026-08-01T12:00:00.000Z',
} as Patient;

describe('DesktopPatientsList', () => {
  it('renders a semantic directory with accessible open and delete actions', () => {
    const onDelete = vi.fn();
    render(
      <MemoryRouter>
        <DesktopPatientsList patients={[patient]} onDelete={onDelete} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('table', { name: /pacientes encontrados/i })).toBeInTheDocument();
    expect(screen.getByText('Marina Oliveira')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /abrir prontuário de Marina Oliveira/i })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /excluir Marina Oliveira/i }));
    expect(onDelete).toHaveBeenCalledWith(patient);
  });
});
