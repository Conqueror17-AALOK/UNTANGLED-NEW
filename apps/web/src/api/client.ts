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
  async loadSampleJob(): Promise<{ job_id: string; status: string }> {
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 600));
      return { job_id: 'mock-sample-' + Date.now(), status: 'queued' };
    }

    try {
      const res = await fetch(`${API_BASE}/jobs/load-sample`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to load sample job from backend');
      }
      return await res.json();
    } catch (err) {
      console.warn('Backend load-sample failed, falling back to demo job', err);
      return { job_id: 'demo-sample-' + Date.now(), status: 'queued' };
    }
  },

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
      const selectedLang = ['en', 'hi', 'mr'].includes(lang) ? lang : 'en';
      const translations: Record<string, Record<string, string>> = {
        hi: {
          report_title: "P&ID आरेख बनाम DCS IO सूची सत्यापन रिपोर्ट",
          report_subtitle: "भौतिक P&ID ब्लूप्रिंट और DCS इलेक्ट्रिकल IO रजिस्टरों के बीच क्रॉस-सत्यापन।",
          total_tags_title: "कुल टैग (Total Tags)",
          resolved_title: "सत्यापित टैग (Resolved)",
          review_req_title: "समीक्षा आवश्यक (Review Req.)",
          decision_split_title: "निर्णय वितरण (Decision Split)",
          missing_drawing_title: "ड्राइंग में अनुपस्थित (Missing in Drawing)",
          missing_io_title: "IO सूची में अनुपस्थित (Missing in IO List)",
          type_mismatch_title: "सिग्नल प्रकार बेमेल (Signal Mismatch)",
          missing_drawing_desc: "DCS IO सूची में उपलब्ध है लेकिन P&ID आरेख पर नहीं मिला।",
          missing_io_desc: "P&ID पर पहचाने गए भौतिक उपकरण जिनके पास IO कनेक्शन नहीं है।",
          manual_valve_desc: "मैनुअल हैंड वाल्व - कोई विद्युत सिग्नल नहीं।",
          matched_status: "मेल खाता है (Matched)",
        },
        mr: {
          report_title: "P&ID रेखाचित्र विरुद्ध DCS IO सूची पडताळणी अहवाल",
          report_subtitle: "P&ID रेखाचित्र आणि DCS इलेक्ट्रिकल IO सूची यांच्यातील अचूक क्रॉस-व्हॅलिडेशन.",
          total_tags_title: "एकूण टॅग्ज (Total Tags)",
          resolved_title: "पडताळणी पूर्ण (Resolved)",
          review_req_title: "पुनरावलोकन आवश्यक (Review Req.)",
          decision_split_title: "निर्णय विभागणी (Decision Split)",
          missing_drawing_title: "रेखाचित्रात गहाळ (Missing in Drawing)",
          missing_io_title: "IO सूचीमध्ये गहाळ (Missing in IO List)",
          type_mismatch_title: "सिग्नल प्रकार जुळत नाही (Signal Mismatch)",
          missing_drawing_desc: "DCS IO सूचीत नोंद आहे परंतु P&ID रेखाचित्रावर आढळले नाही.",
          missing_io_desc: "रेखाचित्रावर आढळलेले भौतिक उपकरणे ज्यांना विद्युत IO जोडणी नाही.",
          manual_valve_desc: "मॅन्युअल हँड व्हॉल्व्ह - कोणतीही इलेक्ट्रिकल जोडणी नाही.",
          matched_status: "जुळले (Matched)",
        },
        en: {
          report_title: "P&ID Drawing vs IO List Cross-Validation Report",
          report_subtitle: "Deterministic discrepancy analysis between physical P&ID blueprints and DCS electrical point registers.",
          total_tags_title: "Total Tags Extracted",
          resolved_title: "Resolved & Verified",
          review_req_title: "Review Required",
          decision_split_title: "Decision Split",
          missing_drawing_title: "Defined in IO List, Missing in Drawing",
          missing_io_title: "Found in Drawing, Missing in IO List",
          type_mismatch_title: "Instrument Type & Signal Discrepancies",
          missing_drawing_desc: "Present in DCS IO list but missing from P&ID drawing.",
          missing_io_desc: "Physical equipment or mechanical valves detected on blueprint that lack an electrical IO point.",
          manual_valve_desc: "Manual hand valve - no electrical IO connection.",
          matched_status: "Matched",
        }
      };

      const labels = translations[selectedLang];
      const localizedMissing = MOCK_REPORT.missing_in_drawing.map(item => ({
        ...item,
        description: selectedLang === 'en' ? item.description : labels.missing_drawing_desc
      }));

      return {
        ...MOCK_REPORT,
        missing_in_drawing: localizedMissing,
        lang: selectedLang,
        i18n_labels: labels
      };
    }

    const res = await fetch(`${API_BASE}/jobs/${jobId}/report?lang=${lang}`);
    if (!res.ok) throw new ApiError('Failed to fetch report', 'JOB_NOT_FOUND');
    return await res.json();
  },

  getExportUrl(jobId: string, format: 'json' | 'svg' | 'pdf' | 'diagram-pdf'): string {
    return `${API_BASE}/jobs/${jobId}/export?format=${format}`;
  },

  getDiagramPdfUrl(jobId: string): string {
    return `${API_BASE}/jobs/${jobId}/simplified-diagram/pdf`;
  },
};
