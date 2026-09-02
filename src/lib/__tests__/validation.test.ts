import { describe, it, expect } from 'vitest';
import {
    NewPatientSchema,
    NewAppointmentSchema,
    NewTransactionSchema,
    LoginFormSchema,
    SignupFormSchema,
} from '../validation';

// ─── NewPatientSchema ─────────────────────────────────────────────────
describe('NewPatientSchema', () => {
    it('deve aceitar paciente válido com dados mínimos', () => {
        const result = NewPatientSchema.safeParse({
            name: 'Maria Silva',
        });
        expect(result.success).toBe(true);
    });

    it('deve rejeitar nome com menos de 2 caracteres', () => {
        const result = NewPatientSchema.safeParse({
            name: 'M',
        });
        expect(result.success).toBe(false);
    });

    it('deve aceitar paciente com todos os campos opcionais', () => {
        const result = NewPatientSchema.safeParse({
            name: 'João Pedro Santos',
            email: 'joao@email.com',
            phone: '11999999999',
            cpf: '123.456.789-00',
            diagnosis: 'Ansiedade generalizada',
            notes: 'Paciente encaminhado por médico',
            address: 'Rua ABC, 123',
            emergency_name: 'Ana Santos',
            emergency_phone: '11988888888',
        });
        expect(result.success).toBe(true);
    });

    it('deve rejeitar email inválido', () => {
        const result = NewPatientSchema.safeParse({
            name: 'Maria',
            email: 'nao-eh-email',
        });
        expect(result.success).toBe(false);
    });

    it('deve aceitar email vazio (opcional)', () => {
        const result = NewPatientSchema.safeParse({
            name: 'Maria',
            email: '',
        });
        expect(result.success).toBe(true);
    });

    it('deve exigir nome do responsável quando payer_type é "other"', () => {
        const result = NewPatientSchema.safeParse({
            name: 'Criança Silva',
            payer_type: 'other',
            // payer_name ausente
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('payer_name');
        }
    });

    it('deve exigir CPF do responsável quando payer_type é "other"', () => {
        const result = NewPatientSchema.safeParse({
            name: 'Criança Silva',
            payer_type: 'other',
            payer_name: 'Mãe Silva',
            // payer_cpf ausente
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((i) => i.path.join('.'));
            expect(paths).toContain('payer_cpf');
        }
    });

    it('deve aceitar quando payer_type é "other" com nome e CPF', () => {
        const result = NewPatientSchema.safeParse({
            name: 'Criança',
            payer_type: 'other',
            payer_name: 'Responsável',
            payer_cpf: '123.456.789-00',
        });
        expect(result.success).toBe(true);
    });
});

// ─── NewAppointmentSchema ─────────────────────────────────────────────
describe('NewAppointmentSchema', () => {
    const validAppointment = {
        patient_id: '550e8400-e29b-41d4-a716-446655440000',
        date: new Date(2026, 2, 1),
        startTime: '14:00',
        duration: '50',
        type: 'online' as const,
    };

    it('deve aceitar consulta online válida', () => {
        const result = NewAppointmentSchema.safeParse(validAppointment);
        expect(result.success).toBe(true);
    });

    it('deve rejeitar patient_id não UUID', () => {
        const result = NewAppointmentSchema.safeParse({
            ...validAppointment,
            patient_id: 'nao-uuid',
        });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar hora em formato inválido', () => {
        const result = NewAppointmentSchema.safeParse({
            ...validAppointment,
            startTime: '2pm',
        });
        expect(result.success).toBe(false);
    });

    it('deve exigir localização para consulta presencial', () => {
        const result = NewAppointmentSchema.safeParse({
            ...validAppointment,
            type: 'presencial',
            // location ausente
        });
        expect(result.success).toBe(false);
    });

    it('deve aceitar consulta presencial com localização', () => {
        const result = NewAppointmentSchema.safeParse({
            ...validAppointment,
            type: 'presencial',
            location: 'Consultório sala 302',
        });
        expect(result.success).toBe(true);
    });
});

// ─── NewTransactionSchema ─────────────────────────────────────────────
describe('NewTransactionSchema', () => {
    it('deve aceitar transação de receita válida', () => {
        const result = NewTransactionSchema.safeParse({
            description: 'Sessão de terapia',
            amount: 250,
            type: 'income',
            date: '2026-03-01',
        });
        expect(result.success).toBe(true);
    });

    it('deve rejeitar valor negativo', () => {
        const result = NewTransactionSchema.safeParse({
            description: 'Sessão de terapia',
            amount: -100,
            type: 'income',
            date: '2026-03-01',
        });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar valor zero', () => {
        const result = NewTransactionSchema.safeParse({
            description: 'Sessão',
            amount: 0,
            type: 'income',
            date: '2026-03-01',
        });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar descrição curta (< 3 caracteres)', () => {
        const result = NewTransactionSchema.safeParse({
            description: 'AB',
            amount: 100,
            type: 'income',
            date: '2026-03-01',
        });
        expect(result.success).toBe(false);
    });

    it('deve aceitar todos os métodos de pagamento válidos', () => {
        const methods = ['pix', 'money', 'credit_card', 'debit_card', 'boleto', 'mixed'] as const;
        for (const method of methods) {
            const result = NewTransactionSchema.safeParse({
                description: 'Sessão',
                amount: 100,
                type: 'income',
                date: '2026-03-01',
                payment_method: method,
            });
            expect(result.success).toBe(true);
        }
    });
});

// ─── LoginFormSchema ──────────────────────────────────────────────────
describe('LoginFormSchema', () => {
    it('deve aceitar login válido', () => {
        const result = LoginFormSchema.safeParse({
            email: 'psicologa@email.com',
            password: 'aaaaaa',
        });
        expect(result.success).toBe(true);
    });

    it('deve rejeitar email inválido', () => {
        const result = LoginFormSchema.safeParse({
            email: 'nao-email',
            password: 'aaaaaa',
        });
        expect(result.success).toBe(false);
    });

    it('deve rejeitar senha curta (< 6 caracteres)', () => {
        const result = LoginFormSchema.safeParse({
            email: 'ok@email.com',
            password: '12345',
        });
        expect(result.success).toBe(false);
    });
});

// ─── SignupFormSchema ─────────────────────────────────────────────────
describe('SignupFormSchema', () => {
    it('deve aceitar cadastro válido', () => {
        const result = SignupFormSchema.safeParse({
            email: 'nova@email.com',
            password: 'minhaSenha',
            firstName: 'Ana',
            lastName: 'Souza',
        });
        expect(result.success).toBe(true);
    });

    it('deve rejeitar primeiro nome curto', () => {
        const result = SignupFormSchema.safeParse({
            email: 'nova@email.com',
            password: 'minhaSenha',
            firstName: 'A',
            lastName: 'Souza',
        });
        expect(result.success).toBe(false);
    });
});
