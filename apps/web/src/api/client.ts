import { Job, Tag, GraphData, ReportData } from '../types';
import { INITIAL_TAGS, MOCK_GRAPH, MOCK_REPORT } from '../mocks/fixtures';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

export class ApiError extends Error {
  code: string;
  details?: unknown[];
  requestId?: string;

  constructor(message: string, code: string, details?: unknown[], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

// In-memory store for mock operations
let mockTags: Tag[] = [...INITIAL_TAGS];
let mockGraph: GraphData = JSON.parse(JSON.stringify(MOCK_GRAPH));

export const apiClient = {
  async createJob(pdfFile: File, xlsxFile: File): Promise<{ job_id: string; status: string }> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 600));
      return { job_id: 'mock-job-' + Date.now(), status: 'queued' };
    }

    const formData = new FormData();
    formData.append('pid_pdf', pdfFile);
    formData.append('io_list_xlsx', xlsxFile);

    const headers: Record<string, string> = {};
    if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`;

    try {
      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new ApiError(
          errJson?.error?.message || 'Upload failed',
          errJson?.error?.code || 'INTERNAL',
          errJson?.error?.details,
          errJson?.error?.request_id
        );
      }

      return await res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      // Graceful fallback to mock mode if backend server is not running
      console.warn('Backend unavailable, operating in demo mode');
      return { job_id: 'demo-job-' + Date.now(), status: 'queued' };
    }
  },

  async getJob(jobId: string): Promise<Job> {
    if (USE_MOCKS || jobId.startsWith('mock-') || jobId.startsWith('demo-')) {
      return {
        job_id: jobId,
        status: 'done',
        stage: 'report',
        progress: 1.0,
        pages: 1,
        summary: { resolved: 6, needs_review: 2, rejected: 0 },
      };
    }

    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new ApiError('Failed to fetch job', 'JOB_NOT_FOUND');
    return await res.json();
  },

  async getTags(jobId: string, status?: string): Promise<Tag[]> {
    if (USE_MOCKS || jobId.startsWith('mock-') || jobId.startsWith('demo-')) {
      if (!status) return mockTags;
      return mockTags.filter((t) => t.status === status);
    }

    const url = new URL(`${window.location.origin}${API_BASE}/jobs/${jobId}/tags`);
    if (status) url.searchParams.set('status', status);

    const res = await fetch(url.toString());
    if (!res.ok) throw new ApiError('Failed to fetch tags', 'TAG_NOT_FOUND');
    return await res.json();
  },

  async updateTag(jobId: string, tagId: string, normalizedTag: string, type?: string): Promise<Tag> {
    if (USE_MOCKS || jobId.startsWith('mock-') || jobId.startsWith('demo-')) {
      await new Promise((r) => setTimeout(r, 200));
      const idx = mockTags.findIndex((t) => t.id === tagId);
      if (idx !== -1) {
        mockTags[idx] = {
          ...mockTags[idx],
          normalized_tag: normalizedTag,
          type: type || mockTags[idx].type,
          confidence: 1.0,
          status: 'resolved',
          source: 'human',
          reasoning: `Human operator verified: ${normalizedTag}`,
        };
        // Update corresponding graph node
        mockGraph.nodes = mockGraph.nodes.map((n) =>
          n.tag_id === tagId ? { ...n, id: normalizedTag, confidence: 1.0 } : n
        );
        return mockTags[idx];
      }
      throw new ApiError('Tag not found', 'TAG_NOT_FOUND');
    }

    const res = await fetch(`${API_BASE}/jobs/${jobId}/tags/${tagId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ normalized_tag: normalizedTag, type }),
    });

    if (!res.ok) throw new ApiError('Failed to update tag', 'VALIDATION_ERROR');
    return await res.json();
  },

  async rebuildGraph(jobId: string): Promise<{ job_id: string; status: string }> {
    if (USE_MOCKS || jobId.startsWith('mock-') || jobId.startsWith('demo-')) {
      await new Promise((r) => setTimeout(r, 400));
      mockGraph.version += 1;
      return { job_id: jobId, status: 'running' };
    }

    const res = await fetch(`${API_BASE}/jobs/${jobId}/rebuild`, { method: 'POST' });
    if (!res.ok) throw new ApiError('Failed to rebuild graph', 'JOB_STATE_CONFLICT');
    return await res.json();
  },

  async getGraph(jobId: string): Promise<GraphData> {
    if (USE_MOCKS || jobId.startsWith('mock-') || jobId.startsWith('demo-')) {
      return mockGraph;
    }

    const res = await fetch(`${API_BASE}/jobs/${jobId}/graph`);
    if (!res.ok) throw new ApiError('Failed to fetch graph', 'JOB_NOT_FOUND');
    return await res.json();
  },

  async getReport(jobId: string, lang = 'en'): Promise<ReportData> {
    if (USE_MOCKS || jobId.startsWith('mock-') || jobId.startsWith('demo-')) {
      return MOCK_REPORT;
    }

    const res = await fetch(`${API_BASE}/jobs/${jobId}/report?lang=${lang}`);
    if (!res.ok) throw new ApiError('Failed to fetch report', 'JOB_NOT_FOUND');
    return await res.json();
  },
};
