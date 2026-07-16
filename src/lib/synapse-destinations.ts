export const SYNAPSE_DESTINATIONS = [
  "dashboard.overview",
  "dashboard.agenda",
  "dashboard.finance",
  "dashboard.pending",
  "agenda.day",
  "agenda.week",
  "agenda.month",
  "agenda.new-appointment",
  "patients.directory",
  "patients.new",
  "patient.summary",
  "patient.sessions.history",
  "patient.sessions.pending",
  "patient.anamnesis",
  "patient.mood",
  "patient.goals",
  "patient.packages",
  "patient.finance",
  "patient.documents",
  "notes.notes",
  "notes.new",
  "notes.tasks",
  "notes.files.personal",
  "notes.files.patients",
  "notes.notion",
  "notes.neuroview",
  "notes.neuroflow",
  "notes.neuropulse",
  "finance.gestao-visao-geral",
  "finance.gestao-lancamentos",
  "finance.gestao-cobrancas",
  "finance.gestao-recebimentos",
  "finance.gestao-planejamento",
  "finance.conta-digital",
  "finance.pix-pagar",
  "finance.pix-transferir",
  "finance.pix-qrcode",
  "finance.pix-receber.recebidos",
  "finance.pix-receber.cobrancas",
  "finance.pix-chaves",
  "finance.pix-salarios",
  "finance.pix-limites",
  "finance.extrato.realizado",
  "finance.extrato.futuro",
  "finance.extrato.assinaturas",
  "finance.cobrancas-historia",
  "finance.cobrancas-simulador",
  "finance.cobrancas-config",
  "finance.cobrancas-chargebacks",
  "finance.pagamentos-boletos",
  "finance.pagamentos-agendados",
  "finance.pagamentos-agendar",
  "finance.pagamentos-grupos",
  "finance.antecipacoes-lista",
  "finance.antecipacoes-solicitar",
  "finance.antecipacoes-automatica",
  "finance.transferencias",
  "finance.contas-bancarias",
  "finance.fiscal-dados",
  "finance.fiscal-nova",
  "finance.fiscal-lista",
  "finance.tarifas",
  "finance.saude-conta",
  "finance.new-transaction",
  "finance.new-charge",
  "teleconsultation.overview",
  "teleconsultation.lobby",
  "teleconsultation.invite",
  "teleconsultation.transcript",
  "teleconsultation.notes",
  "teleconsultation.patient",
  "settings.profile",
  "settings.security",
  "settings.subscription",
  "settings.preferences",
  "settings.notifications",
  "settings.communication",
  "settings.neurofinance",
  "settings.integrations",
  "settings.fiscal",
  "settings.data-control",
  "neurozap.overview",
  "neurozap.connection",
  "synapse.chat",
  "global.search",
] as const;

export type SynapseDestination = (typeof SYNAPSE_DESTINATIONS)[number];

export interface SynapseDestinationContext {
  patientId?: string;
  appointmentId?: string;
  date?: string;
}

export interface SynapseDestinationNavigation {
  path?: string;
  state?: Record<string, unknown>;
  selector?: string;
  pageAction?: Record<string, unknown>;
  requires?: "patient" | "appointment";
}

const destinationSet = new Set<string>(SYNAPSE_DESTINATIONS);

export const safeSynapseDestination = (value: unknown): SynapseDestination | undefined =>
  typeof value === "string" && destinationSet.has(value)
    ? value as SynapseDestination
    : undefined;

const patientTabNavigation = (
  destination: SynapseDestination,
  patientId?: string,
): SynapseDestinationNavigation => {
  if (!patientId) return { requires: "patient" };

  const tabByDestination: Partial<Record<SynapseDestination, string>> = {
    "patient.summary": "summary",
    "patient.sessions.history": "sessions",
    "patient.sessions.pending": "sessions",
    "patient.anamnesis": "anamnesis",
    "patient.mood": "mood",
    "patient.goals": "goals",
    "patient.packages": "packages",
    "patient.finance": "finance",
    "patient.documents": "documents",
  };
  const tab = tabByDestination[destination] || "summary";
  const query = new URLSearchParams({ tab });
  if (destination === "patient.sessions.history") query.set("sessionView", "history");
  if (destination === "patient.sessions.pending") query.set("sessionView", "pending");

  return {
    path: `/pacientes/${encodeURIComponent(patientId)}?${query.toString()}`,
    selector: `#patient-record-panel-${tab}`,
  };
};

const notesNavigation = (destination: SynapseDestination): SynapseDestinationNavigation => {
  const viewByDestination: Partial<Record<SynapseDestination, string>> = {
    "notes.notes": "notes",
    "notes.new": "notes",
    "notes.tasks": "tasks",
    "notes.files.personal": "files",
    "notes.files.patients": "files",
    "notes.notion": "notion",
    "notes.neuroview": "neuroview",
    "notes.neuroflow": "neuroflow",
    "notes.neuropulse": "neuropulse",
  };
  const notesView = viewByDestination[destination] || "notes";
  const action = destination === "notes.new"
    ? "open_new_note"
    : destination === "notes.tasks"
      ? "open_tasks_board"
      : destination.startsWith("notes.files")
        ? "open_files_manager"
        : destination === "notes.notion"
          ? "open_notion_panel"
          : destination === "notes.neuroview"
            ? "open_neuroview_reasoning"
            : destination === "notes.neuroflow"
              ? "open_neuroflow_generation"
              : destination === "notes.neuropulse"
                ? "open_neuropulse_diagram"
                : "switch_notes_view";
  const filesTab = destination === "notes.files.patients"
    ? "patients"
    : destination === "notes.files.personal"
      ? "personal"
      : undefined;
  const selectorByView: Record<string, string> = {
    notes: "[data-synapse-target='notes-editor']",
    tasks: "[data-synapse-target='tasks-board']",
    files: "[data-synapse-target='files-manager']",
    notion: "[data-synapse-target='notion-panel']",
    neuroview: "[data-synapse-target='neuroview-graph'][data-synapse-ready='true']",
    neuroflow: "[data-synapse-target='neuroflow-canvas'][data-synapse-ready='true']",
    neuropulse: "[data-synapse-target='neuropulse-panel'][data-synapse-ready='true']",
  };

  return {
    path: "/notas",
    state: {
      synapseAction: action,
      synapseNotesView: notesView,
      synapseFilesTab: filesTab,
      synapseDestination: destination,
    },
    selector: selectorByView[notesView],
    pageAction: { action, notesView, filesTab },
  };
};

const financeNavigation = (destination: SynapseDestination): SynapseDestinationNavigation => {
  if (destination === "finance.new-transaction") {
    return {
      path: "/financeiro?view=gestao-visao-geral",
      selector: "[data-synapse-target='new-transaction-modal']",
      pageAction: { action: "open_modal", modal: "new_transaction" },
    };
  }
  if (destination === "finance.new-charge") {
    return {
      path: "/financeiro?view=gestao-cobrancas",
      selector: "[data-synapse-target='new-charge-modal']",
      pageAction: { action: "open_modal", modal: "new_charge" },
    };
  }

  let view = destination.slice("finance.".length);
  let subview: string | undefined;
  if (view.startsWith("extrato.")) {
    [, subview] = view.split(".");
    view = "extrato";
  } else if (view.startsWith("pix-receber.")) {
    view = "extrato";
    subview = "realizado";
  } else if (view.startsWith("antecipacoes")) {
    view = "antecipacoes-solicitar";
  }

  const query = new URLSearchParams({ view });
  if (subview) query.set("subview", subview);
  if (destination.startsWith("finance.pix-receber.")) query.set("filter", "pix-recebidos");
  return {
    path: `/financeiro?${query.toString()}`,
    selector: `[data-synapse-target='finance-workspace'][data-synapse-finance-view='${view}']`,
  };
};

export function resolveSynapseDestination(
  destination: SynapseDestination,
  context: SynapseDestinationContext = {},
): SynapseDestinationNavigation {
  if (destination.startsWith("patient.")) {
    return patientTabNavigation(destination, context.patientId);
  }
  if (destination.startsWith("notes.")) return notesNavigation(destination);
  if (destination.startsWith("finance.")) return financeNavigation(destination);

  if (destination.startsWith("dashboard.")) {
    const selectorByDestination: Partial<Record<SynapseDestination, string>> = {
      "dashboard.overview": "main",
      "dashboard.agenda": "[data-synapse-target='dashboard-agenda']",
      "dashboard.finance": "[data-synapse-target='dashboard-finance']",
      "dashboard.pending": "[data-synapse-target='dashboard-pending']",
    };
    return { path: "/dashboard", selector: selectorByDestination[destination] };
  }

  if (destination.startsWith("agenda.")) {
    if (destination === "agenda.new-appointment") {
      return {
        path: "/agenda",
        state: { synapseDestination: destination, synapseDate: context.date },
        selector: "[data-synapse-target='new-appointment-modal']",
        pageAction: { action: "open_modal", modal: "new_appointment", date: context.date },
      };
    }
    const view = destination === "agenda.day" ? "daily" : destination === "agenda.month" ? "monthly" : "weekly";
    return {
      path: "/agenda",
      state: { synapseDestination: destination, synapseView: view, synapseDate: context.date },
      selector: "[data-synapse-target='daily-schedule']",
      pageAction: { action: "open_daily_schedule", agendaView: view, date: context.date },
    };
  }

  if (destination === "patients.directory") {
    return { path: "/pacientes", selector: "[data-synapse-target='patients-grid']" };
  }
  if (destination === "patients.new") {
    return {
      path: "/pacientes",
      state: { synapseDestination: destination },
      selector: "[data-synapse-target='new-patient-modal']",
      pageAction: { action: "open_modal", modal: "new_patient" },
    };
  }

  if (destination.startsWith("teleconsultation.")) {
    if (destination !== "teleconsultation.overview" && !context.appointmentId) {
      return { requires: "appointment" };
    }
    const workspaceTab = destination === "teleconsultation.notes"
      ? "notes"
      : destination === "teleconsultation.patient"
        ? "patient"
        : destination === "teleconsultation.transcript"
          ? "transcript"
          : undefined;
    const action = destination === "teleconsultation.invite"
      ? "open_patient_invite_modal"
      : destination === "teleconsultation.overview"
        ? "navigate"
        : "open_teleconsultation_lobby";
    return {
      path: "/teleconsulta",
      state: {
        activeAppointmentId: context.appointmentId,
        openInvite: destination === "teleconsultation.invite",
        synapseWorkspaceTab: workspaceTab,
        synapseDestination: destination,
      },
      selector: workspaceTab
        ? `[data-synapse-target='teleconsultation-workspace-${workspaceTab}']`
        : destination === "teleconsultation.invite"
          ? "[data-synapse-target='patient-invite']"
          : undefined,
      pageAction: { action, workspaceTab },
    };
  }

  if (destination.startsWith("settings.")) {
    const tabByDestination: Partial<Record<SynapseDestination, string>> = {
      "settings.profile": "profile",
      "settings.security": "security",
      "settings.subscription": "subscription",
      "settings.preferences": "prefs",
      "settings.notifications": "notifications",
      "settings.communication": "communication",
      "settings.neurofinance": "payments",
      "settings.integrations": "integrations",
      "settings.fiscal": "fiscal",
      "settings.data-control": "data-control",
    };
    const tab = tabByDestination[destination] || "profile";
    return {
      path: `/ajustes?tab=${encodeURIComponent(tab)}`,
      selector: `[data-settings-value='${tab}']`,
    };
  }

  if (destination === "neurozap.connection") {
    return {
      path: "/neurozap",
      state: { synapseDestination: destination },
      selector: "[data-synapse-target='neurozap-connection']",
      pageAction: { action: "navigate", destination },
    };
  }
  if (destination === "neurozap.overview") {
    return { path: "/neurozap", selector: "[data-synapse-target='neurozap-overview']" };
  }
  if (destination === "synapse.chat") return { path: "/synapse-ai" };
  if (destination === "global.search") {
    return {
      selector: "[data-synapse-target='global-search-dialog']",
      pageAction: { action: "navigate", destination },
    };
  }

  return {};
}
