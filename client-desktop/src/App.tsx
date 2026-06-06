import { useEffect, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardCopy,
  Database,
  Download,
  FileCode2,
  FileDown,
  FilePieChart,
  FileText,
  GitBranch,
  LayoutDashboard,
  Layers,
  LineChart,
  Network,
  PieChart,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Target,
  UploadCloud,
  X,
  type LucideIcon,
} from 'lucide-react';

type ViewId = 'dashboard' | 'documents' | 'search' | 'rag' | 'analysis' | 'governance' | 'agents' | 'observability';
type ObsTab = 'evaluation' | 'history' | 'events';

type DocumentRecord = {
  id: string;
  name: string;
  status: string;
  summary?: string | null;
  actionItems: number;
  createdAt?: string;
  updatedAt?: string;
  processingVersionId?: string;
  sourceHash?: string;
  error?: string | null;
  lastCheckedAt?: string;
};

type AutoContext = {
  id: string;
  label: string;
  description?: string;
  document_count?: number;
  documentCount?: number;
  processed_count?: number;
  processedCount?: number;
  topics?: string[];
  entities?: string[];
  documents?: Array<{
    document_id?: string;
    documentId?: string;
    source_hash?: string;
    sourceHash?: string;
    status?: string;
    summary?: string | null;
  }>;
};

type AgentRun = {
  id: string;
  goal?: string;
  status?: string;
  requested_tool?: string;
  requestedTool?: string;
  tool_risk?: string;
  toolRisk?: string;
  plan?: unknown;
  result?: unknown;
  approval_required?: boolean;
  approved_by?: string | null;
  approvedBy?: string | null;
};

type AgentTool = {
  name: string;
  risk?: string;
  description?: string;
};

type Toast = {
  title: string;
  tone?: 'success' | 'warning' | 'danger';
};

type HealthResult = {
  ok: boolean;
  baseUrl?: string;
  value?: unknown;
  error?: string;
};

type QuerySession = {
  query: string;
  result: any;
  createdAt: string;
};

type AnalysisReportRecord = {
  id?: string;
  title: string;
  scope_label?: string | null;
  document_ids?: string[];
  search_queries?: string[];
  rag_queries?: string[];
  executive_summary?: string;
  evidence?: unknown;
  metrics?: unknown;
  risks?: unknown;
  sources?: unknown;
  markdown?: string;
  created_at?: string;
};

type AnalysisCoverage = {
  documents: number;
  ragQueries: number;
  searchQueries: number;
  conclusions: number;
  evidence: number;
  metrics: number;
  sources: number;
  quality: number;
};

type AnalysisChartDatum = {
  label: string;
  value: number;
  detail?: string;
};

type AnalysisReportBuild = {
  title: string;
  executive: string;
  conclusions: string[];
  evidence: string[];
  metrics: string[];
  attention: string[];
  sources: string[];
  coverage: AnalysisCoverage;
  topics: AnalysisChartDatum[];
  mix: AnalysisChartDatum[];
  qualitySeries: AnalysisChartDatum[];
  markdown: string;
};

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard, group: 'Plataforma' },
  { id: 'documents' as const, label: 'Documentos', icon: FileText, group: 'Plataforma' },
  { id: 'search' as const, label: 'Busca Hibrida', icon: Search, group: 'Plataforma' },
  { id: 'rag' as const, label: 'RAG', icon: BrainCircuit, group: 'Plataforma' },
  { id: 'analysis' as const, label: 'Analise', icon: FilePieChart, group: 'Plataforma' },
  { id: 'governance' as const, label: 'Governanca', icon: ShieldCheck, group: 'Seguranca & Ops' },
  { id: 'agents' as const, label: 'Agentes', icon: Bot, group: 'Seguranca & Ops' },
  { id: 'observability' as const, label: 'Observabilidade', icon: Activity, group: 'Seguranca & Ops' },
];

const processingSteps = ['Upload', 'Extracao', 'Chunking', 'Embedding', 'Indexacao', 'Pronto'];

function normalizeDocument(raw: any, fallback?: Partial<DocumentRecord>): DocumentRecord {
  const rawDocumentId = raw?.document_id ?? raw?.document?.id ?? raw?.id;
  const id = fallback?.id && raw?.id && raw.id !== fallback.id && !raw?.document_id ? fallback.id : rawDocumentId ?? fallback?.id ?? '-';
  const processingVersionId = raw?.processing_version_id ?? raw?.version_id ?? (raw?.id && raw.id !== id ? raw.id : fallback?.processingVersionId);
  const sourceHash = raw?.source_hash ?? fallback?.sourceHash;
  return {
    id,
    name: fallback?.name ?? raw?.file_name ?? sourceHash ?? id ?? 'Documento',
    status: raw?.status ?? fallback?.status ?? 'Recebido',
    summary: raw?.summary_text ?? raw?.summary ?? fallback?.summary ?? null,
    actionItems: Array.isArray(raw?.action_items) ? raw.action_items.length : fallback?.actionItems ?? 0,
    createdAt: raw?.created_at ?? fallback?.createdAt,
    updatedAt: raw?.updated_at ?? fallback?.updatedAt,
    processingVersionId,
    sourceHash,
    error: null,
    lastCheckedAt: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
  };
}

function asArray(value: any) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.citations)) return value.citations;
  return [];
}

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function repairMojibake(value: string) {
  if (!/[ÃÂ]/.test(value)) return value;

  try {
    const bytes = Uint8Array.from(Array.from(value).map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (decoded && !decoded.includes('�')) return decoded;
  } catch {
    return value;
  }

  return value;
}

function cleanText(value: unknown) {
  return repairMojibake(String(value ?? ''))
    .replace(/\\n/g, '\n')
    .replace(/[ââ]/g, '"')
    .replace(/[ââ]/g, "'")
    .replace(/[ââ]/g, '-')
    .replace(/â¢/g, '-')
    .replace(/Î/g, 'Delta')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SCHEMA_ARTIFACT_MARKERS = [
  'relatorio executivo',
  'relatorio executivo gerado',
  'relatorio executivo consolidado',
  'relatorio executivo consolidado gerado',
  'schema-api-analise',
  'resumo executivo consolidado',
  'resposta executiva',
  'analise executiva',
  'analise executiva -',
  'analise executiva receita',
  'analise executiva receita liquida relator',
  'schema api - pagina',
  'schema api pagina',
  'schema api pagina de',
  'schema api.',
  'relatorios salvos',
  'base da analise',
  'fontes consideradas',
  'documentos considerados',
  'analise executiva receita liquida relator',
  'perguntas consideradas',
  'buscas consideradas',
  'qualidade observada',
  'qualidade media',
  'sintese por pergunta rag',
  'sintese por busca hibrida',
  'composicao dos insumos',
  'cobertura da analise',
  'distribuicao tematica',
  'indicadores executivos',
  'documento recuperado: contem termos',
  'revise as fontes antes',
  'relatorio salvo',
  'perguntas rag',
  'buscas hibridas',
  'gerado em',
];

function normalizeArtifactText(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isSchemaGeneratedArtifact(value: unknown) {
  const text = normalizeArtifactText(value);
  if (!text) return false;

  const explicit =
    (text.includes('schema api') || text.includes('schemaapi')) &&
    (text.includes('relatorio executivo') || text.includes('analise executiva') || text.includes('pagina'));
  const generatedReport =
    text.includes('relatorio executivo gerado em') ||
    text.includes('relatorio executivo consolidado') ||
    text.includes('relatorio executivo consolidado gerado') ||
    text.includes('schema-api-analise') ||
    text.includes('schema api - pagina') ||
    text.includes('revise as fontes antes') ||
    text.includes('perguntas consideradas') ||
    text.includes('buscas consideradas') ||
    text.includes('qualidade observada') ||
    text.includes('composicao dos insumos') ||
    text.includes('cobertura da analise') ||
    text.includes('distribuicao tematica') ||
    text.includes('indicadores executivos') ||
    text.includes('sintese por pergunta rag') ||
    text.includes('sintese por busca hibrida') ||
    text.includes('analise executiva receita liquida relator') ||
    (text.includes('analise executiva') &&
      (text.includes('perguntas rag') || text.includes('buscas hibridas') || text.includes('gerado em')));
  const hits = SCHEMA_ARTIFACT_MARKERS.filter((marker) => text.includes(marker)).length;

  return explicit || generatedReport || hits >= 2;
}

function isUsefulEvidenceText(value: unknown) {
  const text = cleanText(value);
  return text.length > 24 && !isSchemaGeneratedArtifact(text);
}

function truncate(value: unknown, max = 520) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  const sliced = text.slice(0, max).trim();
  const sentenceEnd = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf('!'), sliced.lastIndexOf('?'));
  if (sentenceEnd > max * 0.45) return sliced.slice(0, sentenceEnd + 1).trim();
  const wordEnd = sliced.lastIndexOf(' ');
  return (wordEnd > 80 ? sliced.slice(0, wordEnd) : sliced).trim();
}

function chunkText(item: any) {
  return item?.text_content ?? item?.chunk_text ?? item?.snippet ?? item?.text ?? '';
}

function chunkLooksGenerated(item: any) {
  const joined = [
    item?.section_title,
    item?.document_title,
    item?.title,
    item?.name,
    item?.snippet,
    item?.excerpt,
    item?.text_content,
    item?.chunk_text,
    item?.text,
    chunkText(item),
  ]
    .filter(Boolean)
    .join(' ');

  return isSchemaGeneratedArtifact(joined);
}

function chunkSection(item: any) {
  return item?.section_title ?? item?.section ?? 'Secao nao informada';
}

function chunkScore(item: any) {
  const score = Number(item?.score ?? 0);
  return Number.isFinite(score) ? score : 0;
}

function graphLabel(entity: any) {
  return cleanText(entity?.name ?? entity?.label ?? entity?.entity_text ?? entity?.entity_name ?? entity?.id ?? '');
}

function usefulGraphLabel(label: string) {
  const normalized = label.toLowerCase();
  const badLabels = new Set([
    'a', 'as', 'de', 'da', 'do', 'e', 'r', 'rs', 'br', 't', 'q',
    'location', 'miscellaneous', 'organization', 'person', 'unknown',
    'entidade', 'tema', 'documento', 'relatorio',
    'companhia', 'caixa', 'terra', 'liquid', 'santo', 'agreement', 'disclosure',
  ]);
  return (
    label.length > 3
    && !badLabels.has(normalized)
    && !/^[\d\s.,/%-]+$/.test(label)
    && !/^[tq]\d{1,3}$/i.test(label)
  );
}

function dedupeByChunk(items: any[]) {
  const seen = new Set<string>();
  const sourceItems = items.filter((item) => !chunkLooksGenerated(item));
  const fallbackItems = sourceItems.length > 0 ? sourceItems : items;

  return fallbackItems.filter((item) => {
    const textKey = cleanText(chunkText(item)).toLowerCase().slice(0, 260);
    const key = textKey || String(item?.chunk_id ?? item?.id ?? '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function displayTitle(value: unknown, fallback = 'Documento') {
  const text = cleanText(value);
  if (!text || /^[\d\s.,/%-]+$/.test(text)) return fallback;
  const digitCount = (text.match(/\d/g) ?? []).length;
  const letterCount = (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  const lineCount = text.split('\n').filter(Boolean).length;
  const looksLikeBrokenTable = lineCount > 2 || (digitCount > letterCount * 1.4 && text.length > 24);
  const looksLikePeriodHeader = /^(?:[1234]T\d{2}|A\/A|T\/T|proforma|\d+[.,]?\d*%?\s*)+$/i.test(text.replace(/\s+/g, ' '));
  if (looksLikeBrokenTable || looksLikePeriodHeader) return fallback;
  return text;
}

function humanRankSource(value: unknown) {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('hybrid')) return 'Busca híbrida';
  if (raw.includes('graph')) return 'Grafo';
  if (raw.includes('vector')) return 'Semântica';
  if (raw.includes('lexical') || raw.includes('bm25')) return 'Termo exato';
  return 'Evidência';
}

function evidenceLabel(value: unknown) {
  const raw = String(value ?? '').toLowerCase();
  if (raw.includes('strong') || raw.includes('forte')) return 'Evidência forte';
  if (raw.includes('weak') || raw.includes('fraca')) return 'Evidência fraca';
  return 'Evidência média';
}

function warningItems(value: any) {
  return asArray(value?.warnings).map((item: unknown) => String(item));
}

function warningLabel(value: unknown) {
  const key = String(value ?? '').toLowerCase();
  if (key.includes('generated_artifact_context')) return 'A API usou um relatorio gerado como contexto porque nao encontrou chunks da fonte original.';
  if (key.includes('source_document_missing')) return 'O documento fonte original nao esta indexado. Reprocesse a divulgacao original, nao um PDF exportado pela Schema API.';
  if (key.includes('insufficient_evidence')) return 'Evidencia insuficiente para responder com seguranca.';
  if (key.includes('weak_context')) return 'Contexto fraco: revise ou reprocesse o documento fonte.';
  return cleanText(value) || 'Aviso da recuperacao.';
}

function splitAnswerSections(raw: unknown) {
  const lines = cleanText(raw).split('\n').map((line) => line.trim()).filter(Boolean);
  const sections: Record<string, string[]> = { answer: [], evidence: [], metrics: [], sources: [], attention: [] };
  let current: keyof typeof sections = 'answer';

  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[:：]$/, '');
    if (/^resposta/.test(normalized)) {
      current = 'answer';
      continue;
    }
    if (/^evid/.test(normalized)) {
      current = 'evidence';
      continue;
    }
    if (/^m[eé]tric/.test(normalized)) {
      current = 'metrics';
      continue;
    }
    if (/^(pontos|riscos|aten)/.test(normalized)) {
      current = 'attention';
      continue;
    }
    if (/^font/.test(normalized)) {
      current = 'sources';
      continue;
    }
    sections[current].push(line.replace(/^[-•]\s*/, '').replace(/^Resposta direta:\s*/i, '').trim());
  }

  return sections;
}

function splitAnswerSectionsClean(raw: unknown) {
  const lines = cleanText(raw).split('\n').map((line) => line.trim()).filter(Boolean);
  const sections: Record<string, string[]> = { answer: [], evidence: [], metrics: [], sources: [], attention: [] };
  let current: keyof typeof sections = 'answer';

  for (const line of lines) {
    const normalized = line
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[:：]$/, '');

    if (/^resposta/.test(normalized)) {
      current = 'answer';
      continue;
    }
    if (/^evid/.test(normalized)) {
      current = 'evidence';
      continue;
    }
    if (/^metric/.test(normalized)) {
      current = 'metrics';
      continue;
    }
    if (/^(pontos|riscos|atencao)/.test(normalized)) {
      current = 'attention';
      continue;
    }
    if (/^font/.test(normalized)) {
      current = 'sources';
      continue;
    }

    sections[current].push(line.replace(/^[-•]\s*/, '').replace(/^Resposta direta:\s*/i, '').trim());
  }

  return sections;
}

function directAnswer(raw: unknown) {
  const sections = splitAnswerSectionsClean(raw);
  const text = sections.answer.join(' ');
  return finishUiSentence(text || 'A API não retornou uma resposta textual consolidada.');
}

function contextDocumentCount(context: AutoContext) {
  return Number(context.document_count ?? context.documentCount ?? context.documents?.length ?? 0);
}

function contextProcessedCount(context: AutoContext) {
  return Number(context.processed_count ?? context.processedCount ?? 0);
}

function activeContext(contexts: AutoContext[]) {
  return contexts[0] ?? null;
}

function contextScopeLabel(contexts: AutoContext[]) {
  const context = activeContext(contexts);
  if (!context) return 'Escopo automático: aguardando documentos processados';
  const count = contextDocumentCount(context);
  return `Escopo automático: ${context.label} (${count} documento${count === 1 ? '' : 's'})`;
}

function finishUiSentence(value: unknown) {
  const text = cleanText(value).replace(/\.\.\./g, '').trim();
  if (!text) return '';
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

function toolTitle(name: unknown) {
  const key = String(name ?? '');
  const labels: Record<string, string> = {
    query_documents: 'Consultar documentos',
    query_graph: 'Analisar relacoes',
    draft_email: 'Preparar comunicacao',
    create_review_item: 'Criar revisao',
    compare_invoice_purchase_order: 'Conferir divergencia',
  };
  return labels[key] ?? key.replace(/_/g, ' ');
}

function riskTitle(risk: unknown) {
  const key = String(risk ?? '');
  if (key === 'mutation-sensitive') return 'Requer aprovacao';
  if (key === 'draft-only') return 'Rascunho seguro';
  if (key === 'read-only') return 'Consulta segura';
  return key || 'Padrao';
}

function formatDateTime(value: unknown) {
  const raw = String(value ?? '');
  if (!raw) return '-';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function humanEvent(value: unknown) {
  const key = String(value ?? '').toLowerCase();
  if (key.includes('rag')) return 'Consulta RAG';
  if (key.includes('search')) return 'Busca em documentos';
  if (key.includes('pii')) return 'Redacao de PII';
  if (key.includes('agent')) return 'Tarefa assistida';
  if (key.includes('audit')) return 'Auditoria carregada';
  if (key.includes('graph')) return 'Mapa de evidências';
  return cleanText(value) || 'Evento registrado';
}

function humanActor(value: unknown) {
  const key = String(value ?? '').toLowerCase();
  if (key === 'reader') return 'Leitor';
  if (key === 'admin') return 'Administrador';
  if (key === 'agent') return 'Assistente';
  if (key === 'system') return 'Sistema';
  return cleanText(value) || '-';
}

function statusTitle(value: unknown) {
  const key = String(value ?? '').toLowerCase();
  if (key.includes('rejected_generatedartifact')) return 'Rejeitado: relatorio gerado';
  if (key.includes('rejected')) return 'Rejeitado';
  if (key.includes('processed')) return 'Processado';
  if (key.includes('processing')) return 'Processando';
  if (key.includes('executed')) return 'Concluido';
  if (key.includes('failed')) return 'Falhou';
  if (key.includes('online')) return 'API Online';
  if (key.includes('offline')) return 'API Offline';
  return cleanText(value) || 'Status';
}

function toolDescription(name: unknown) {
  const key = String(name ?? '');
  const descriptions: Record<string, string> = {
    query_documents: 'Recupera evidencias dos documentos indexados sem alterar dados.',
    query_graph: 'Consulta relacoes entre entidades, secoes e metricas.',
    draft_email: 'Gera um rascunho revisavel a partir do contexto recuperado.',
    create_review_item: 'Transforma achados em uma pendencia de revisao.',
    compare_invoice_purchase_order: 'Compara documentos e sinaliza divergencias para aprovacao.',
  };
  return descriptions[key] ?? 'Capacidade disponivel para fluxos assistidos.';
}

function agentOutcome(run: AgentRun) {
  const result: any = run.result ?? {};
  if (result.review_item || result.reviewItem) {
    return 'O assistente criou um item de revisao para validacao humana.';
  }
  if (result.email_draft || result.emailDraft) {
    return 'Um rascunho foi preparado e ficou pronto para revisao antes de qualquer envio.';
  }
  if (result.comparison || result.discrepancies) {
    return 'A comparacao foi concluida e possiveis divergencias ficaram sinalizadas para aprovacao.';
  }
  if (result.answer || result.summary || result.message) {
    return finishUiSentence(result.answer ?? result.summary ?? result.message);
  }
  if (String(run.status ?? '').toLowerCase().includes('executed')) {
    return 'A tarefa terminou e o resultado ficou registrado no historico operacional.';
  }
  return 'O assistente esta aguardando execucao ou revisao.';
}

function agentSummary(run: AgentRun) {
  const result: any = run.result ?? {};
  const steps = asArray(result.execution);
  const completed = steps.filter((step: any) => String(step.status ?? '').toLowerCase().includes('done')).length;
  const tool = toolTitle(run.requested_tool ?? run.requestedTool ?? result.tool);
  if (String(run.status ?? '').toLowerCase().includes('executed')) {
    return `${tool} concluiu a tarefa e registrou o resultado para revisao.`;
  }
  if (completed > 0) return `${tool} avancou ${completed} etapa(s) do fluxo assistido.`;
  return `${tool} esta preparado para executar a tarefa solicitada.`;
}

function agentSteps(run: AgentRun) {
  const result: any = run.result ?? {};
  const execution = asArray(result.execution);
  if (execution.length > 0) {
    return execution.map((step: any) => ({
      label: String(step.step ?? step.name ?? 'Etapa'),
      done: String(step.status ?? '').toLowerCase().includes('done'),
    }));
  }
  return [
    { label: 'Planejar', done: true },
    { label: 'Buscar evidencias', done: Boolean(run.result) },
    { label: 'Revisar resultado', done: String(run.status ?? '').toLowerCase().includes('executed') },
  ];
}

function graphPriority(label: string, type: string) {
  const lower = normalizeForMatch(label);
  let score = 0;
  if (type.includes('metric')) score += 8;
  if (type.includes('location')) score += 5;
  if (type.includes('organization')) score += 3;
  if (lower.includes('receita') || lower.includes('ebitda') || lower.includes('margem')) score += 10;
  if (lower.includes('alavancagem') || lower.includes('dívida') || lower.includes('divida')) score += 9;
  if (lower.includes('produção') || lower.includes('producao') || lower.includes('atlanta') || lower.includes('bahia')) score += 7;
  if (lower.includes('petroleum') || lower.includes('agência') || lower.includes('agencia')) score -= 2;
  if (label.length > 52) score -= 2;
  return score;
}

function graphNodes(graph: any, context?: AutoContext | null) {
  const entities = asArray(graph?.entities ?? graph?.nodes ?? graph)
    .map((entity: any) => ({
      label: graphLabel(entity),
      type: String(entity?.entity_type ?? entity?.node_type ?? entity?.type ?? '').toLowerCase(),
    }))
    .filter(({ label }: { label: string }) => usefulGraphLabel(label));
  const relations = asArray(graph?.relationships ?? graph?.edges);

  const locations = entities
    .filter(({ type }: { type: string }) => type.includes('location'))
    .map(({ label }: { label: string }) => label);
  const organizations = entities
    .filter(({ type }: { type: string }) => type.includes('organization'))
    .map(({ label }: { label: string }) => label);
  const operational = entities
    .filter(({ type, label }: { type: string; label: string }) => {
      const lowered = normalizeForMatch(label);
      return type.includes('misc')
        || lowered.includes('diesel')
        || lowered.includes('offshore')
        || lowered.includes('onshore')
        || lowered.includes('campo')
        || lowered.includes('polo');
    })
    .map(({ label }: { label: string }) => label);
  const metrics = entities
    .filter(({ label, type }: { label: string; type: string }) => {
      const lowered = normalizeForMatch(label);
      return type.includes('metric')
        || lowered.includes('receita')
        || lowered.includes('ebitda')
        || lowered.includes('margem')
        || lowered.includes('divida')
        || lowered.includes('dívida')
        || lowered.includes('producao')
        || lowered.includes('produção');
    })
    .map(({ label }: { label: string }) => label);
  const topicLabels = [
    metrics.length > 0 ? 'Indicadores financeiros' : '',
    operational.length > 0 || locations.length > 0 ? 'Operacao e ativos' : '',
    organizations.length > 0 ? 'Organizacoes citadas' : '',
  ].filter(Boolean);
  const contextTopics = (context?.topics ?? []).filter(Boolean);
  const contextEntities = (context?.entities ?? []).filter((label) => usefulGraphLabel(label));
  const factLabels = Array.from(new Set([...metrics, ...operational, ...locations, ...organizations, ...contextEntities]))
    .sort((a, b) => {
      const left = entities.find((entity: any) => entity.label === a);
      const right = entities.find((entity: any) => entity.label === b);
      return graphPriority(b, right?.type ?? '') - graphPriority(a, left?.type ?? '');
    });

  return {
    source: 'Relatorio processado',
    topics: Array.from(new Set([...topicLabels, ...contextTopics])).slice(0, 3),
    facts: factLabels.slice(0, 3),
    relations: relations.length,
    entities: factLabels.length,
  };
}

function isDocumentActive(doc: DocumentRecord | null) {
  if (!doc || doc.error) return false;
  const status = doc.status.toLowerCase();
  if (status.includes('rejected') || status.includes('failed') || status.includes('erro')) return false;
  return status.includes('processing') || status.includes('queued') || status.includes('index') || status.includes('extract');
}

function isDocumentRejected(doc: DocumentRecord | null) {
  if (!doc) return false;
  const status = doc.status.toLowerCase();
  return status.includes('rejected') || status.includes('failed') || status.includes('erro');
}

function isDocumentDone(doc: DocumentRecord | null) {
  if (!doc) return false;
  const status = doc.status.toLowerCase();
  return status.includes('processed') || status.includes('ready') || status.includes('completed');
}

function documentProgress(doc: DocumentRecord | null) {
  if (!doc) return 0;
  if (doc.error) return 100;
  if (isDocumentRejected(doc)) return 100;
  if (isDocumentDone(doc)) return 100;
  const status = doc.status.toLowerCase();
  if (status.includes('index')) return 82;
  if (status.includes('embed')) return 68;
  if (status.includes('chunk')) return 52;
  if (status.includes('extract')) return 36;
  if (status.includes('processing')) return 24;
  return 12;
}

function copyText(value: string) {
  navigator.clipboard?.writeText(value).catch(() => undefined);
}

function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function downloadBase64File(filename: string, contentBase64: string, mime = 'application/octet-stream') {
  const binary = atob(contentBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function filenameStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    const cleaned = cleanText(value);
    return cleaned ? [cleaned] : [];
  }
  return [];
}

function markdownSectionItems(markdown: unknown, heading: string) {
  const text = typeof markdown === 'string' ? markdown : '';
  const target = normalizeForMatch(heading);
  const items: string[] = [];
  let active = false;

  text.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      active = normalizeForMatch(trimmed.slice(3)) === target;
      return;
    }
    if (active && trimmed.startsWith('- ')) {
      items.push(finishUiSentence(trimmed.slice(2)));
    }
  });

  return uniqueTexts(items, 12);
}

function firstUsefulText(items: any[], max = 4) {
  return dedupeByChunk(items)
    .map((item) => finishUiSentence(item.excerpt ?? item.snippet ?? item.chunk_text ?? item.text ?? chunkText(item)))
    .filter(isUsefulEvidenceText)
    .slice(0, max);
}

function uniqueTexts(values: string[], limit = values.length) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const cleaned = finishUiSentence(cleanText(value));
    const key = normalizeForMatch(cleaned).replace(/\s+/g, ' ').trim();
    if (!cleaned || !key || seen.has(key) || isSchemaGeneratedArtifact(cleaned)) return;
    seen.add(key);
    result.push(cleaned);
  });

  return result.slice(0, limit);
}

function textTokens(value: string) {
  return normalizeForMatch(value)
    .replace(/[^a-z0-9%$,.]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3 || /\d/.test(token));
}

function textOverlapScore(a: string, b: string) {
  const left = new Set(textTokens(a));
  const right = textTokens(b);
  if (left.size === 0 || right.length === 0) return 0;
  const matches = right.filter((token) => left.has(token)).length;
  return matches / Math.min(left.size, right.length);
}

function isDifferentFrom(values: string[], value: string, threshold = 0.72) {
  const key = normalizeForMatch(value).replace(/\s+/g, ' ').trim();
  return !values.some((item) => {
    const itemKey = normalizeForMatch(item).replace(/\s+/g, ' ').trim();
    return itemKey === key || itemKey.includes(key) || key.includes(itemKey) || textOverlapScore(item, value) >= threshold;
  });
}

function reportText(value: unknown, max = 560) {
  const cleaned = finishUiSentence(truncate(value, max));
  const key = normalizeForMatch(cleaned).replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length < 24) return '';
  if (/^(resposta|analise executiva|resumo executivo|documento recuperado|resultado)$/i.test(key)) return '';
  if (key.includes('nenhuma pergunta executada') || key.includes('nenhuma busca executada')) return '';
  if (isSchemaGeneratedArtifact(cleaned)) return '';
  return cleaned;
}

function reportTopic(query: string) {
  const value = normalizeForMatch(query);
  if (/receita|liquida|faturamento/.test(value)) return 'Receita liquida';
  if (/ebitda|margem/.test(value)) return 'EBITDA e margem';
  if (/divida|alavancagem|endividamento/.test(value)) return 'Divida e alavancagem';
  if (/risco|atencao|alerta|ponto/.test(value)) return 'Riscos e pontos de atencao';
  if (/operacional|producao|destaque/.test(value)) return 'Destaques operacionais';
  if (/resumo|executiv|analise/.test(value)) return 'Resumo executivo';
  return cleanText(query).slice(0, 58) || 'Consulta analisada';
}

function sourceFromResult(item: any) {
  const candidates = [item?.section_title, item?.document_title, item?.title]
    .map(cleanText)
    .filter((value) => value && !isSchemaGeneratedArtifact(value));
  return candidates[0] ?? 'Documento recuperado';
}

function metricLike(value: string) {
  return /R\$|US\$|%|\d+[,.]\d+|p\.p\.|pontos percentuais|milh|bilh|receita|ebitda|margem|divida|alavancagem/i.test(value);
}

function attentionLike(value: string) {
  return /risco|queda|divida|alavancagem|pressao|atencao|desafi|negativ|reduc|volatil|covenant|g&a|despesa|endivid/i.test(normalizeForMatch(value));
}

function sessionConclusion(session: QuerySession) {
  const sections = splitAnswerSectionsClean(session.result?.answer);
  const answer = reportText(directAnswer(session.result?.answer), 420);
  const fallback = reportText(sections.evidence[0] ?? sections.metrics[0], 420);
  const text = answer || fallback;
  return text ? `${reportTopic(session.query)}: ${text}` : '';
}

function addAnalysisPoint(map: Map<string, AnalysisChartDatum>, label: string, value = 1, detail?: string) {
  const cleanLabel = cleanText(label) || 'Tema consolidado';
  const current = map.get(cleanLabel) ?? { label: cleanLabel, value: 0, detail };
  current.value += value;
  if (!current.detail && detail) current.detail = detail;
  map.set(cleanLabel, current);
}

function buildTopicDistribution(
  context: AutoContext | undefined,
  searchHistory: QuerySession[],
  ragHistory: QuerySession[],
  evidence: string[],
  metrics: string[],
) {
  const map = new Map<string, AnalysisChartDatum>();

  if (context?.label) {
    addAnalysisPoint(map, context.label, 3, 'escopo inferido automaticamente');
  }

  [...ragHistory, ...searchHistory].forEach((session) => {
    addAnalysisPoint(map, reportTopic(session.query), 2, 'consulta executada na sessao');
  });

  const textCorpus = [...evidence, ...metrics].join(' ');
  const detectors: Array<[string, RegExp]> = [
    ['Receita liquida', /receita|faturamento/i],
    ['EBITDA e margem', /ebitda|margem/i],
    ['Divida e alavancagem', /divida|alavancagem|endivid/i],
    ['Ativos e operacoes', /atlanta|bahia|potiguar|producao|offshore|onshore/i],
    ['Riscos e atencao', /risco|queda|pressao|despesa|g&a|covenant/i],
  ];

  detectors.forEach(([label, pattern]) => {
    if (pattern.test(textCorpus)) {
      addAnalysisPoint(map, label, 1, 'termos encontrados nas evidencias');
    }
  });

  return Array.from(map.values())
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);
}

function buildAnalysisMix(coverage: AnalysisCoverage) {
  return [
    { label: 'Perguntas RAG', value: coverage.ragQueries, detail: 'perguntas interpretativas' },
    { label: 'Buscas hibridas', value: coverage.searchQueries, detail: 'evidencias recuperadas' },
    { label: 'Evidencias', value: coverage.evidence, detail: 'trechos usados' },
    { label: 'Metricas', value: coverage.metrics, detail: 'variacoes destacadas' },
    { label: 'Fontes', value: coverage.sources, detail: 'origens citadas' },
  ].filter((item) => item.value > 0);
}

function buildQualitySeries(evalResult: any, quality: number) {
  if (!evalResult) return [];
  return [
    { label: 'Fidelidade', value: Math.round(Number(evalResult.faithfulness ?? 0) * 100), detail: 'resposta sustentada pelas fontes' },
    { label: 'Precisao do contexto', value: Math.round(Number(evalResult.context_precision ?? 0) * 100), detail: 'trechos recuperados uteis' },
    { label: 'Alinhamento', value: Math.round(Number(evalResult.answer_relevance ?? 0) * 100), detail: 'resposta conectada a pergunta' },
    { label: 'Aderencia', value: Math.round(Number(evalResult.groundedness ?? 0) * 100), detail: 'baixo risco de afirmacoes soltas' },
    { label: 'Nota geral', value: quality, detail: 'media executiva da avaliacao' },
  ];
}

function buildExecutiveNarrative({
  context,
  coverage,
  conclusions,
  evidence,
  metrics,
  attention,
}: {
  context?: AutoContext;
  coverage: AnalysisCoverage;
  conclusions: string[];
  evidence: string[];
  metrics: string[];
  attention: string[];
}) {
  const core = conclusions[0]?.replace(/^[^:]{3,64}:\s*/, '') || evidence[0] || 'Ainda nao ha evidencias suficientes para uma leitura executiva completa.';
  const metricHighlights = uniqueTexts(
    metrics.filter((item) => isDifferentFrom([core], item, 0.76)),
    3,
  );
  const attentionHighlights = uniqueTexts(
    attention.filter((item) => isDifferentFrom([core, ...metricHighlights], item, 0.78)),
    2,
  );
  const scope = [
    `${coverage.documents} documento(s)`,
    `${coverage.ragQueries} pergunta(s) RAG`,
    `${coverage.searchQueries} busca(s) hibrida(s)`,
    `${coverage.evidence} evidencia(s)`,
  ].join(', ');
  const contextText = context?.label ? ` no escopo automatico "${context.label}"` : '';
  const parts = [
    `Esta analise consolida ${scope}${contextText}.`,
    `Leitura central: ${core}`,
    metricHighlights.length ? `Metricas que sustentam a leitura: ${metricHighlights.join(' ')}` : '',
    attentionHighlights.length ? `Pontos de atencao extraidos do conjunto: ${attentionHighlights.join(' ')}` : '',
    coverage.quality ? `Qualidade observada: ${coverage.quality}% de aderencia executiva media nos sinais avaliados.` : '',
  ];

  return reportText(parts.filter(Boolean).join(' '), 1500);
}

function buildAnalysisReport({
  documents,
  contexts,
  searchHistory,
  ragHistory,
  evalResult,
}: {
  documents: DocumentRecord[];
  contexts: AutoContext[];
  searchHistory: QuerySession[];
  ragHistory: QuerySession[];
  evalResult: any;
}): AnalysisReportBuild {
  const context = activeContext(contexts);
  const ragSessions = ragHistory.slice(0, 24);
  const searchSessions = searchHistory.slice(0, 24);
  const ragGroups = ragSessions.map((session) => ({
    session,
    sections: splitAnswerSectionsClean(session.result?.answer),
    citations: dedupeByChunk(asArray(session.result?.citations)).slice(0, 6),
  }));
  const searchGroups = searchSessions.map((session) => ({
    session,
    results: dedupeByChunk(asArray(session.result)).slice(0, 6),
  }));

  const conclusions = uniqueTexts(ragGroups.map((group) => sessionConclusion(group.session)).filter(Boolean), 10);
  const ragEvidence = ragGroups.flatMap((group) => [
    ...group.sections.evidence.map((item) => reportText(item, 520)),
    ...group.citations.map((item: any) => {
      const source = sourceFromResult(item);
      const reason = reportText(item.relevance_reason ?? item.snippet ?? item.chunk_text ?? item.text, 480);
      return reason ? `${source}: ${reason}` : '';
    }),
  ]).filter(Boolean);
  const searchEvidence = searchGroups.flatMap((group) => firstUsefulText(group.results, 4).map((item) => reportText(item, 520))).filter(Boolean);
  const evidence = uniqueTexts([...ragEvidence, ...searchEvidence], 16);

  const metricCandidates = uniqueTexts([
    ...ragGroups.flatMap((group) => group.sections.metrics.map((item) => reportText(item, 440))),
    ...evidence.filter(metricLike),
    ...searchEvidence.filter(metricLike),
  ].filter(Boolean), 14);
  const metrics = metricCandidates.length
    ? metricCandidates.slice(0, 8)
    : uniqueTexts(evidence.filter(metricLike), 8);

  const attention = uniqueTexts([
    ...ragGroups.flatMap((group) => group.sections.attention.map((item) => reportText(item, 440))),
    ...evidence.filter(attentionLike),
  ].filter(Boolean), 10)
    .filter((item) => isDifferentFrom(metrics, item, 0.82));

  const sources = Array.from(new Set([
    ...documents.map((item) => cleanText(item.name ?? item.id)),
    ...ragGroups.flatMap((group) => group.sections.sources.map((item) => cleanText(item))),
    ...ragGroups.flatMap((group) => group.citations.map(sourceFromResult)),
    ...searchGroups.flatMap((group) => group.results.map(sourceFromResult)),
  ].filter(Boolean))).slice(0, 12);

  const title = `Analise executiva - ${context?.label ?? documents[0]?.name ?? 'documentos processados'}`;
  const quality = evalResult
    ? Math.round(((Number(evalResult.faithfulness ?? 0) + Number(evalResult.answer_relevance ?? 0) + Number(evalResult.groundedness ?? 0)) / 3) * 100)
    : 0;
  const coverage: AnalysisCoverage = {
    documents: documents.length,
    ragQueries: ragHistory.length,
    searchQueries: searchHistory.length,
    conclusions: conclusions.length,
    evidence: evidence.length,
    metrics: metrics.length,
    sources: sources.length,
    quality,
  };
  const topics = buildTopicDistribution(context, searchHistory, ragHistory, evidence, metrics);
  const mix = buildAnalysisMix(coverage);
  const qualitySeries = buildQualitySeries(evalResult, quality);
  const executive = buildExecutiveNarrative({
    context,
    coverage,
    conclusions,
    evidence,
    metrics,
    attention,
  });
  const ragInsights = ragSessions
    .map((session) => {
      const answer = reportText(directAnswer(session.result?.answer), 520);
      return answer ? `${session.query}: ${answer}` : '';
    })
    .filter(Boolean);
  const searchInsights = searchGroups
    .map((group) => {
      const first = firstUsefulText(group.results, 1)[0];
      return first ? `${group.session.query}: ${reportText(first, 520)}` : '';
    })
    .filter(Boolean);
  const lines = [
    `# ${title}`,
    '',
    `Relatorio executivo consolidado gerado em ${new Date().toLocaleString('pt-BR')}.`,
    '',
    '## Resumo executivo consolidado',
    executive,
    '',
    '## Cobertura da analise',
    `- Documentos considerados: ${coverage.documents}.`,
    `- Perguntas RAG consolidadas: ${coverage.ragQueries}.`,
    `- Buscas hibridas consolidadas: ${coverage.searchQueries}.`,
    `- Evidencias consolidadas: ${coverage.evidence}.`,
    `- Metricas destacadas: ${coverage.metrics}.`,
    `- Fontes citadas: ${coverage.sources}.`,
    '',
    '## Indicadores executivos',
    `- Qualidade media da analise: ${coverage.quality ? `${coverage.quality}%` : 'nao avaliada'}.`,
    `- Principal escopo automatico: ${context?.label ?? 'nao inferido'}.`,
    `- Tema dominante: ${topics[0]?.label ?? 'nao identificado'}.`,
    `- Base operacional: ${mix.map((item) => `${item.label} ${item.value}`).join('; ') || 'sem insumos suficientes'}.`,
    '',
    '## Distribuicao tematica',
    ...(topics.length
      ? topics.map((item) => `- ${item.label}: ${item.value} ocorrencia(s)${item.detail ? `; ${item.detail}` : ''}.`)
      : ['- Nenhum tema consolidado ainda.']),
    '',
    '## Composicao dos insumos',
    ...(mix.length
      ? mix.map((item) => `- ${item.label}: ${item.value} item(ns)${item.detail ? `; ${item.detail}` : ''}.`)
      : ['- Nenhum insumo operacional consolidado ainda.']),
    '',
    '## Conclusoes consolidadas',
    ...(conclusions.length ? conclusions.slice(0, 8).map((item) => `- ${item}`) : ['- Nenhuma conclusao consolidada ainda.']),
    '',
    '## Principais evidencias',
    ...(evidence.length ? evidence.slice(0, 10).map((item) => `- ${item}`) : ['- Nenhuma evidencia consolidada ainda.']),
    '',
    '## Metricas e variacoes',
    ...(metrics.length ? metrics.slice(0, 8).map((item) => `- ${item}`) : ['- Nenhuma metrica destacada automaticamente.']),
    '',
    '## Pontos de atencao',
    ...(attention.length ? attention.slice(0, 8).map((item) => `- ${item}`) : ['- Nenhum ponto de atencao separado pelo RAG ate o momento.']),
    '',
    '## Perguntas consideradas',
    ...(ragHistory.length ? ragHistory.slice(0, 24).map((item) => `- ${item.query}`) : ['- Nenhuma pergunta RAG executada nesta sessao.']),
    '',
    '## Buscas consideradas',
    ...(searchHistory.length ? searchHistory.slice(0, 24).map((item) => `- ${item.query}`) : ['- Nenhuma busca hibrida executada nesta sessao.']),
    '',
    '## Sintese por pergunta RAG',
    ...(ragInsights.length ? ragInsights.slice(0, 24).map((item) => `- ${item}`) : ['- Nenhuma resposta RAG consolidada ainda.']),
    '',
    '## Sintese por busca hibrida',
    ...(searchInsights.length ? searchInsights.slice(0, 24).map((item) => `- ${item}`) : ['- Nenhuma busca hibrida consolidada ainda.']),
    '',
    '## Fontes',
    ...(sources.length ? sources.map((item) => `- ${item}`) : ['- Fontes ainda nao consolidadas.']),
    '',
    '## Qualidade observada',
    ...(qualitySeries.length
      ? qualitySeries.map((item) => `- ${item.label}: ${item.value}%${item.detail ? `; ${item.detail}` : ''}.`)
      : ['- Nenhuma avaliacao RAG carregada nesta sessao.']),
  ];

  return {
    title,
    executive,
    conclusions: conclusions.slice(0, 8),
    evidence: evidence.slice(0, 10),
    metrics: metrics.slice(0, 8),
    attention: attention.slice(0, 8),
    sources,
    coverage,
    topics,
    mix,
    qualitySeries,
    markdown: lines.join('\n'),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToHtml(markdown: string) {
  return markdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
      if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith('- ')) return `<p class="bullet">&bull; ${escapeHtml(line.slice(2))}</p>`;
      if (!line.trim()) return '<br />';
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('\n');
}

function markdownToHtmlSafe(markdown: string) {
  return markdown
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) return `<h1>${escapeHtml(trimmed.slice(2))}</h1>`;
      if (trimmed.startsWith('## ')) return `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
      if (trimmed.startsWith('- ')) return `<p class="bullet">&bull; ${escapeHtml(trimmed.slice(2))}</p>`;
      if (!trimmed) return '<br />';
      return `<p>${escapeHtml(trimmed)}</p>`;
    })
    .join('\n');
}

function reportDocumentHtml(markdown: string) {
  const generatedAt = new Date().toLocaleString('pt-BR');
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Schema API - Analise</title>
  <style>
    @page { size: A4; margin: 16mm 15mm 18mm; }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body { margin: 0; color: #17202a; background: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5; }
    .report-page { width: 100%; margin: 0 auto; }
    .report-cover { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #0f766e; }
    .report-brand { color: #0f766e; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .report-generated { margin-top: 4px; color: #64748b; font-size: 11px; }
    h1 { margin: 8px 0 8px; color: #0f172a; font-size: 22px; line-height: 1.18; }
    h2 { break-after: avoid; page-break-after: avoid; margin: 16px 0 7px; padding: 6px 9px; border-left: 4px solid #0f766e; border-radius: 6px; background: #f0fdfa; color: #0f766e; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
    p { margin: 5px 0; font-size: 12.6px; }
    .bullet { break-inside: avoid; page-break-inside: avoid; margin: 4px 0; padding-left: 16px; text-indent: 0; }
    br { display: none; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #dfe5ea; color: #64748b; font-size: 10px; }
  </style>
</head>
<body>
  <main class="report-page">
    <header class="report-cover">
      <div class="report-brand">Schema API</div>
      <div class="report-generated">Gerado em ${escapeHtml(generatedAt)}</div>
    </header>
    ${markdownToHtmlSafe(markdown)}
    <footer class="footer">Relatorio gerado a partir de buscas, perguntas RAG e evidencias recuperadas pela API.</footer>
  </main>
</body>
</html>`;
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>('dashboard');
  const [apiState, setApiState] = useState<'checking' | 'online' | 'offline'>('checking');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://127.0.0.1:8081');
  const [apiError, setApiError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [contexts, setContexts] = useState<AutoContext[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [isBusy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchHistory, setSearchHistory] = useState<QuerySession[]>([]);
  const [ragQuery, setRagQuery] = useState('');
  const [ragResult, setRagResult] = useState<any>(null);
  const [ragHistory, setRagHistory] = useState<QuerySession[]>([]);
  const [graphResult, setGraphResult] = useState<any>(null);
  const [graphDocId, setGraphDocId] = useState<string | null>(null);
  const [piiText, setPiiText] = useState('');
  const [piiResult, setPiiResult] = useState<any>(null);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [evalHistory, setEvalHistory] = useState<any[]>([]);
  const [obsTab, setObsTab] = useState<ObsTab>('evaluation');
  const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [agentGoal, setAgentGoal] = useState('');
  const [selectedTool, setSelectedTool] = useState('');

  const selectedDoc = documents.find((doc) => doc.id === selectedDocId) ?? documents[0] ?? null;
  const activeJobs = documents.filter((doc) => isDocumentActive(doc)).length;
  const currentTitle = navItems.find((item) => item.id === activeView)?.label ?? 'Dashboard';

  useEffect(() => {
    refreshHealth();
    loadAutoContexts(false);
    loadAgentTools();
    const timer = window.setInterval(() => {
      refreshHealth();
      loadAutoContexts(false);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedDoc?.id || !isDocumentActive(selectedDoc)) return;
    const timer = window.setInterval(() => {
      refreshDocument(selectedDoc.id, false);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [selectedDoc?.id, selectedDoc?.status, selectedDoc?.error]);

  useEffect(() => {
    if (!selectedDoc?.id || !isDocumentDone(selectedDoc) || graphDocId === selectedDoc.id) return;
    loadGraph(selectedDoc.id, false);
  }, [selectedDoc?.id, selectedDoc?.status, graphDocId]);

  function notify(title: string, tone: Toast['tone'] = 'success') {
    setToast({ title, tone });
    window.setTimeout(() => setToast(null), 2800);
  }

  function pushEvent(message: string) {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setEvents((prev) => [`[${time}] ${message}`, ...prev].slice(0, 50));
  }

  async function runTask<T>(task: () => Promise<T>, failure = 'Operacao falhou') {
    setBusy(true);
    try {
      return await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notify(`${failure}: ${message}`, 'danger');
      pushEvent(`${failure}: ${message}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function refreshHealth() {
    try {
      if (!window.schemaApi?.health) {
        throw new Error('Bridge do Electron indisponivel. Feche a janela antiga e execute o desktop novamente.');
      }
      const health = (await window.schemaApi.health()) as HealthResult;
      if (!health.ok) {
        throw new Error(health.error ?? 'Health check falhou');
      }
      setApiBaseUrl(health.baseUrl ?? 'http://127.0.0.1:8081');
      setApiError(null);
      setApiState('online');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setApiError(message);
      setApiState('offline');
    }
  }

  async function refreshDocument(id: string, announce = true) {
    try {
      const raw = await window.schemaApi.document(id);
      const next = normalizeDocument(raw, documents.find((doc) => doc.id === id));
      setDocuments((prev) => prev.map((doc) => (doc.id === id ? next : doc)));
      if (isDocumentDone(next)) loadAutoContexts(false);
      if (announce) pushEvent(`Documento atualizado: ${id} (${next.status})`);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const friendly = message.includes('404')
        ? 'Documento nao encontrado no backend. O volume pode ter sido limpo ou o ID acompanhado nao existe mais.'
        : message;
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id
            ? { ...doc, status: 'Erro', error: friendly, lastCheckedAt: new Date().toLocaleTimeString('pt-BR', { hour12: false }) }
            : doc,
        ),
      );
      pushEvent(`Falha ao atualizar documento ${id}: ${friendly}`);
      if (announce) notify(`Atualizacao falhou: ${friendly}`, 'danger');
      return null;
    }
  }

  async function handleUpload() {
    await runTask(async () => {
      const result = await window.schemaApi.uploadDocument();
      if (result.canceled || !result.documentId) return;

      const doc: DocumentRecord = {
        id: result.documentId,
        name: result.fileName ?? result.documentId,
        status: 'Processing',
        summary: null,
        actionItems: 0,
        createdAt: new Date().toLocaleString('pt-BR'),
        lastCheckedAt: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
      };

      setDocuments((prev) => [doc, ...prev.filter((item) => item.id !== doc.id)]);
      setSelectedDocId(doc.id);
      setGraphResult(null);
      setGraphDocId(null);
      setActiveView('documents');
      pushEvent(`Upload enviado para API: ${doc.name}`);
      notify('Upload enviado para processamento');
      await refreshDocument(doc.id, false);
      await loadAutoContexts(false);
    }, 'Upload falhou');
  }

  async function loadAutoContexts(announce = true) {
    try {
      if (!window.schemaApi?.autoContexts) return;
      const result = await window.schemaApi.autoContexts();
      const next = asArray(result) as AutoContext[];
      setContexts(next);
      if (announce) pushEvent(`Contextos automáticos atualizados: ${next.length}`);
    } catch {
      setContexts([]);
    }
  }

  async function runSearch() {
    if (!searchQuery.trim()) {
      notify('Informe uma consulta', 'warning');
      return;
    }
    await runTask(async () => {
      const result = await window.schemaApi.searchHybrid(searchQuery.trim());
      setSearchResult(result);
      setSearchHistory((prev) => [{ query: searchQuery.trim(), result, createdAt: new Date().toISOString() }, ...prev].slice(0, 20));
      pushEvent(`Busca híbrida executada: ${searchQuery.trim()}`);
    }, 'Busca falhou');
  }

  async function runRag() {
    if (!ragQuery.trim()) {
      notify('Informe uma pergunta', 'warning');
      return;
    }
    await runTask(async () => {
      const result = await window.schemaApi.ragQuery(ragQuery.trim());
      setRagResult(result);
      setRagHistory((prev) => [{ query: ragQuery.trim(), result, createdAt: new Date().toISOString() }, ...prev].slice(0, 20));
      pushEvent(`RAG executado: ${ragQuery.trim()}`);
    }, 'RAG falhou');
  }

  async function loadGraph(docId = selectedDoc?.id, announce = true) {
    if (!docId) {
      notify('Faca upload ou selecione um documento primeiro', 'warning');
      return;
    }
    await runTask(async () => {
      setSelectedDocId(docId);
      const result = await window.schemaApi.graph(docId);
      setGraphResult(result);
      setGraphDocId(docId);
      if (announce) pushEvent(`Mapa de evidências carregado para ${docId}`);
    }, 'GraphRAG falhou');
  }

  async function redactPii() {
    if (!piiText.trim()) {
      notify('Informe um texto para redigir', 'warning');
      return;
    }
    await runTask(async () => {
      const result = await window.schemaApi.redactPii(piiText);
      setPiiResult(result);
      pushEvent('Redacao de PII executada');
    }, 'Redacao de PII falhou');
  }

  async function loadAudit() {
    await runTask(async () => {
      const result = await window.schemaApi.audit();
      setAuditResult(result);
      pushEvent('Auditoria carregada');
    }, 'Auditoria falhou');
  }

  async function evaluateRag() {
    await runTask(async () => {
      const result = await window.schemaApi.evaluateRag() as any;
      setEvalResult(result);
      setEvalHistory((prev) => [result, ...prev.filter((item) => item?.id !== result?.id)].slice(0, 12));
      pushEvent('Avaliação RAG executada');
    }, 'Avaliação RAG falhou');
  }

  async function loadLatestEval() {
    await runTask(async () => {
      const result = await window.schemaApi.latestRagEval() as any;
      setEvalResult(result);
      setEvalHistory((prev) => [result, ...prev.filter((item) => item?.id !== result?.id)].slice(0, 12));
      pushEvent('Última avaliação RAG carregada');
    }, 'Última avaliação RAG falhou');
  }

  async function loadEvalHistory() {
    await runTask(async () => {
      const result = await window.schemaApi.ragEvalHistory() as any;
      setEvalHistory(asArray(result).slice(0, 25));
      pushEvent('Histórico RAG carregado');
    }, 'Histórico RAG falhou');
  }

  async function loadAgentTools() {
    try {
      const result = await window.schemaApi.agentTools();
      const tools = asArray(result) as AgentTool[];
      setAgentTools(tools);
      setSelectedTool((prev) => prev || tools[0]?.name || '');
    } catch {
      setAgentTools([]);
    }
  }

  async function createAgentRun() {
    if (!agentGoal.trim()) {
      notify('Informe um objetivo para o agente', 'warning');
      return;
    }
    await runTask(async () => {
      const result = await window.schemaApi.createAgentRun({ goal: agentGoal.trim(), requested_tool: selectedTool || undefined });
      const run = result as AgentRun;
      setAgentRuns((prev) => [run, ...prev.filter((item) => item.id !== run.id)]);
      pushEvent(`Execucao agentiva criada: ${run.id}`);
    }, 'Agente falhou');
  }

  async function approveAgentRun(id: string) {
    await runTask(async () => {
      const result = await window.schemaApi.approveAgentRun(id, 'desktop');
      const run = result as AgentRun;
      setAgentRuns((prev) => prev.map((item) => (item.id === id ? run : item)));
      pushEvent(`Execucao agentiva aprovada: ${id}`);
    }, 'Aprovacao falhou');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Database size={15} />
          </div>
          <div>
            <strong>Schema API</strong>
            <span>v1.0.0</span>
          </div>
        </div>

        <nav className="nav">
          {['Plataforma', 'Seguranca & Ops'].map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-label">{group}</div>
              {navItems.filter((item) => item.group === group).map((item) => (
                <button className={`nav-item ${activeView === item.id ? 'active' : ''}`} key={item.id} onClick={() => setActiveView(item.id)}>
                  <item.icon size={17} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p>Document Intelligence Control Plane</p>
            <h1>{currentTitle}</h1>
          </div>
          <div className="topbar-actions">
            <button className="primary-button small" onClick={handleUpload}><UploadCloud size={14} /> Selecionar documentos</button>
            <StatusBadge status={apiState === 'online' ? 'API Online' : apiState === 'checking' ? 'Verificando API' : 'API Offline'} />
          </div>
        </header>

        <section className="view-area">
          {isBusy && (
            <div className="busy-overlay">
              <div className="spinner" />
              Processando...
            </div>
          )}

          {activeView === 'dashboard' && (
            <DashboardView
              apiState={apiState}
              apiBaseUrl={apiBaseUrl}
              apiError={apiError}
              documents={documents}
              selectedDoc={selectedDoc}
              activeJobs={activeJobs}
              contexts={contexts}
              searchCount={searchHistory.length}
              ragCount={ragHistory.length}
              graph={graphDocId === selectedDoc?.id ? graphResult : null}
              onGraph={loadGraph}
            />
          )}
          {activeView === 'documents' && <DocumentsView documents={documents} selectedDoc={selectedDoc} onSelect={setSelectedDocId} onUpload={handleUpload} onRefresh={refreshDocument} />}
          {activeView === 'search' && <SearchView query={searchQuery} setQuery={setSearchQuery} result={searchResult} contexts={contexts} onRun={runSearch} />}
          {activeView === 'rag' && <RagView query={ragQuery} setQuery={setRagQuery} result={ragResult} contexts={contexts} onRun={runRag} />}
          {activeView === 'analysis' && <AnalysisView documents={documents} contexts={contexts} searchHistory={searchHistory} ragHistory={ragHistory} evalResult={evalResult} />}
          {activeView === 'governance' && <GovernanceView text={piiText} setText={setPiiText} piiResult={piiResult} auditResult={auditResult} onRedact={redactPii} onAudit={loadAudit} />}
          {activeView === 'agents' && <AgentsView tools={agentTools} runs={agentRuns} goal={agentGoal} setGoal={setAgentGoal} selectedTool={selectedTool} setSelectedTool={setSelectedTool} onCreate={createAgentRun} onApprove={approveAgentRun} onReloadTools={loadAgentTools} />}
          {activeView === 'observability' && <ObservabilityView evalResult={evalResult} history={evalHistory} events={events} tab={obsTab} setTab={setObsTab} onEvaluate={evaluateRag} onLatest={loadLatestEval} onHistory={loadEvalHistory} />}
        </section>
      </main>

      {toast && (
        <div className={`toast ${toast.tone ?? 'success'}`}>
          <CheckCircle2 size={16} />
          {toast.title}
        </div>
      )}
    </div>
  );
}

function DashboardView({
  apiState,
  apiBaseUrl,
  apiError,
  documents,
  selectedDoc,
  activeJobs,
  contexts,
  searchCount,
  ragCount,
  graph,
  onGraph,
}: {
  apiState: string;
  apiBaseUrl: string;
  apiError: string | null;
  documents: DocumentRecord[];
  selectedDoc: DocumentRecord | null;
  activeJobs: number;
  contexts: AutoContext[];
  searchCount: number;
  ragCount: number;
  graph: any;
  onGraph: (id?: string) => void;
}) {
  const [chartMode, setChartMode] = useState<'bars' | 'flow' | 'mix'>('bars');
  const processed = documents.filter((doc) => isDocumentDone(doc)).length;
  const context = activeContext(contexts);
  const quality = context ? `${Math.min(100, Math.round((contextProcessedCount(context) / Math.max(1, contextDocumentCount(context))) * 100))}%` : '-';
  const graphStats = graph ? graphNodes(graph, context) : null;
  const evidenceCount = graphStats?.entities ?? (context?.entities ?? []).filter(usefulGraphLabel).length;
  const dashboardData = dashboardInsights({
    documents: documents.length,
    processed,
    activeJobs,
    evidenceCount,
    searchCount,
    ragCount,
    context,
  });
  const cards = [
    { label: 'API', value: apiState === 'online' ? 'Online' : apiState === 'checking' ? '...' : 'Offline', sub: apiError ?? apiBaseUrl, icon: Server },
    { label: 'Documentos', value: documents.length, sub: 'nesta sessao', icon: FileText },
    { label: 'Processados', value: processed, sub: 'com status final', icon: CheckCircle2 },
    { label: 'Evidencias', value: evidenceCount || '-', sub: context ? context.label : 'aguardando escopo', icon: Target },
    { label: 'Cobertura', value: quality, sub: 'documentos prontos', icon: BarChart3 },
    { label: 'Jobs ativos', value: activeJobs, sub: 'em andamento', icon: Activity },
  ];

  return (
    <div className="view-stack dashboard-view">
      <div className="metric-grid metric-grid-real">
        {cards.map((card) => <MetricCard key={card.label} {...card} />)}
      </div>

      <div className="dashboard-main-grid">
        <Panel
          className="dashboard-analytics-panel analytics-panel"
          title="Indicadores Analiticos"
          icon={BarChart3}
          actions={<ChartSwitch value={chartMode} onChange={setChartMode} />}
        >
          {contexts.length === 0 ? <EmptyState title="Nenhum contexto inferido" text="Quando houver documentos processados, o sistema agrupa fontes e entidades sozinho." /> : (
            <DashboardAnalytics mode={chartMode} data={dashboardData} />
          )}
        </Panel>

        <Panel title="Mapa de Evidencias" icon={Network} className="dashboard-graph-panel">
          {!graph ? (
            <EmptyState
              title="Mapa pronto para visualizacao"
              text={selectedDoc ? 'Carregue as relacoes do documento selecionado para entender evidencias e temas.' : 'Envie ou selecione um documento para carregar o mapa.'}
              action={selectedDoc ? <button className="primary-button small" onClick={() => onGraph(selectedDoc.id)}>Carregar Mapa</button> : undefined}
            />
          ) : <GraphView graph={graph} context={context} compact />}
        </Panel>
      </div>
    </div>
  );
}

type DashboardInsightData = {
  focus: string;
  topics: Array<{ label: string; value: number; detail: string }>;
  flow: Array<{ label: string; value: number; detail: string }>;
  mix: Array<{ label: string; value: number; tone: string }>;
  barsTitle: string;
  lineTitle: string;
  pieTitle: string;
};

function normalizeForMatch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function dashboardInsights({
  documents,
  processed,
  activeJobs,
  evidenceCount,
  searchCount,
  ragCount,
  context,
}: {
  documents: number;
  processed: number;
  activeJobs: number;
  evidenceCount: number;
  searchCount: number;
  ragCount: number;
  context: AutoContext | null;
}): DashboardInsightData {
  const entities = (context?.entities ?? []).filter(usefulGraphLabel);
  const baseTopics = context?.topics?.length
    ? context.topics
    : ['Indicadores financeiros', 'Ativos e localidades', 'Organizacoes citadas'];
  const topics = baseTopics.slice(0, 4).map((topic, index) => {
    const key = normalizeForMatch(topic);
    const matches = entities.filter((entity) => {
      const lower = normalizeForMatch(entity);
      if (key.includes('finance') || key.includes('indicador')) return /receita|ebitda|margem|divida|alavancagem|capex/.test(lower);
      if (key.includes('ativo') || key.includes('local')) return /atlanta|bahia|polo|parque|manati|pescada|pero|campo|fpsO/i.test(lower);
      if (key.includes('organiza')) return /brava|petroleum|agencia|companhia|energia|anp/.test(lower);
      return lower.includes(key.split(' ')[0] ?? '');
    });
    const value = Math.max(1, matches.length || Math.round((evidenceCount || documents || 1) / (index + 1)));
    return {
      label: topic,
      value,
      detail: matches.slice(0, 3).join(' - ') || 'Sinais agrupados automaticamente',
    };
  });

  const flow = [
    { label: 'Fontes', value: documents, detail: 'documentos processados' },
    { label: 'Base', value: processed, detail: 'conteudo pronto para consulta' },
    { label: 'Busca', value: searchCount, detail: 'consultas e evidencias' },
    { label: 'RAG', value: ragCount, detail: 'respostas auditaveis' },
    { label: 'Analise', value: Math.max(searchCount, ragCount), detail: 'insumos para relatorio' },
  ];

  if (activeJobs > 0) {
    flow.splice(1, 0, { label: 'Processando', value: activeJobs, detail: 'documentos em andamento' });
  }

  const totalMix = Math.max(1, evidenceCount + searchCount + ragCount + processed);
  const mix = [
    { label: 'Evidencias', value: Math.round((evidenceCount / totalMix) * 100), tone: 'success' },
    { label: 'Buscas', value: Math.round((searchCount / totalMix) * 100), tone: 'info' },
    { label: 'RAG', value: Math.round((ragCount / totalMix) * 100), tone: 'warning' },
    { label: 'Fontes prontas', value: Math.round((processed / totalMix) * 100), tone: 'muted' },
  ].filter((item) => item.value > 0);

  return {
    focus: context?.label ?? 'Sem escopo ativo',
    topics,
    flow,
    mix,
    barsTitle: 'Cobertura por tema',
    lineTitle: 'Esteira de analise',
    pieTitle: 'Distribuicao da sessao',
  };
}

function ChartSwitch({ value, onChange }: { value: 'bars' | 'flow' | 'mix'; onChange: (value: 'bars' | 'flow' | 'mix') => void }) {
  const options: Array<{ id: 'bars' | 'flow' | 'mix'; label: string; icon: LucideIcon }> = [
    { id: 'bars', label: 'Barras', icon: BarChart3 },
    { id: 'flow', label: 'Linha', icon: LineChart },
    { id: 'mix', label: 'Pizza', icon: PieChart },
  ];
  return (
    <div className="chart-switch" role="tablist" aria-label="Alternar leitura do dashboard">
      {options.map((option) => (
        <button key={option.id} className={value === option.id ? 'active' : ''} onClick={() => onChange(option.id)} type="button">
          <option.icon size={14} />
          {option.label}
        </button>
      ))}
    </div>
  );
}

function DashboardAnalytics({ mode, data }: { mode: 'bars' | 'flow' | 'mix'; data: DashboardInsightData }) {
  if (mode === 'flow') {
    const max = Math.max(...data.flow.map((item) => item.value), 1);
    const points = data.flow.map((item, index) => ({
      item,
      x: data.flow.length === 1 ? 50 : 8 + (index * 84) / Math.max(1, data.flow.length - 1),
      y: 84 - (item.value / max) * 60,
    }));
    const linePath = points.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
    const areaPath = points.length > 1 ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} 92 L ${points[0].x.toFixed(2)} 92 Z` : '';
    return (
      <div className="analytics-content line-mode">
        <InsightNote title={data.lineTitle} text="Mostra como as fontes viram evidencias, respostas e relatorios exportaveis." />
        <div className="line-chart">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line className="line-axis" x1="6" x2="94" y1="92" y2="92" />
            <line className="line-axis" x1="6" x2="6" y1="12" y2="92" />
            {areaPath && <path className="line-area" d={areaPath} />}
            {linePath && <path className="line-stroke" d={linePath} />}
          </svg>
          {points.map(({ item, x, y }) => (
            <div className="line-point" style={{ left: `${x}%`, top: `${y}%` }} key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <div className="line-legend">
          {data.flow.map((item) => (
            <div key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'mix') {
    const total = data.mix.reduce((sum, item) => sum + item.value, 0) || 1;
    let offset = 0;
    const gradient = data.mix.map((item) => {
      const start = offset;
      offset += (item.value / total) * 100;
      const color = item.tone === 'warning' ? '#f59e0b' : item.tone === 'info' ? '#38bdf8' : item.tone === 'muted' ? '#94a3b8' : '#0f8a7b';
      return `${color} ${start}% ${offset}%`;
    }).join(', ');
    return (
      <div className="analytics-content mix-layout">
        <InsightNote title={data.pieTitle} text="Mostra onde a sessao concentrou valor: evidencias, buscas, perguntas ou fontes prontas." />
        <div className="donut-chart" style={{ background: `conic-gradient(${gradient})` }}>
          <div>
            <strong>{data.focus}</strong>
            <span>sessao</span>
          </div>
        </div>
        <div className="mix-list">
          {data.mix.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}%</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const max = Math.max(...data.topics.map((item) => item.value), 1);
  return (
    <div className="analytics-content">
      <InsightNote title={data.barsTitle} text="Agrupa sinais recorrentes para explicar o foco automatico da analise." />
      <div className="bar-chart">
        {data.topics.map((item) => (
          <div className="bar-chart-row" key={item.label}>
            <div><strong>{item.label}</strong><small>{item.detail}</small></div>
            <span><i style={{ width: `${Math.max(12, (item.value / max) * 100)}%` }} /></span>
            <em>{item.value}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightNote({ title, text }: { title: string; text: string }) {
  return (
    <div className="insight-note">
      <span>{title}</span>
      <p>{text}</p>
    </div>
  );
}

function DocumentsView({ documents, selectedDoc, onSelect, onUpload, onRefresh }: { documents: DocumentRecord[]; selectedDoc: DocumentRecord | null; onSelect: (id: string) => void; onUpload: () => void; onRefresh: (id: string) => void }) {
  return (
    <div className="documents-layout">
      <Panel title="Documentos da Sessao" icon={Database} className="table-panel">
        <div className="table-toolbar">
          <button className="primary-button small" onClick={onUpload}>Upload</button>
          {selectedDoc && <button className="secondary-inline" onClick={() => onRefresh(selectedDoc.id)}><RefreshCw size={14} /> Atualizar Selecionado</button>}
        </div>

        {documents.length === 0 ? <EmptyState title="Nenhum documento carregado" text="Use Upload para enviar um arquivo real ao backend." /> : (
          <table className="data-table">
            <thead><tr><th>Documento</th><th>Status</th><th>Criado</th></tr></thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className={`${selectedDoc?.id === doc.id ? 'selected' : ''} ${doc.error ? 'document-error' : ''}`} onClick={() => onSelect(doc.id)}>
                  <td><div className="doc-name"><FileCode2 size={16} /><div><strong>{doc.name}</strong><small>{doc.id}</small></div></div></td>
                  <td><DocumentStatus doc={doc} compact /></td>
                  <td>{doc.createdAt ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <aside className="inspector">
        <div className="inspector-header">
          <div>
            <span>Inspector</span>
            <strong>{selectedDoc?.name ?? 'Nenhum documento'}</strong>
          </div>
          <button><X size={16} /></button>
        </div>
        <div className="inspector-body">
          {!selectedDoc ? <EmptyState title="Selecione um documento" text="Depois do upload, os detalhes aparecem aqui." /> : (
            <>
              <DocumentStatus doc={selectedDoc} />
              <ProcessingTimeline doc={selectedDoc} />
              {selectedDoc.error && <div className="error-callout"><AlertCircle size={16} /><span>{selectedDoc.error}</span></div>}
              <SummaryCard summary={selectedDoc.summary} />
              <div className="detail-grid">
                <Detail label="ID" value={selectedDoc.id} />
                <Detail label="Versao" value={selectedDoc.processingVersionId ?? '-'} />
                <Detail label="Action Items" value={selectedDoc.actionItems} />
                <Detail label="Atualizado" value={selectedDoc.updatedAt ?? '-'} />
                <Detail label="Ultima checagem" value={selectedDoc.lastCheckedAt ?? '-'} />
                <Detail label="Hash" value={selectedDoc.sourceHash ?? '-'} />
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function SummaryCard({ summary }: { summary?: string | null }) {
  const text = summary ? finishUiSentence(truncate(summary, 760)) : '';
  return (
    <div className="summary-card">
      <span>Leitura executiva</span>
      <p>{text || 'Resumo ainda nao disponivel. Quando o processamento terminar, a sintese executiva do documento aparece aqui.'}</p>
    </div>
  );
}

function DocumentStatus({ doc, compact = false }: { doc: DocumentRecord; compact?: boolean }) {
  const progress = documentProgress(doc);
  const active = isDocumentActive(doc);
  const done = isDocumentDone(doc);
  const rejected = isDocumentRejected(doc);
  const tone = doc.error || rejected ? 'danger' : done ? 'success' : active ? 'warning' : 'default';
  const statusHelp = doc.error
    ? 'Processamento interrompido.'
    : rejected
      ? 'Arquivo rejeitado. Envie o documento fonte original, nao um relatorio exportado pela Schema API.'
      : active
        ? 'Worker processando documento em segundo plano.'
        : done
          ? 'Documento pronto para busca, RAG e GraphRAG.'
          : 'Aguardando atualizacao do backend.';

  return (
    <div className={`doc-status ${compact ? 'compact' : ''}`}>
      <div className="doc-status-row">
        <Pill tone={tone}>{doc.error ? 'Erro' : statusTitle(doc.status)}</Pill>
        {!compact && <span>{progress}%</span>}
      </div>
      <div className={`progress-track ${active ? 'active' : ''} ${doc.error || rejected ? 'failed' : ''}`}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      {!compact && <small>{statusHelp}</small>}
    </div>
  );
}

function ProcessingTimeline({ doc }: { doc: DocumentRecord }) {
  const progress = documentProgress(doc);
  const rejected = isDocumentRejected(doc);
  return (
    <div className="processing-timeline">
      {processingSteps.map((step, index) => {
        const threshold = (index / (processingSteps.length - 1)) * 100;
        const complete = progress >= threshold && !doc.error && !rejected;
        const current = !doc.error && !rejected && progress < 100 && progress >= threshold && progress < threshold + 22;
        return (
          <div className={`timeline-step ${complete ? 'complete' : ''} ${current ? 'current' : ''} ${(doc.error || rejected) && index === 0 ? 'failed' : ''}`} key={step}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </div>
        );
      })}
    </div>
  );
}

function ScopeNotice({ contexts }: { contexts: AutoContext[] }) {
  const context = activeContext(contexts);
  return (
    <div className="scope-notice">
      <Network size={14} />
      <div>
        <strong>{contextScopeLabel(contexts)}</strong>
        <span>{context ? (context.topics ?? []).slice(0, 3).join(' • ') || 'Temas detectados automaticamente' : 'O sistema define o conjunto de busca assim que houver documentos prontos.'}</span>
      </div>
    </div>
  );
}

function SearchView({ query, setQuery, result, contexts, onRun }: { query: string; setQuery: (value: string) => void; result: any; contexts: AutoContext[]; onRun: () => void }) {
  const results = dedupeByChunk(asArray(result)).slice(0, 12);
  const warnings = warningItems(result);
  const sourceMissing = warnings.some((warning: string) => warning === 'source_document_missing');
  return (
    <div className="flow-layout">
      <Panel title="Busca Hibrida" icon={Search} className="command-panel">
        <div className="command-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onRun()} placeholder="Buscar por termo, metrica, codigo, entidade ou conceito..." />
          <button className="primary-button" onClick={onRun}>Buscar</button>
        </div>
        <ScopeNotice contexts={contexts} />
      </Panel>

      <Panel title="Resultados" icon={Search} className="result-panel">
        {!result ? <EmptyState title="Nenhuma busca executada" text="Digite uma consulta para recuperar trechos indexados." /> : results.length === 0 ? (
          <>
            {warnings.length > 0 && <WarningStrip warnings={warnings} />}
            <EmptyState
              title={sourceMissing ? 'Fonte original ausente' : 'Sem resultados'}
              text={sourceMissing ? 'A base atual contem apenas relatorio gerado pela Schema API, entao a busca nao vai apresentar isso como evidencia.' : 'A API respondeu sem chunks para esta consulta.'}
            />
          </>
        ) : (
          <>
            {warnings.length > 0 && <WarningStrip warnings={warnings} />}
            <div className="results-list">
              {results.map((item: any, index: number) => <SearchResultCard item={item} index={index} key={`${item.chunk_id ?? index}`} />)}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function SearchResultCard({ item, index }: { item: any; index: number }) {
  const title = displayTitle(item.title ?? item.section_title ?? chunkSection(item), `Resultado ${index + 1}`);
  const excerpt = finishUiSentence(truncate(item.excerpt ?? item.snippet ?? chunkText(item), 760));
  const reason = cleanText(item.relevance_reason ?? item.reason ?? '');
  const document = item.document_title ?? item.document_id ?? item.source_document ?? 'Documento indexado';
  return (
    <article className="result-card polished-result">
      <header>
        <div>
          <strong>{index + 1}. {title}</strong>
          <small>{document}</small>
        </div>
        <div className="result-meta">
          <Pill>{humanRankSource(item.rank_source)}</Pill>
          <Pill tone={String(item.evidence_strength ?? '').toLowerCase().includes('weak') ? 'warning' : 'success'}>{evidenceLabel(item.evidence_strength)}</Pill>
          <Pill tone={chunkScore(item) > 0.02 ? 'success' : 'default'}>{chunkScore(item).toFixed(3)}</Pill>
        </div>
      </header>
      {reason && <div className="result-reason"><CheckCircle2 size={14} />{finishUiSentence(reason)}</div>}
      <p>{excerpt}</p>
      <footer>{item.chunk_id ?? item.id ?? '-'}</footer>
    </article>
  );
}

function RagView({ query, setQuery, result, contexts, onRun }: { query: string; setQuery: (value: string) => void; result: any; contexts: AutoContext[]; onRun: () => void }) {
  const citations = dedupeByChunk(asArray(result?.citations)).slice(0, 8);
  const sections = splitAnswerSectionsClean(result?.answer);
  const warnings = warningItems(result);
  return (
    <div className="flow-layout">
      <Panel title="Pergunta RAG" icon={BrainCircuit} className="command-panel">
        <div className="command-bar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onRun()} placeholder="Pergunte algo sobre os documentos processados..." />
          <button className="primary-button" onClick={onRun}>Perguntar</button>
        </div>
        <ScopeNotice contexts={contexts} />
      </Panel>

      <Panel title="Resposta" icon={FileText} className="answer-panel">
        {!result ? <EmptyState title="Nenhuma pergunta executada" text="A resposta virá de /rag/query com citações recuperadas." /> : (
          <div className="rag-answer-stack">
            {warnings.length > 0 && <WarningStrip warnings={warnings} />}
            <div className="answer executive-answer">
              <span>Resposta direta</span>
              <p>{directAnswer(result.answer)}</p>
            </div>
            <div className="answer-sections">
              {sections.evidence.length > 0 && <AnswerSection title="Evidências principais" items={sections.evidence} />}
              {sections.metrics.length > 0 && <AnswerSection title="Métricas extraídas" items={sections.metrics} />}
              {sections.attention.length > 0 && <AnswerSection title="Pontos de atenção" items={sections.attention} />}
              {sections.sources.length > 0 && <AnswerSection title="Fontes" items={sections.sources} compact />}
            </div>
            <div className="citation-grid">
              {citations.map((citation: any, index: number) => (
                <article className="citation" key={`${citation.chunk_id ?? index}`}>
                  <strong>{index + 1}. {citation.section_title ?? 'Citação recuperada'}</strong>
                  <span>{citation.chunk_id ?? '-'}</span>
                  {citation.relevance_reason && <div className="citation-reason">{finishUiSentence(citation.relevance_reason)}</div>}
                  <p>{finishUiSentence(truncate(citation.snippet ?? citation.chunk_text ?? citation.text, 520))}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function WarningStrip({ warnings }: { warnings: string[] }) {
  return (
    <div className="warning-strip">
      <AlertCircle size={16} />
      <div>
        {warnings.map((warning) => <span key={warning}>{warningLabel(warning)}</span>)}
      </div>
    </div>
  );
}

function AnalysisView({
  documents,
  contexts,
  searchHistory,
  ragHistory,
  evalResult,
}: {
  documents: DocumentRecord[];
  contexts: AutoContext[];
  searchHistory: QuerySession[];
  ragHistory: QuerySession[];
  evalResult: any;
}) {
  const [notes, setNotes] = useState('');
  const [savedReport, setSavedReport] = useState<AnalysisReportRecord | null>(null);
  const [reportHistory, setReportHistory] = useState<AnalysisReportRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const report = buildAnalysisReport({ documents, contexts, searchHistory, ragHistory, evalResult });
  const hasInputs = searchHistory.length > 0 || ragHistory.length > 0;
  const finalMarkdown = notes.trim() ? `${report.markdown}\n\n## Observacoes do analista\n${notes.trim()}` : report.markdown;
  const quality = evalResult ? Math.round(((Number(evalResult.faithfulness ?? 0) + Number(evalResult.answer_relevance ?? 0) + Number(evalResult.groundedness ?? 0)) / 3) * 100) : 0;
  const activeReport: AnalysisReportBuild = savedReport
    ? {
        title: savedReport.title,
        executive: savedReport.executive_summary ?? report.executive,
        conclusions: markdownSectionItems(savedReport.markdown, 'Conclusoes consolidadas').length
          ? markdownSectionItems(savedReport.markdown, 'Conclusoes consolidadas')
          : report.conclusions,
        evidence: markdownSectionItems(savedReport.markdown, 'Principais evidencias').length
          ? markdownSectionItems(savedReport.markdown, 'Principais evidencias')
          : stringList(savedReport.evidence),
        metrics: markdownSectionItems(savedReport.markdown, 'Metricas e variacoes').length
          ? markdownSectionItems(savedReport.markdown, 'Metricas e variacoes')
          : stringList(savedReport.metrics),
        attention: markdownSectionItems(savedReport.markdown, 'Pontos de atencao').length
          ? markdownSectionItems(savedReport.markdown, 'Pontos de atencao')
          : stringList(savedReport.risks),
        sources: markdownSectionItems(savedReport.markdown, 'Fontes').length
          ? markdownSectionItems(savedReport.markdown, 'Fontes')
          : stringList(savedReport.sources),
        coverage: report.coverage,
        topics: report.topics,
        mix: report.mix,
        qualitySeries: report.qualitySeries,
        markdown: savedReport.markdown ?? finalMarkdown,
      }
    : report;

  async function loadReports() {
    try {
      const value = await window.schemaApi.analysisReports(12);
      setReportHistory(asArray(value) as AnalysisReportRecord[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function createReport() {
    setIsGenerating(true);
    setError(null);
    try {
      const payload = {
        title: report.title,
        scope_label: activeContext(contexts)?.label ?? null,
        document_ids: documents.map((doc) => doc.id),
        search_queries: searchHistory.map((item) => item.query),
        rag_queries: ragHistory.map((item) => item.query),
        executive_summary: report.executive,
        evidence: report.evidence,
        metrics: report.metrics,
        risks: report.attention,
        sources: report.sources,
        notes,
        markdown: finalMarkdown,
      };
      const created = await window.schemaApi.analysisCreate(payload) as AnalysisReportRecord;
      setSavedReport(created);
      await loadReports();
      return created;
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : String(createError);
      setError(message);
      throw createError;
    } finally {
      setIsGenerating(false);
    }
  }

  async function exportReport(format: 'md' | 'doc' | 'pdf') {
    setError(null);
    try {
      const current = savedReport?.id ? savedReport : await createReport();
      if (!current.id) throw new Error('Relatorio salvo sem identificador.');
      const exported = await window.schemaApi.analysisExport(current.id, format);
      downloadBase64File(exported.fileName, exported.contentBase64, exported.mimeType);
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : String(exportError);
      setError(message);
      if (format === 'md') {
        downloadTextFile(`schema-api-analise-${filenameStamp()}.md`, finalMarkdown, 'text/markdown;charset=utf-8');
      }
      if (format === 'doc') {
        downloadTextFile(`schema-api-analise-${filenameStamp()}.doc`, reportDocumentHtml(finalMarkdown), 'application/msword;charset=utf-8');
      }
    }
  }

  const reportActions = hasInputs ? (
    <div className="analysis-header-actions">
      <button className="primary-button small" onClick={createReport} disabled={isGenerating}>{isGenerating ? 'Gerando...' : 'Gerar Analise'}</button>
      <button className="secondary-inline" onClick={() => copyText(activeReport.markdown)}><ClipboardCopy size={14} /> Copiar</button>
      <button className="secondary-inline" onClick={() => exportReport('md')}><Download size={14} /> Markdown</button>
      <button className="secondary-inline" onClick={() => exportReport('pdf')}><FileDown size={14} /> PDF</button>
      <button className="primary-button small" onClick={() => exportReport('doc')}><FileDown size={14} /> DOC</button>
    </div>
  ) : null;

  return (
    <div className="analysis-layout">
      <Panel title="Base da Analise" icon={Layers} className="analysis-side-panel">
        <div className="analysis-stats">
          <Detail label="Documentos" value={documents.length} />
          <Detail label="Perguntas RAG" value={ragHistory.length} />
          <Detail label="Buscas" value={searchHistory.length} />
          <Detail label="Qualidade" value={evalResult ? `${quality}%` : '-'} />
        </div>

        <div className="analysis-history">
          <h3>Relatorios salvos</h3>
          {reportHistory.length === 0 ? <span>Nenhum relatorio exportavel salvo ainda.</span> : reportHistory.slice(0, 5).map((item) => (
            <button className="analysis-history-item" key={item.id ?? item.created_at} onClick={() => setSavedReport(item)}>
              <strong>{item.title}</strong>
              <span>{formatDateTime(item.created_at)}</span>
            </button>
          ))}
        </div>

        <div className="analysis-history">
          <h3>Perguntas consideradas</h3>
          {ragHistory.length === 0 ? <span>Nenhuma pergunta RAG nesta sessao.</span> : ragHistory.slice(0, 5).map((item) => <p key={`${item.createdAt}-${item.query}`}>{item.query}</p>)}
        </div>

        <div className="analysis-history">
          <h3>Buscas consideradas</h3>
          {searchHistory.length === 0 ? <span>Nenhuma busca hibrida nesta sessao.</span> : searchHistory.slice(0, 5).map((item) => <p key={`${item.createdAt}-${item.query}`}>{item.query}</p>)}
        </div>

        <textarea className="analysis-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Adicione observacoes do analista antes de exportar..." />
      </Panel>

      <Panel title="Relatorio Executivo" icon={FilePieChart} className="analysis-report-panel" actions={reportActions}>
        {!hasInputs ? <EmptyState title="Analise pronta para gerar" text="Execute buscas e perguntas RAG; o relatorio sera montado a partir desses resultados reais." /> : (
          <div className="analysis-report">
            {error && <div className="analysis-error"><AlertCircle size={15} /> {error}</div>}
            {savedReport?.id && (
              <div className="analysis-report-meta">
                <span>Relatorio salvo</span>
                <strong>{savedReport.id}</strong>
              </div>
            )}

            <section className="report-hero">
              <span>Analise executiva</span>
              <h2>{activeReport.title}</h2>
              <p>{activeReport.executive}</p>
            </section>

            <ReportCoverage coverage={activeReport.coverage} />
            <ReportCharts topics={activeReport.topics} mix={activeReport.mix} qualitySeries={activeReport.qualitySeries} />

            <div className="report-grid">
              <ReportSection title="Conclusoes consolidadas" items={activeReport.conclusions} wide />
              <ReportSection title="Evidencias principais" items={activeReport.evidence} />
              <ReportSection title="Metricas e variacoes" items={activeReport.metrics} />
              <ReportSection title="Pontos de atencao" items={activeReport.attention} />
              <ReportSection title="Fontes" items={activeReport.sources} />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ReportCharts({
  topics,
  mix,
  qualitySeries,
}: {
  topics: AnalysisChartDatum[];
  mix: AnalysisChartDatum[];
  qualitySeries: AnalysisChartDatum[];
}) {
  const maxTopic = Math.max(1, ...topics.map((item) => item.value));
  const totalMix = Math.max(1, mix.reduce((sum, item) => sum + item.value, 0));

  return (
    <section className="report-visuals">
      <article className="report-chart-card">
        <header>
          <div>
            <BarChart3 size={15} />
            <strong>Temas consolidados</strong>
          </div>
          <span>RAG + busca</span>
        </header>
        <div className="report-bars">
          {topics.length === 0 ? <p>Nenhum tema inferido ainda.</p> : topics.map((item) => (
            <div className="report-bar-row" key={item.label}>
              <span>{item.label}</span>
              <div className="report-bar-track">
                <div className="report-bar-fill" style={{ width: `${Math.max(8, (item.value / maxTopic) * 100)}%` }} />
              </div>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="report-chart-card">
        <header>
          <div>
            <PieChart size={15} />
            <strong>Composicao</strong>
          </div>
          <span>insumos</span>
        </header>
        {mix.length === 0 ? <p>Nenhum insumo consolidado ainda.</p> : (
          <>
            <div className="report-composition-track">
              {mix.map((item, index) => (
                <span
                  className="report-composition-segment"
                  key={item.label}
                  style={{ width: `${Math.max(5, (item.value / totalMix) * 100)}%`, opacity: 1 - index * 0.08 }}
                />
              ))}
            </div>
            <div className="report-mix-list">
              {mix.map((item) => (
                <div className="report-mix-row" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </article>

      <article className="report-chart-card">
        <header>
          <div>
            <LineChart size={15} />
            <strong>Qualidade</strong>
          </div>
          <span>avaliacao</span>
        </header>
        <div className="report-quality-strip">
          {qualitySeries.length === 0 ? <p>Nenhuma avaliacao carregada.</p> : qualitySeries.map((item) => (
            <div className="report-quality-item" key={item.label}>
              <span>{item.label}</span>
              <div className="report-bar-track">
                <div className="report-bar-fill" style={{ width: `${Math.max(4, Math.min(100, item.value))}%` }} />
              </div>
              <strong>{item.value}%</strong>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function ReportCoverage({ coverage }: { coverage: AnalysisCoverage }) {
  const items = [
    { label: 'Documentos', value: String(coverage.documents), hint: 'fontes processadas' },
    { label: 'Perguntas RAG', value: String(coverage.ragQueries), hint: 'consultas consolidadas' },
    { label: 'Buscas', value: String(coverage.searchQueries), hint: 'recuperacoes hibridas' },
    { label: 'Conclusoes', value: String(coverage.conclusions), hint: 'leituras sintetizadas' },
    { label: 'Evidencias', value: String(coverage.evidence), hint: 'trechos usados' },
    { label: 'Qualidade', value: coverage.quality ? `${coverage.quality}%` : '-', hint: 'avaliacao atual' },
  ];

  return (
    <section className="report-coverage">
      {items.map((item) => (
        <article className="coverage-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.hint}</small>
        </article>
      ))}
    </section>
  );
}

function ReportSection({ title, items, wide = false }: { title: string; items: string[]; wide?: boolean }) {
  const cleanItems = uniqueTexts(items.map((item) => finishUiSentence(item)).filter(Boolean), 7);
  return (
    <section className={`report-section ${wide ? 'wide' : ''}`}>
      <h3>{title}</h3>
      {cleanItems.length === 0 ? <p>Nenhum item consolidado ainda.</p> : (
        <ul>
          {cleanItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}

function AnswerSection({ title, items, compact = false }: { title: string; items: string[]; compact?: boolean }) {
  const cleanItems = uniqueTexts(items.map((item) => finishUiSentence(item)).filter(Boolean), compact ? 4 : 6);
  if (cleanItems.length === 0) return null;
  return (
    <section className={`answer-section ${compact ? 'compact' : ''}`}>
      <h3>{title}</h3>
      <ul>
        {cleanItems.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function GovernanceView({ text, setText, piiResult, auditResult, onRedact, onAudit }: { text: string; setText: (value: string) => void; piiResult: any; auditResult: any; onRedact: () => void; onAudit: () => void }) {
  return (
    <div className="governance-layout">
      <Panel title="Redacao de PII" icon={ShieldAlert} className="pii-panel">
        <div className="text-command">
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Cole um texto real para detectar e mascarar dados sensiveis..." />
          <button className="primary-button" onClick={onRedact}>Redigir PII</button>
        </div>
        {piiResult ? <PiiResult result={piiResult} /> : <EmptyState title="Nenhuma redacao executada" text="O resultado aparecera como texto redigido e achados classificados." />}
      </Panel>

      <Panel title="Auditoria" icon={Server} className="audit-panel">
        <div className="table-toolbar">
          <button className="primary-button small" onClick={onAudit}>Carregar Auditoria</button>
        </div>
        <AuditTable audit={auditResult} />
      </Panel>
    </div>
  );
}

function PiiResult({ result }: { result: any }) {
  const findings = asArray(result?.findings);
  const redacted = String(result?.redacted_text ?? '');
  return (
    <div className="pii-result">
      <div className="pii-summary">
        <strong>{findings.length} dado(s) sensiveis encontrados</strong>
        <button className="secondary-inline" onClick={() => copyText(redacted)}><ClipboardCopy size={14} /> Copiar texto</button>
      </div>
      <div className="redacted-text">{redacted || 'Nenhum texto redigido retornado.'}</div>
      <div className="finding-list">
        {findings.map((finding: any, index: number) => (
          <div className="finding-chip" key={`${finding.pii_type ?? index}`}>
            <strong>{finding.pii_type ?? finding.type ?? 'PII'}</strong>
            <span>{finding.sample ?? '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTable({ audit }: { audit: any }) {
  const rows = asArray(audit).slice(0, 12);
  if (!audit) return <EmptyState title="Auditoria nao carregada" text="Clique para buscar eventos reais de governanca." />;
  if (rows.length === 0) return <EmptyState title="Sem eventos" text="A API não retornou eventos de auditoria." />;
  return (
    <table className="data-table audit-table">
      <thead><tr><th>Acao</th><th>Perfil</th><th>Registro</th><th>Quando</th></tr></thead>
      <tbody>
        {rows.map((row: any) => (
          <tr key={row.id}>
            <td><StatusBadge status={humanEvent(row.event_type ?? 'evento')} /></td>
            <td>{humanActor(row.actor_role)}</td>
            <td>{truncate(row.details?.query ?? row.details?.tool ?? compactJson(row.details), 110)}</td>
            <td>{formatDateTime(row.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AgentsView({ tools, runs, goal, setGoal, selectedTool, setSelectedTool, onCreate, onApprove, onReloadTools }: { tools: AgentTool[]; runs: AgentRun[]; goal: string; setGoal: (value: string) => void; selectedTool: string; setSelectedTool: (value: string) => void; onCreate: () => void; onApprove: (id: string) => void; onReloadTools: () => void }) {
  return (
    <div className="agents-layout">
      <Panel title="Capacidades do Assistente" icon={FileCode2} className="tools-panel">
        <button className="secondary-inline" onClick={onReloadTools}><RefreshCw size={14} /> Atualizar capacidades</button>
        {tools.length === 0 ? <EmptyState title="Nenhuma ferramenta carregada" text="Verifique se a API esta online." /> : tools.map((tool) => (
          <button className={`tool-chip ${selectedTool === tool.name ? 'selected-tool' : ''}`} key={tool.name} onClick={() => setSelectedTool(tool.name)}>
            <span>{toolTitle(tool.name)}</span>
            <small>{toolDescription(tool.name)}</small>
            <Pill tone={tool.risk === 'mutation-sensitive' ? 'warning' : 'default'}>{riskTitle(tool.risk)}</Pill>
          </button>
        ))}
      </Panel>

      <Panel title="Nova Tarefa Assistida" icon={Bot} className="agent-create-panel">
        <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Descreva a tarefa que o assistente deve executar com base nos documentos..." />
        <div className="agent-action-row">
          <Detail label="Capacidade" value={selectedTool ? toolTitle(selectedTool) : '-'} />
          <button className="primary-button" onClick={onCreate}>Criar Tarefa</button>
        </div>
      </Panel>

      <Panel title="Atividades Recentes" icon={GitBranch} className="execution-panel">
        {runs.length === 0 ? <EmptyState title="Nenhuma atividade criada" text="Crie uma tarefa para acompanhar plano, evidencias e resultado." /> : runs.map((run) => (
          <article className="agent-run-card" key={run.id}>
            <header><strong>{agentSummary(run)}</strong><StatusBadge status={statusTitle(run.status ?? 'unknown')} /></header>
            <p>{run.goal ?? '-'}</p>
            <div className="agent-outcome">{agentOutcome(run)}</div>
            <div className="run-meta">
              <Detail label="Capacidade" value={toolTitle(run.requested_tool ?? run.requestedTool ?? '-')} />
              <Detail label="Controle" value={riskTitle(run.tool_risk ?? run.toolRisk ?? '-')} />
            </div>
            <div className="agent-step-list">
              {agentSteps(run).map((step: { label: string; done: boolean }) => <span className={step.done ? 'done' : ''} key={step.label}>{step.label}</span>)}
            </div>
            {run.result ? (
              <details className="technical-details">
                <summary>Ver detalhes tecnicos</summary>
                <pre className="compact-pre">{compactJson(run.result)}</pre>
              </details>
            ) : null}
            {(run.approval_required ?? false) && !run.approved_by && !run.approvedBy && <button className="primary-button danger" onClick={() => onApprove(run.id)}>Aprovar Tarefa</button>}
          </article>
        ))}
      </Panel>
    </div>
  );
}

function ObservabilityView({ evalResult, history, events, tab, setTab, onEvaluate, onLatest, onHistory }: { evalResult: any; history: any[]; events: string[]; tab: ObsTab; setTab: (tab: ObsTab) => void; onEvaluate: () => void; onLatest: () => void; onHistory: () => void }) {
  return (
    <div className="observability-grid observability-grid-real">
      <Panel title="Qualidade do RAG" icon={BarChart3} className="eval-panel">
        <div className="obs-toolbar">
          <div className="segmented-control">
            <button className={tab === 'evaluation' ? 'active' : ''} onClick={() => setTab('evaluation')}>Avaliação</button>
            <button className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); onHistory(); }}>Histórico</button>
            <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>Eventos</button>
          </div>
          <div className="toolbar-actions">
            <button className="primary-button small" onClick={onEvaluate}>Avaliar ultima consulta</button>
            <button className="secondary-inline" onClick={onLatest}>Carregar última avaliação</button>
            {tab === 'history' && <button className="secondary-inline" onClick={onHistory}>Atualizar Histórico</button>}
          </div>
        </div>
        {tab === 'evaluation' ? <EvalDetails result={evalResult} /> : tab === 'history' ? <EvalHistory history={history} /> : <EventHistory events={events} />}
      </Panel>
    </div>
  );
}

function EventHistory({ events }: { events: string[] }) {
  if (events.length === 0) return <EmptyState title="Nenhum evento registrado" text="As operacoes da sessao aparecem aqui em ordem recente." />;
  return (
    <div className="event-history">
      {events.map((event) => (
        <div className="event-history-row" key={event}>
          <Activity size={14} />
          <span>{event}</span>
        </div>
      ))}
    </div>
  );
}

function EvalDetails({ result }: { result: any }) {
  if (!result) return <EmptyState title="Nenhuma avaliação carregada" text="Execute uma consulta RAG e depois avalie a última consulta." />;
  const metrics = [
    ['Fidelidade', result.faithfulness, 'Resposta sustentada pelas fontes recuperadas.'],
    ['Precisao do contexto', result.context_precision, 'Trechos recuperados realmente uteis para a pergunta.'],
    ['Alinhamento da resposta', result.answer_relevance, 'Resposta conectada ao que foi perguntado.'],
    ['Aderencia as fontes', result.groundedness, 'Baixo risco de afirmacoes soltas.'],
  ];
  return (
    <div className="eval-stack">
      <div className="eval-metric-grid">
        {metrics.map(([label, value, description]) => <EvalMetric key={String(label)} label={String(label)} value={Number(value ?? 0)} description={String(description)} />)}
      </div>
      <div className="summary-card">
        <span>Leitura da avaliação</span>
        <p>{interpretEval(result)}</p>
      </div>
      <div className="note-list">
        {asArray(result.notes).map((note: string) => <Pill key={note}>{evalNoteLabel(note)}</Pill>)}
      </div>
    </div>
  );
}

function EvalHistory({ history }: { history: any[] }) {
  if (history.length === 0) return <EmptyState title="Histórico vazio" text="As avaliações carregadas nesta sessão aparecem aqui." />;
  return (
    <table className="data-table">
      <thead><tr><th>ID</th><th>Fidelidade</th><th>Alinhamento</th><th>Aderencia</th><th>Quando</th></tr></thead>
      <tbody>
        {history.map((item) => (
          <tr key={item.id}>
            <td>{item.id}</td>
            <td>{Number(item.faithfulness ?? 0).toFixed(2)}</td>
            <td>{Number(item.answer_relevance ?? 0).toFixed(2)}</td>
            <td>{Number(item.groundedness ?? 0).toFixed(2)}</td>
            <td>{formatDateTime(item.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EvalMetric({ label, value, description }: { label: string; value: number; description: string }) {
  const tone = value >= 0.8 ? 'success' : value >= 0.5 ? 'warning' : 'danger';
  return (
    <div className={`eval-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value.toFixed(2)}</strong>
      <small>{description}</small>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></div>
    </div>
  );
}

function evalNoteLabel(note: unknown) {
  const key = String(note ?? '').toLowerCase();
  if (key.includes('deterministic')) return 'Avaliação determinística';
  if (key.includes('baseline')) return 'Linha de base local';
  return cleanText(note) || 'Observacao';
}

function interpretEval(result: any) {
  const relevance = Number(result.answer_relevance ?? 0);
  const faithfulness = Number(result.faithfulness ?? 0);
  const groundedness = Number(result.groundedness ?? 0);
  if (relevance < 0.5) return 'O contexto recuperado tem sinais aproveitaveis, mas a resposta ainda nao acompanha bem a pergunta. Prioridade: melhorar sintese, deduplicacao e selecao de evidencias.';
  if (faithfulness >= 0.8 && groundedness >= 0.8) return 'A resposta esta bem ancorada nas fontes recuperadas. O proximo ganho esta em clareza executiva e melhor selecao de citacoes.';
  return 'A qualidade esta intermediaria. Revise a recuperacao, a cobertura da pergunta e a leitura final antes de usar como resposta executiva.';
}

function GraphView({ graph, context = null, compact = false }: { graph: any; context?: AutoContext | null; compact?: boolean }) {
  const map = graphNodes(graph, context);
  const topics = map.topics.length > 0 ? map.topics : ['Temas do documento'];
  const facts = map.facts.length > 0 ? map.facts : ['Evidencias recuperadas'];
  if (map.entities === 0 && map.relations === 0) return <EmptyState title="Mapa vazio" text="A API nao retornou relacoes suficientes para montar uma leitura visual." />;

  const visibleTopics = topics.slice(0, 2);
  const visibleFacts = facts.slice(0, 3);
  const topicPositions = [
    { left: '36%', top: '34%' },
    { left: '36%', top: '66%' },
  ];
  const factPositions = [
    { left: '68%', top: '31%' },
    { left: '68%', top: '50%' },
    { left: '68%', top: '69%' },
  ];
  const relationText = map.relations === 1 ? '1 relacao organizada' : `${map.relations} relacoes organizadas`;
  const entityText = map.entities === 1 ? '1 entidade relevante' : `${map.entities} entidades relevantes`;
  const fallbackSummary = `${visibleFacts.length} ${visibleFacts.length === 1 ? 'evidencia priorizada' : 'evidencias priorizadas'} em ${visibleTopics.length} ${visibleTopics.length === 1 ? 'contexto' : 'contextos'}`;

  return (
    <>
      <div className={`evidence-map ${compact ? 'compact-map' : ''}`}>
        <svg viewBox="0 0 1100 430" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <marker id="arrow-soft" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L10,5 L0,10 Z" />
            </marker>
            <marker id="arrow-strong" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L10,5 L0,10 Z" />
            </marker>
            <linearGradient id="map-flow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#0f766e" stopOpacity="0.16" />
              <stop offset="55%" stopColor="#14b8a6" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#0f766e" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <rect className="map-flow-fill" x="170" y="108" width="760" height="216" rx="32" />
          <path className="map-link strong" d="M255 215 C315 150 365 154 456 154" />
          <path className="map-link strong" d="M255 215 C315 280 365 276 456 276" />
          <path className="map-link" d="M505 154 C575 124 636 130 705 132" />
          <path className="map-link muted" d="M505 154 C580 178 635 200 705 215" />
          <path className="map-link muted" d="M505 276 C580 252 635 230 705 215" />
          <path className="map-link" d="M505 276 C575 306 636 300 705 298" />
          <path className="map-link strong" d="M828 132 C884 154 910 180 924 215" />
          <path className="map-link strong" d="M828 215 C872 215 898 215 924 215" />
          <path className="map-link strong" d="M828 298 C884 276 910 250 924 215" />
          <text x="326" y="82">contexto inferido</text>
          <text x="704" y="82">evidencias priorizadas</text>
        </svg>
        <div className="map-node source" style={{ left: '13%', top: '50%' }}>
          <span>Entrada</span>
          <strong>{map.source}</strong>
        </div>
        {visibleTopics.map((label, index) => (
          <div className="map-node topic" style={topicPositions[index]} key={`topic-${label}`}>
            <span>Contexto</span>
            <strong>{truncate(label, 42)}</strong>
          </div>
        ))}
        {visibleFacts.map((label, index) => (
          <div className="map-node fact" style={factPositions[index]} key={`fact-${label}`}>
            <span>Evidencia</span>
            <strong>{truncate(label, 46)}</strong>
          </div>
        ))}
        <div className="map-node conclusion" style={{ left: '90%', top: '50%' }}>
          <span>Saida</span>
          <strong>Resposta auditavel</strong>
        </div>
      </div>
      <div className="graph-summary">
        <div>
          <strong>Mapa de evidencias</strong>
          <span>{map.relations > 0 ? `${relationText} a partir de ${entityText}` : fallbackSummary}</span>
        </div>
        <Pill tone="success">{visibleTopics.length + visibleFacts.length + 2} itens visiveis</Pill>
      </div>
    </>
  );
}

function Panel({ title, icon: Icon, children, className = '', actions = null }: { title: string; icon: LucideIcon; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-header">
        <div className="panel-header-title"><Icon size={16} /><span>{title}</span></div>
        {actions && <div className="panel-header-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: LucideIcon }) {
  return (
    <div className="metric-card">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  return <div className="detail"><span>{label}</span><strong>{value}</strong></div>;
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  const tone = lower.includes('online') || lower.includes('processed') || lower.includes('executed') || lower.includes('processado') ? 'success' : lower.includes('offline') || lower.includes('failed') || lower.includes('erro') ? 'danger' : 'warning';
  return <Pill tone={tone}>{statusTitle(status)}</Pill>;
}

function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'default' }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{text}</span>
      {action}
    </div>
  );
}
