export const tools = [
  {
    functionDeclarations: [
      {
        name: "list_patients",
        description: "Lista os pacientes mais recentes ou ativos. Use quando o usuário perguntar 'quem eu atendo', 'meus pacientes', quiser uma visão geral da base, ou solicitações dentro do escopo desse contexto.",
        parameters: {
          type: "object",
          properties: { limit: { type: "number", description: "Padrão 5, máx 20" } }
        }
      },
      {
        name: "search_patients",
        description: "Busca pacientes por NOME e/ou EMAIL. Use para encontrar alguém específico quando não tiver o ID no contexto.",
        parameters: {
          type: "object",
          properties: { name_query: { type: "string" } },
          required: ["name_query"]
        }
      },
      {
        name: "report_all_patients",
        description: "Recupera TODOS os dados de TODOS os pacientes cadastrados. Use para 'listar tudo', 'visão geral completa' ou quando o usuário pedir 'todas as informações dos pacientes'.",
        parameters: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "get_patient_details",
        description: "Retorna o perfil completo (dados, contato, financeiro, risco). Use quando precisar de detalhes profundos de um paciente específico identificado.",
        parameters: {
          type: "object",
          properties: { patientId: { type: "string" } },
          required: ["patientId"]
        }
      },
      {
        name: "search_clinical_history",
        description: "Busca no prontuário/anotações. Essencial para perguntas como 'evolução do paciente', 'última sessão', 'histórico de ansiedade'. Retorna notas e resumos de IA.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string" },
            keywords: { type: "string", description: "Termos chave ex: 'ansiedade', 'sono', 'medicamento'" },
            limit: { type: "number", description: "Número de notas a analisar (padrão 5)" }
          },
          required: ["patientId"]
        }
      },
      {
        name: "generate_patient_insights",
        description: "Gera análise IA sobre evolução do paciente. Use para 'como está o progresso?', 'análise da evolução', 'resumo clínico'. Requer histórico de sessões.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string", description: "ID do paciente" },
            patientName: { type: "string", description: "Nome do paciente" },
            focusArea: { type: "string", description: "Área de foco: 'geral', 'ansiedade', 'sono', 'medicação', 'progresso'" }
          },
          required: ["patientId"]
        }
      },
      {
        name: "suggest_treatment_approach",
        description: "Sugere abordagens terapêuticas baseadas em evidências. Use para 'que técnica usar?', 'sugestões para tratamento', 'exercícios recomendados'. Apenas sugestões, decisão final é do terapeuta.",
        parameters: {
          type: "object",
          properties: {
            condition: { type: "string", description: "Condição/diagnóstico (ex: TAG, Depressão, TEPT)" },
            patientId: { type: "string", description: "ID do paciente para contexto (opcional)" },
            approach: { type: "string", enum: ["TCC", "Psicodinâmica", "Humanista", "Geral"], description: "Abordagem preferida" }
          },
          required: ["condition"]
        }
      },
      {
        name: "detect_risk_patterns",
        description: "Detecta pacientes em risco ou que precisam atenção. Use para 'quem precisa de atenção?', 'pacientes em risco', 'ausências frequentes'.",
        parameters: {
          type: "object",
          properties: {
            riskType: { type: "string", enum: ["inactivity", "no_show", "high_risk", "all"], description: "Tipo de risco a detectar" },
            daysThreshold: { type: "number", description: "Dias de inatividade para considerar (padrão: 30)" }
          }
        }
      },
      {
        name: "get_calendar",
        description: "Visualiza a agenda de compromissos. Use para 'tenho horário livre?', 'minha agenda hoje', 'próxima sessão'. Datas devem ser ISO (YYYY-MM-DD).",
        parameters: {
          type: "object",
          properties: {
            startDate: { type: "string" },
            endDate: { type: "string" }
          },
          required: ["startDate", "endDate"]
        }
      },
      {
        name: "create_appointment",
        description: "Agenda uma nova sessão ou bloqueio. Sempre confirme os dados antes de chamar.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string" },
            datetime: { type: "string", description: "Data/hora local de Brasília SEM offset de fuso (ex: 2024-10-05T14:00:00). O servidor adicionará o fuso -03:00 automaticamente." },
            duration: { type: "number", description: "Minutos" },
            type: { type: "string", enum: ["presencial", "online", "block"] },
            notes: { type: "string" },
            location: { type: "string" },
            frequency: { type: "string", enum: ["single", "weekly", "biweekly", "monthly"] },
            occurrenceCount: { type: "integer", minimum: 1, maximum: 500 },
            recurrenceKind: { type: "string", enum: ["weekly", "monthly", "interval", "custom_dates", "range_distribution"] },
            interval: { type: "integer", minimum: 1, maximum: 365 },
            weekDays: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
            monthDays: { type: "array", items: { type: "integer", minimum: 1, maximum: 31 } },
            customDates: { type: "array", items: { type: "string" } },
            terminationKind: { type: "string", enum: ["count", "until", "open"] },
            untilDate: { type: "string" },
            distributionUntilDate: { type: "string" },
            overrides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  occurrenceNumber: { type: "integer", minimum: 1, maximum: 500 },
                  date: { type: "string" },
                  startTime: { type: "string" },
                  durationMinutes: { type: "integer", minimum: 15, maximum: 240 },
                  modality: { type: "string", enum: ["presencial", "online"] },
                  location: { type: "string" },
                  reason: { type: "string" }
                },
                required: ["occurrenceNumber"]
              }
            }
          },
          required: ["datetime"]
        }
      },
      {
        name: "reschedule_appointment",
        description: "Remarca uma consulta existente para nova data/hora. Use para 'remarque a sessão', 'mude para outro horário'. Confirme antes.",
        parameters: {
          type: "object",
          properties: {
            appointmentId: { type: "string", description: "ID da consulta a remarcar" },
            patientName: { type: "string", description: "Nome do paciente (para confirmação)" },
            newDatetime: { type: "string", description: "Nova data/hora local de Brasília SEM offset (ex: 2024-10-05T14:00:00). O servidor adicionará -03:00." },
            newDuration: { type: "number", description: "Nova duração em minutos (opcional)" },
            notifyPatient: { type: "boolean", description: "Notificar paciente via WhatsApp (padrão: true)" }
          },
          required: ["appointmentId", "newDatetime"]
        }
      },
      {
        name: "cancel_appointment",
        description: "Cancela uma consulta agendada. Use para 'cancele a sessão', 'desmarque a consulta'. Confirme antes de cancelar.",
        parameters: {
          type: "object",
          properties: {
            appointmentId: { type: "string", description: "ID da consulta a cancelar" },
            patientName: { type: "string", description: "Nome do paciente (para confirmação)" },
            reason: { type: "string", description: "Motivo do cancelamento" },
            notifyPatient: { type: "boolean", description: "Notificar paciente via WhatsApp (padrão: true)" }
          },
          required: ["appointmentId"]
        }
      },
      {
        name: "get_latest_scientific_updates",
        description: "Recupera as últimas atualizações científicas (artigos, repositórios) curadas automaticamente. Use para 'quais as novidades de hoje?', 'atualizações da neurociência'.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "number", description: "Número de itens a retornar (padrão 5)" },
            source: { type: "string", enum: ["all", "github", "arxiv"], description: "Filtrar por fonte (opcional)" }
          }
        }
      },
      {
        name: "search_normative_docs",
        description: "Busca na base de leis e normas (CFP, Código de Ética) por regras específicas. Use para 'o que a resolução 006 diz sobre laudos?', 'regras para guardar prontuários'.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Dúvida ou termo jurídico/normativo" },
            limit: { type: "number", description: "Número de trechos (padrão 3)" }
          },
          required: ["query"]
        }
      },
      {
        name: "draft_official_document",
        description: "Gera minuta de documento oficial (Laudo, Parecer) com base em normas e dados do paciente. REVISÃO OBRIGATÓRIA.",
        parameters: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["laudo", "parecer", "atestado", "declaracao", "relatorio"], description: "Tipo de documento" },
            patientId: { type: "string", description: "ID do paciente" },
            demand: { type: "string", description: "Demanda/Motivo (ex: 'Avaliação para Cirurgia Bariátrica')" },
            recipients: { type: "string", description: "Destinatários (ex: 'Ao médico solicitante')" }
          },
          required: ["type", "patientId", "demand"]
        }
      },
      {
        name: "search_medical_articles",
        description: "Busca artigos científicos e estudos clínicos no PubMed. Use para 'pesquise sobre TCC para insônia', 'artigos recentes sobre burnout'. Retorna resumos.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Termos da busca em inglês (serão traduzidos se necessário)" },
            limit: { type: "number", description: "Número de artigos (padrão: 3)" }
          },
          required: ["query"]
        }
      },
      {
        name: "search_cid10",
        description: "Busca códigos e descrições na tabela CID-10. Use para 'qual o CID de ansiedade?', 'código F41'.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Nome da doença ou código CID" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_medication_info",
        description: "Busca informações detalhadas sobre medicamentos (bula, interações, posologia). Use para 'efeitos da Sertralina', 'interação fluoxetina e álcool'.",
        parameters: {
          type: "object",
          properties: {
            medicationName: { type: "string", description: "Nome do medicamento" },
            queryType: { type: "string", enum: ["general", "interactions", "dosage", "side_effects"], description: "Tipo de informação desejada" }
          },
          required: ["medicationName"]
        }
      },
      {
        name: "find_available_slots",
        description: "Encontra horários livres na agenda. Use para 'quando tenho vaga?', 'horários disponíveis', 'encaixe o paciente'.",
        parameters: {
          type: "object",
          properties: {
            startDate: { type: "string", description: "Data inicial ISO (YYYY-MM-DD)" },
            endDate: { type: "string", description: "Data final ISO (YYYY-MM-DD)" },
            duration: { type: "number", description: "Duração desejada em minutos (padrão: 50)" },
            preferredTime: { type: "string", enum: ["morning", "afternoon", "evening"], description: "Preferência de horário" }
          },
          required: ["startDate"]
        }
      },
      {
        name: "get_financial_metrics",
        description: "Retorna o resumo financeiro do mês atual (receita, despesas, lucro, projeção). Use para perguntas sobre 'faturamento', 'caixa' ou 'desempenho'.",
        parameters: { type: "object", properties: {} }
      },
      {
        name: "list_transactions",
        description: "Lista as últimas transações financeiras. Útil para 'últimos pagamentos', 'gastos recentes'.",
        parameters: {
          type: "object",
          properties: { limit: { type: "number" } }
        }
      },
      {
        name: "create_transaction",
        description: "Registra uma nova transação financeira (receita ou despesa). Use para 'recebi 200 do Jefferson', 'paguei conta de luz'.",
        parameters: {
          type: "object",
          properties: {
            description: { type: "string", description: "Descrição da transação" },
            amount: { type: "number", description: "Valor (positivo para receita, pode ser negativo para despesa ou marcado pelo tipo)" },
            type: { type: "string", enum: ["income", "expense"], description: "Tipo da transação" },
            category: { type: "string", description: "Categoria (ex: Consulta, Aluguel, Internet)" },
            patientId: { type: "string", description: "ID do paciente relacionado (opcional)" },
            date: { type: "string", description: "Data da transação (ISO YYYY-MM-DD), padrão hoje" }
          },
          required: ["description", "amount", "type"]
        }
      },
      {
        name: "generate_financial_report",
        description: "Gera um relatório financeiro detalhado por período. Use para 'relatório do mês passado', 'balanço anual', 'quanto gastei com aluguel?'.",
        parameters: {
          type: "object",
          properties: {
            startDate: { type: "string", description: "Data inicial (YYYY-MM-DD)" },
            endDate: { type: "string", description: "Data final (YYYY-MM-DD)" },
            type: { type: "string", enum: ["income", "expense", "all"], description: "Filtrar por tipo (opcional)" },
            category: { type: "string", description: "Filtrar por categoria específica (opcional)" }
          },
          required: ["startDate"]
        }
      },
      {
        name: "send_payment_reminder",
        description: "Envia lembrete de pagamento para pacientes com pendências. Use para 'cobre o Jefferson', 'lembrete de pagamento'.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string", description: "ID do paciente" },
            patientName: { type: "string", description: "Nome do paciente (para confirmação)" },
            amount: { type: "number", description: "Valor devido" },
            dueDate: { type: "string", description: "Data de vencimento (opcional)" }
          },
          required: ["patientId", "amount"]
        }
      },
      {
        name: "draft_invoice",
        description: "Gera um widget visual de cobrança (fatura) para o paciente confirmar. Não envia, apenas prepara.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string" },
            patientName: { type: "string" },
            amount: { type: "number" },
            description: { type: "string" },
            dueDate: { type: "string" }
          },
          required: ["amount"]
        }
      },
      {
        name: "generate_document",
        description: "Gera documentos oficiais (Atestados, Laudos) preenchidos. Retorna um preview visual.",
        parameters: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["Atestado", "Declaração", "Laudo", "Encaminhamento"] },
            title: { type: "string" },
            content_html: { type: "string", description: "Conteúdo do documento em HTML simples." },
            patientName: { type: "string" }
          },
          required: ["type", "title", "content_html", "patientName"]
        }
      },
      {
        name: "draft_email",
        description: "Cria um rascunho de e-mail para o paciente. Útil para 'enviar lembrete', 'mandar materiais'.",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" },
            patientName: { type: "string" }
          },
          required: ["to", "subject", "body"]
        }
      },
      {
        name: "create_patient",
        description: "Cria um novo paciente no sistema. Use quando o usuário pedir para 'cadastrar', 'adicionar' ou 'criar' um novo paciente. Pergunte sempre os dados obrigatórios se faltarem.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            cpf: { type: "string" },
            diagnosis: { type: "string" },
            notes: { type: "string" },
            birth_date: { type: "string", description: "YYYY-MM-DD" },
            address: { type: "string" },
            emergency_name: { type: "string" },
            emergency_phone: { type: "string" },
            payer_type: { type: "string", enum: ["patient", "other"] },
            payer_name: { type: "string" },
            payer_cpf: { type: "string" },
            medications: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  dosage: { type: "string" },
                  frequency: { type: "string" }
                }
              }
            }
          },
          required: ["name"]
        }
      },
      {
        name: "send_whatsapp_message",
        description: "Envia uma mensagem WhatsApp para um paciente. O paciente DEVE ter um número de telefone cadastrado e uma conversa existente. Use para 'mande mensagem pro Jefferson', 'avise Maria sobre consulta'. Confirme antes de enviar.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string", description: "ID do paciente para enviar a mensagem" },
            patientName: { type: "string", description: "Nome do paciente (para confirmação)" },
            patientPhone: { type: "string", description: "Telefone do paciente no formato 5511999998888" },
            message: { type: "string", description: "Conteúdo da mensagem a enviar" }
          },
          required: ["patientId", "message"]
        }
      },
      {
        name: "read_whatsapp_conversations",
        description: "Lista as últimas conversas de WhatsApp com pacientes. Use para 'quem me mandou mensagem?', 'conversas recentes', 'última mensagem de Maria'.",
        parameters: {
          type: "object",
          properties: {
            patientName: { type: "string", description: "Filtrar por nome do paciente (opcional)" },
            limit: { type: "number", description: "Limite de conversas (padrão 5)" }
          }
        }
      },
      {
        name: "send_email",
        description: "Envia um email real via Gmail (não apenas rascunho). O paciente DEVE ter um email cadastrado. Confirme conteúdo antes de enviar.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string", description: "ID do paciente (para buscar email)" },
            to: { type: "string", description: "Email do destinatário" },
            subject: { type: "string", description: "Assunto do email" },
            body: { type: "string", description: "Corpo do email em HTML" },
            patientName: { type: "string", description: "Nome do paciente (para personalização)" }
          },
          required: ["to", "subject", "body"]
        }
      },
      {
        name: "create_session_note",
        description: "Cria uma anotação/nota de sessão para um paciente. Use quando o usuário disser 'anote isso', 'registre que...', 'adicionar ao prontuário'. Sempre associe a um paciente.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string", description: "ID do paciente" },
            patientName: { type: "string", description: "Nome do paciente (para contexto)" },
            notes: { type: "string", description: "Conteúdo da anotação" },
            appointmentId: { type: "string", description: "ID da consulta relacionada (opcional)" }
          },
          required: ["patientId", "notes"]
        }
      },
      {
        name: "update_patient_info",
        description: "Atualiza informações de um paciente existente. Use para 'mude o telefone', 'atualize o diagnóstico', 'altere o endereço'. Confirme as mudanças antes.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string", description: "ID do paciente a atualizar" },
            patientName: { type: "string", description: "Nome do paciente (para confirmação)" },
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            diagnosis: { type: "string" },
            notes: { type: "string" },
            address: { type: "string" },
            birth_date: { type: "string", description: "YYYY-MM-DD" },
            emergency_contact: { type: "string" },
            status: { type: "string", enum: ["active", "pending", "inactive"] }
          },
          required: ["patientId"]
        }
      },
      {
        name: "add_patient_medication",
        description: "Adiciona ou atualiza uma medicação no prontuário do paciente. Use para 'Jefferson começou Sertralina', 'adicione medicamento'.",
        parameters: {
          type: "object",
          properties: {
            patientId: { type: "string", description: "ID do paciente" },
            patientName: { type: "string", description: "Nome do paciente" },
            medicationName: { type: "string", description: "Nome do medicamento" },
            dosage: { type: "string", description: "Dosagem (ex: 50mg)" },
            frequency: { type: "string", description: "Frequência (ex: 1x ao dia)" },
            action: { type: "string", enum: ["add", "remove", "update"], description: "Ação a realizar" }
          },
          required: ["patientId", "medicationName"]
        }
      },
      {
        name: "navigate_system",
        description: "Navega o usuário para uma tela específica do sistema.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Ex: /agenda, /financeiro, /pacientes/ID" },
            reason: { type: "string" }
          },
          required: ["path"]
        }
      }
    ]
  }
];
