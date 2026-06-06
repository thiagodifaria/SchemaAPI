/// <reference types="vite/client" />

interface Window {
  schemaApi: {
    selectDocument: () => Promise<{ canceled: boolean; filePath?: string; fileName?: string }>;
    uploadDocument: () => Promise<{ canceled: boolean; filePath?: string; fileName?: string; documentId?: string }>;
    health: () => Promise<{ ok: boolean; baseUrl?: string; value?: unknown; error?: string }>;
    document: (id: string) => Promise<unknown>;
    graph: (id: string) => Promise<unknown>;
    autoContexts: () => Promise<unknown>;
    searchHybrid: (query: string) => Promise<unknown>;
    ragQuery: (query: string) => Promise<unknown>;
    redactPii: (text: string) => Promise<unknown>;
    audit: () => Promise<unknown>;
    evaluateRag: () => Promise<unknown>;
    latestRagEval: () => Promise<unknown>;
    ragEvalHistory: () => Promise<unknown>;
    analysisCreate: (payload: unknown) => Promise<unknown>;
    analysisReports: (limit?: number) => Promise<unknown>;
    analysisExport: (id: string, format: 'md' | 'doc' | 'pdf') => Promise<{ fileName: string; mimeType: string; contentBase64: string }>;
    agentTools: () => Promise<unknown>;
    createAgentRun: (payload: { goal: string; requested_tool?: string }) => Promise<unknown>;
    approveAgentRun: (id: string, approvedBy: string) => Promise<unknown>;
    platform: () => Promise<string>;
  };
}
