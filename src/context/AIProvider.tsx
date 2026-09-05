import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { AIContext } from './AIContext';

export const AIProvider = ({ children }: { children: ReactNode }) => {
  const [currentContext, setCurrentContext] = useState<string>('dashboard');
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [routeContextSummary, setRouteContextSummary] = useState<string>('');
  const [surfaceContextSummary, setSurfaceContextSummary] = useState<string>('');

  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    setSurfaceContextSummary('');

    // ── Patient Profile (individual) ──────────────────────────────
    if (path.includes('/pacientes/')) {
      const id = path.split('/pacientes/')[1];
      if (id) {
        setActivePatientId(id);
        setCurrentContext('patient-profile');
        setRouteContextSummary(`O usuário está visualizando o prontuário do paciente (ID: ${id}). Responda perguntas focadas neste paciente. Ações possíveis: consultar histórico clínico, criar nota de sessão, gerar documento, agendar consulta e enviar email.`);
        return;
      }
    }

    // ── Patients list ──────────────────────────────────────────────
    if (path === '/pacientes') {
      setCurrentContext('patients');
      setActivePatientId(null);
      setRouteContextSummary('O usuário está na lista de pacientes. Ações possíveis: listar pacientes, buscar paciente por nome, ver relatório geral, cadastrar novo paciente e navegar para perfil específico.');
      return;
    }

    // ── Teleconsulta ──────────────────────────────────────────────
    if (path.includes('/teleconsulta')) {
      setCurrentContext('session');
      setRouteContextSummary('O usuário está em uma sessão de teleconsulta ativa ou na sala de espera. Foco em suporte clínico em tempo real.');
      return;
    }

    // ── Financeiro ────────────────────────────────────────────────
    if (path.includes('/financeiro')) {
      setCurrentContext('finance');
      setActivePatientId(null);
      setRouteContextSummary('O usuário está no painel financeiro da NeuroNex. Ações possíveis: consultar gestão financeira e NeuroFinance, listar transações, preparar cobranças, registrar receita/despesa e analisar fluxo de caixa, respeitando as confirmações exigidas para ações sensíveis.');
      return;
    }

    // ── Agenda ────────────────────────────────────────────────────
    if (path.includes('/agenda')) {
      setCurrentContext('calendar');
      setActivePatientId(null);
      setRouteContextSummary('O usuário está gerenciando a agenda. Ações possíveis: ver agenda do dia/semana, buscar horários disponíveis, agendar consulta, reagendar e cancelar compromissos.');
      return;
    }

    // ── Notas ─────────────────────────────────────────────────────
    if (path.includes('/notas')) {
      setCurrentContext('notes');
      setActivePatientId(null);
      setRouteContextSummary('O usuário está no módulo de Notas e Prontuários. Ações possíveis: criar nota de sessão, gerar documento oficial (atestado, laudo, parecer), buscar histórico clínico e redigir relatórios.');
      return;
    }

    // ── Synapse AI (legacy route; shell is the primary experience) ─
    if (path.includes('/synapse-ai')) {
      setCurrentContext('synapse');
      setActivePatientId(null);
      setRouteContextSummary('O usuário está na rota legada do Synapse. O Synapse global é a experiência principal de conversa e execução.');
      return;
    }

    // ── Home (default) ────────────────────────────────────────────
    setCurrentContext('dashboard');
    setActivePatientId(null);
    setRouteContextSummary('O usuário está na Home operacional da NeuroNex. Priorize contexto do dia, próxima sessão, agenda, pendências realmente acionáveis e próximos passos. Evite transformar a Home em um dashboard de métricas.');
  }, [location.pathname]);

  const contextSummary = useMemo(
    () => [routeContextSummary, surfaceContextSummary].filter(Boolean).join('\n\n'),
    [routeContextSummary, surfaceContextSummary],
  );

  const toggleFocusMode = () => setIsFocusMode((previous) => !previous);

  return (
    <AIContext.Provider value={{
      currentContext,
      activePatientId,
      isFocusMode,
      toggleFocusMode,
      contextSummary,
      setSurfaceContextSummary,
    }}>
      {children}
    </AIContext.Provider>
  );
};
