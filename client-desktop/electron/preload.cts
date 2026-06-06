import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('schemaApi', {
  selectDocument: () => ipcRenderer.invoke('dialog:select-document'),
  uploadDocument: () => ipcRenderer.invoke('api:upload-document'),
  health: () => ipcRenderer.invoke('api:health'),
  document: (id: string) => ipcRenderer.invoke('api:document', id),
  graph: (id: string) => ipcRenderer.invoke('api:graph', id),
  autoContexts: () => ipcRenderer.invoke('api:auto-contexts'),
  searchHybrid: (query: string) => ipcRenderer.invoke('api:search-hybrid', query),
  ragQuery: (query: string) => ipcRenderer.invoke('api:rag-query', query),
  redactPii: (text: string) => ipcRenderer.invoke('api:pii-redact', text),
  audit: () => ipcRenderer.invoke('api:audit'),
  evaluateRag: () => ipcRenderer.invoke('api:evaluate-rag'),
  latestRagEval: () => ipcRenderer.invoke('api:latest-rag-eval'),
  ragEvalHistory: () => ipcRenderer.invoke('api:rag-eval-history'),
  analysisCreate: (payload: unknown) => ipcRenderer.invoke('api:analysis-create', payload),
  analysisReports: (limit?: number) => ipcRenderer.invoke('api:analysis-reports', limit),
  analysisExport: (id: string, format: 'md' | 'doc' | 'pdf') => ipcRenderer.invoke('api:analysis-export', id, format),
  agentTools: () => ipcRenderer.invoke('api:agent-tools'),
  createAgentRun: (payload: { goal: string; requested_tool?: string }) => ipcRenderer.invoke('api:create-agent-run', payload),
  approveAgentRun: (id: string, approvedBy: string) => ipcRenderer.invoke('api:approve-agent-run', id, approvedBy),
  platform: () => ipcRenderer.invoke('app:platform'),
});
