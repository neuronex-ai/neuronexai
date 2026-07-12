// ─── Synapse Tool Catalog ─────────────────────────────────────────────
// Canonical registry of all Synapse AI capabilities.
// The shell consults this before displaying available actions.

export type ToolStatus = 'active' | 'untested' | 'mock' | 'external_dep';

export type ToolCategory =
    | 'patients'
    | 'clinical'
    | 'agenda'
    | 'finance'
    | 'documents'
    | 'knowledge'
    | 'communication'
    | 'navigation';

export interface SynapseTool {
    id: string;
    name: string;
    description: string;
    status: ToolStatus;
    category: ToolCategory;
    icon?: string; // lucide icon name
    allowedRoutes: string[]; // route prefixes where this tool is relevant
    hiddenInProduction: boolean; // if true, only visible in dev mode
    riskLevel: 'low' | 'medium' | 'high';
    requiresConfirmation?: boolean;
    voiceAvailability?: 'direct' | 'confirmation' | 'blocked';
    executor?: 'read' | 'mutation' | 'interface';
}

export interface ResolvedSynapseTool extends SynapseTool {
    requiresConfirmation: boolean;
    voiceAvailability: 'direct' | 'confirmation' | 'blocked';
    executor: 'read' | 'mutation' | 'interface';
}

// ─── DEV MODE ─────────────────────────────────────────────────────────
const IS_DEV = import.meta.env.DEV;

export const SYNAPSE_TOOLS: SynapseTool[] = [
    // ── Patients ────────────────────────────────────────────────────────
    {
        id: 'list_patients',
        name: 'Listar Pacientes',
        description: 'Lista todos os pacientes cadastrados',
        status: 'active',
        category: 'patients',
        icon: 'Users',
        allowedRoutes: ['*'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'search_patients',
        name: 'Buscar Paciente',
        description: 'Busca pacientes por nome ou critério',
        status: 'active',
        category: 'patients',
        icon: 'Search',
        allowedRoutes: ['*'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'get_patient_details',
        name: 'Detalhes do Paciente',
        description: 'Obtém informações detalhadas de um paciente',
        status: 'active',
        category: 'patients',
        icon: 'UserCheck',
        allowedRoutes: ['/pacientes', '/teleconsulta', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'create_patient',
        name: 'Cadastrar Paciente',
        description: 'Cria um novo cadastro de paciente',
        status: 'untested',
        category: 'patients',
        icon: 'UserPlus',
        allowedRoutes: ['/pacientes', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'medium',
    },
    {
        id: 'update_patient_info',
        name: 'Atualizar Paciente',
        description: 'Atualiza dados de um paciente existente',
        status: 'untested',
        category: 'patients',
        icon: 'UserCog',
        allowedRoutes: ['/pacientes', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'medium',
    },
    {
        id: 'report_all_patients',
        name: 'Relatório de Pacientes',
        description: 'Gera relatório completo da base de pacientes',
        status: 'active',
        category: 'patients',
        icon: 'FileBarChart',
        allowedRoutes: ['/dashboard', '/pacientes', '/notas', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },

    // ── Clinical ────────────────────────────────────────────────────────
    {
        id: 'search_clinical_history',
        name: 'Buscar Histórico Clínico',
        description: 'Busca no histórico clínico do paciente via RAG',
        status: 'active',
        category: 'clinical',
        icon: 'Stethoscope',
        allowedRoutes: ['/pacientes', '/teleconsulta', '/notas', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'create_session_note',
        name: 'Criar Nota de Sessão',
        description: 'Registra uma nota de sessão clínica',
        status: 'untested',
        category: 'clinical',
        icon: 'FilePlus',
        allowedRoutes: ['/pacientes', '/teleconsulta', '/notas', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'medium',
    },
    {
        id: 'generate_patient_insights',
        name: 'Insights do Paciente',
        description: 'Gera insights clínicos baseados no histórico',
        status: 'untested',
        category: 'clinical',
        icon: 'Lightbulb',
        allowedRoutes: ['/pacientes', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'medium',
    },
    {
        id: 'detect_risk_patterns',
        name: 'Detectar Padrões de Risco',
        description: 'Analisa padrões de risco no paciente',
        status: 'untested',
        category: 'clinical',
        icon: 'AlertTriangle',
        allowedRoutes: ['/pacientes', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'high',
    },
    {
        id: 'analyze_neuroview_patient_patterns',
        name: 'Analisar no NeuroView',
        description: 'Cruza registros reais do paciente e abre o mapa de conexões',
        status: 'active',
        category: 'clinical',
        icon: 'Network',
        allowedRoutes: ['/pacientes', '/notas', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
        requiresConfirmation: false,
        voiceAvailability: 'direct',
    },
    {
        id: 'create_neuroflow_from_patient_history',
        name: 'Criar NeuroFlow assistido',
        description: 'Prepara um fluxo a partir do histórico real e pede confirmação antes de salvar',
        status: 'active',
        category: 'clinical',
        icon: 'Workflow',
        allowedRoutes: ['/pacientes', '/notas', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'medium',
        requiresConfirmation: true,
        voiceAvailability: 'confirmation',
    },
    {
        id: 'create_neuropulse_cause_effect_diagram',
        name: 'Criar NeuroPulse assistido',
        description: 'Prepara um diagrama clínico e pede confirmação antes de salvar',
        status: 'active',
        category: 'clinical',
        icon: 'Activity',
        allowedRoutes: ['/pacientes', '/notas', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'medium',
        requiresConfirmation: true,
        voiceAvailability: 'confirmation',
    },

    // ── Agenda ──────────────────────────────────────────────────────────
    {
        id: 'get_calendar',
        name: 'Ver Agenda',
        description: 'Consulta a agenda do profissional',
        status: 'active',
        category: 'agenda',
        icon: 'Calendar',
        allowedRoutes: ['/dashboard', '/agenda', '/pacientes', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'find_available_slots',
        name: 'Buscar Horários',
        description: 'Encontra horários disponíveis na agenda',
        status: 'active',
        category: 'agenda',
        icon: 'CalendarSearch',
        allowedRoutes: ['/agenda', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'create_appointment',
        name: 'Agendar Consulta',
        description: 'Cria um novo agendamento',
        status: 'untested',
        category: 'agenda',
        icon: 'CalendarPlus',
        allowedRoutes: ['/agenda', '/pacientes', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'high',
    },
    {
        id: 'reschedule_appointment',
        name: 'Reagendar Consulta',
        description: 'Altera a data/hora de uma consulta',
        status: 'untested',
        category: 'agenda',
        icon: 'CalendarClock',
        allowedRoutes: ['/agenda', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'high',
    },
    {
        id: 'cancel_appointment',
        name: 'Cancelar Consulta',
        description: 'Cancela uma consulta existente',
        status: 'untested',
        category: 'agenda',
        icon: 'CalendarX',
        allowedRoutes: ['/agenda', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'medium',
    },

    // ── Finance ─────────────────────────────────────────────────────────
    {
        id: 'get_financial_metrics',
        name: 'Métricas Financeiras',
        description: 'Consulta KPIs e métricas financeiras',
        status: 'active',
        category: 'finance',
        icon: 'TrendingUp',
        allowedRoutes: ['/dashboard', '/financeiro', '/notas', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'list_transactions',
        name: 'Listar Transações',
        description: 'Lista transações financeiras',
        status: 'active',
        category: 'finance',
        icon: 'Receipt',
        allowedRoutes: ['/financeiro', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'draft_invoice',
        name: 'Gerar Cobrança',
        description: 'Cria rascunho de cobrança para revisão',
        status: 'active',
        category: 'finance',
        icon: 'FileText',
        allowedRoutes: ['/financeiro', '/pacientes', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'create_transaction',
        name: 'Registrar Transação',
        description: 'Registra uma nova transação financeira',
        status: 'untested',
        category: 'finance',
        icon: 'DollarSign',
        allowedRoutes: ['/financeiro', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'high',
    },

    // ── Documents ───────────────────────────────────────────────────────
    {
        id: 'draft_email',
        name: 'Redigir Email',
        description: 'Cria rascunho de email para revisão',
        status: 'active',
        category: 'documents',
        icon: 'Mail',
        allowedRoutes: ['/pacientes', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'draft_official_document',
        name: 'Documento Oficial',
        description: 'Gera atestado, laudo ou parecer',
        status: 'active',
        category: 'documents',
        icon: 'FileCheck',
        allowedRoutes: ['/pacientes', '/notas', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
    {
        id: 'generate_document',
        name: 'Gerar Documento',
        description: 'Gera documento clínico em PDF',
        status: 'active',
        category: 'documents',
        icon: 'FilePlus2',
        allowedRoutes: ['/pacientes', '/notas', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },

    // ── Knowledge ───────────────────────────────────────────────────────
    {
        id: 'search_cid10',
        name: 'Buscar CID-10',
        description: 'Busca classificações no CID-10',
        status: 'untested',
        category: 'knowledge',
        icon: 'BookOpen',
        allowedRoutes: ['/pacientes', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'low',
    },
    {
        id: 'get_medication_info',
        name: 'Info Medicamentos',
        description: 'Consulta informações sobre medicamentos',
        status: 'untested',
        category: 'knowledge',
        icon: 'Pill',
        allowedRoutes: ['/pacientes', '/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'low',
    },
    {
        id: 'search_normative_docs',
        name: 'Normas CFP',
        description: 'Busca normativas do Conselho Federal de Psicologia',
        status: 'untested',
        category: 'knowledge',
        icon: 'Scale',
        allowedRoutes: ['/synapse-ai'],
        hiddenInProduction: true,
        riskLevel: 'low',
    },

    // ── Communication ───────────────────────────────────────────────────
    {
        id: 'send_email',
        name: 'Enviar Email',
        description: 'Envia email via Gmail conectado',
        status: 'active',
        category: 'communication',
        icon: 'Send',
        allowedRoutes: ['/pacientes', '/synapse-ai'],
        hiddenInProduction: false,
        riskLevel: 'medium',
    },

    // ── Navigation ──────────────────────────────────────────────────────
    {
        id: 'navigate_system',
        name: 'Navegar',
        description: 'Navega para uma página do sistema',
        status: 'active',
        category: 'navigation',
        icon: 'ExternalLink',
        allowedRoutes: ['*'],
        hiddenInProduction: false,
        riskLevel: 'low',
    },
];

/**
 * Returns tools available for the given route, respecting production visibility.
 */
const isToolAvailableOnRoute = (tool: SynapseTool, pathname: string) =>
    tool.allowedRoutes.some((route) => route === '*' || pathname === route || pathname.startsWith(`${route}/`));

export const resolveSynapseToolPolicy = (
    tool: SynapseTool,
): ResolvedSynapseTool => {
    const requiresConfirmation = tool.requiresConfirmation ??
        tool.riskLevel !== 'low';
    const voiceAvailability = tool.voiceAvailability ?? (
        /^delete_/i.test(tool.id) || /(pix|payout|refund|reembolso)/i.test(tool.id)
            ? 'blocked'
            : requiresConfirmation
            ? 'confirmation'
            : 'direct'
    );
    const executor = tool.executor ?? (
        tool.category === 'navigation' ? 'interface' : requiresConfirmation ? 'mutation' : 'read'
    );
    return { ...tool, requiresConfirmation, voiceAvailability, executor };
};

export function getToolsForRoute(pathname: string): ResolvedSynapseTool[] {
    return SYNAPSE_TOOLS.filter((tool) => {
        // Hide tools flagged for production-only visibility
        if (tool.hiddenInProduction && !IS_DEV) return false;
        return isToolAvailableOnRoute(tool, pathname);
    }).map(resolveSynapseToolPolicy);
}

/**
 * Returns quick-action tools (active + low risk) for compact panel chips.
 */
export function getQuickActionsForRoute(
    pathname: string,
): ResolvedSynapseTool[] {
    return getToolsForRoute(pathname).filter(
        (t) => t.status === 'active' && t.riskLevel === 'low',
    );
}

/**
 * Returns count of available tools for the current route.
 */
export function getToolCountForRoute(pathname: string): number {
    return getToolsForRoute(pathname).length;
}
