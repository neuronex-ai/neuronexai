import { describe, it, expect } from 'vitest';
import { cn, getInitials, formatCurrency } from '../utils';

// ─── cn (className merge) ─────────────────────────────────────────────
describe('cn', () => {
    it('deve combinar classes simples', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('deve resolver conflitos do Tailwind (última classe vence)', () => {
        const result = cn('p-4', 'p-2');
        expect(result).toBe('p-2');
    });

    it('deve aceitar condicionais (clsx)', () => {
        const shouldHide = false;
        const shouldShow = true;
        const result = cn('base', shouldHide && 'hidden', shouldShow && 'visible');
        expect(result).toContain('base');
        expect(result).toContain('visible');
        expect(result).not.toContain('hidden');
    });

    it('deve lidar com undefined e null', () => {
        const result = cn('base', undefined, null);
        expect(result).toBe('base');
    });
});

// ─── getInitials ──────────────────────────────────────────────────────
describe('getInitials', () => {
    it('deve retornar iniciais de nome completo', () => {
        expect(getInitials('Maria Silva')).toBe('MS');
    });

    it('deve retornar primeira e última inicial para nomes longos', () => {
        expect(getInitials('Ana Maria da Silva')).toBe('AS');
    });

    it('deve retornar duas primeiras letras para nome único', () => {
        expect(getInitials('Maria')).toBe('MA');
    });

    it('deve retornar "?" para string vazia', () => {
        expect(getInitials('')).toBe('?');
    });

    it('deve retornar "?" para string com espaços', () => {
        expect(getInitials('   ')).toBe('?');
    });

    it('deve tratar nome de uma letra', () => {
        expect(getInitials('M')).toBe('M');
    });

    it('deve retornar maiúsculas', () => {
        expect(getInitials('joão pedro')).toBe('JP');
    });
});

// ─── formatCurrency ───────────────────────────────────────────────────
describe('formatCurrency', () => {
    it('deve formatar valor positivo em BRL', () => {
        const result = formatCurrency(150.5);
        expect(result).toContain('R$');
        expect(result).toContain('150,50');
    });

    it('deve formatar valor zero', () => {
        const result = formatCurrency(0);
        expect(result).toContain('R$');
        expect(result).toContain('0,00');
    });

    it('deve retornar R$ 0,00 para null', () => {
        expect(formatCurrency(null)).toBe('R$ 0,00');
    });

    it('deve retornar R$ 0,00 para undefined', () => {
        expect(formatCurrency(undefined)).toBe('R$ 0,00');
    });

    it('deve formatar valor negativo', () => {
        const result = formatCurrency(-50);
        expect(result).toContain('50,00');
    });

    it('deve formatar milhares com separador', () => {
        const result = formatCurrency(12345.67);
        expect(result).toContain('12.345,67');
    });
});
