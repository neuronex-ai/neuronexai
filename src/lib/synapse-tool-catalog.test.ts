import { describe, expect, it } from 'vitest';

import {
    getQuickActionsForRoute,
    getToolsForRoute,
    resolveSynapseToolPolicy,
    SYNAPSE_TOOLS,
} from './synapse-tool-catalog';

describe('catálogo canônico do Synapse no cliente', () => {
    it('filtra ferramentas pelo contexto da rota', () => {
        const finance = getToolsForRoute('/financeiro');

        expect(finance.some((tool) => tool.id === 'get_financial_metrics')).toBe(true);
        expect(finance.some((tool) => tool.id === 'get_patient_details')).toBe(false);
        expect(finance.some((tool) => tool.id === 'search_patients')).toBe(true);
    });

    it('deriva confirmação, executor e disponibilidade por voz', () => {
        const neuroFlow = SYNAPSE_TOOLS.find((tool) => tool.id === 'create_neuroflow_from_patient_history');
        const neuroView = SYNAPSE_TOOLS.find((tool) => tool.id === 'analyze_neuroview_patient_patterns');

        expect(neuroFlow && resolveSynapseToolPolicy(neuroFlow)).toMatchObject({
            executor: 'mutation',
            requiresConfirmation: true,
            voiceAvailability: 'confirmation',
        });
        expect(neuroView && resolveSynapseToolPolicy(neuroView)).toMatchObject({
            executor: 'read',
            requiresConfirmation: false,
            voiceAvailability: 'direct',
        });
    });

    it('expõe quick actions somente para leituras de baixo risco', () => {
        const actions = getQuickActionsForRoute('/pacientes');
        expect(actions.length).toBeGreaterThan(0);
        expect(actions.every((tool) => tool.riskLevel === 'low' && !tool.requiresConfirmation)).toBe(true);
    });
});

