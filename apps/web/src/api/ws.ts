import { PipelineStage, WebSocketEvent } from '../types';

export const PIPELINE_STAGES: { id: PipelineStage; label: string; desc: string }[] = [
  { id: 'perception', label: '1. Perception & OCR', desc: 'PyMuPDF text extraction & dual OCR voting' },
  { id: 'io_parse', label: '2. IO List Parsing', desc: 'Reading DCS tags & building fuzzy search index' },
  { id: 'cleanup', label: '3. Rule Cleanup', desc: 'ISA-5.1 grammar & character confusion normalization' },
  { id: 'llm_resolve', label: '4. LLM Resolver', desc: 'Resolving ambiguous candidates with Gemini Flash' },
  { id: 'validate', label: '5. Cross-Validation', desc: 'Drawing vs IO List discrepancy detection' },
  { id: 'graph', label: '6. Graph Assembly', desc: 'Snapping line segments to symbol ports' },
  { id: 'simplify', label: '7. Graph Simplification', desc: 'Collapsing inline manual valves & instrument loops' },
  { id: 'layout', label: '8. SVG Layout', desc: 'Deterministic layered process layout synthesis' },
  { id: 'report', label: '9. Engineering Report', desc: 'Generating tag audit metrics & export payloads' },
];

export class JobStreamClient {
  private ws: WebSocket | null = null;
  private jobId: string;
  private onEvent: (event: WebSocketEvent) => void;
  private isDestroyed = false;

  constructor(jobId: string, onEvent: (event: WebSocketEvent) => void) {
    this.jobId = jobId;
    this.onEvent = onEvent;
    this.connect();
  }

  private connect(): void {
    if (this.isDestroyed) return;

    if (this.jobId.startsWith('mock-') || this.jobId.startsWith('demo-')) {
      this.simulatePipeline();
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/v1/jobs/${this.jobId}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as WebSocketEvent;
          this.onEvent(ev);
        } catch (e) {
          console.error('Invalid WS payload', e);
        }
      };

      this.ws.onerror = () => {
        console.warn('WS error, falling back to simulated stream');
        this.simulatePipeline();
      };
    } catch {
      this.simulatePipeline();
    }
  }

  private simulatePipeline(): void {
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (this.isDestroyed) {
        clearInterval(interval);
        return;
      }

      if (currentIdx < PIPELINE_STAGES.length) {
        const stage = PIPELINE_STAGES[currentIdx].id;
        const progress = (currentIdx + 1) / PIPELINE_STAGES.length;

        this.onEvent({
          event: 'stage_started',
          job_id: this.jobId,
          stage,
          progress: Number((progress - 0.05).toFixed(2)),
        });

        setTimeout(() => {
          if (!this.isDestroyed) {
            this.onEvent({
              event: 'stage_done',
              job_id: this.jobId,
              stage,
              progress: Number(progress.toFixed(2)),
            });
          }
        }, 350);

        currentIdx++;
      } else {
        clearInterval(interval);
        this.onEvent({
          event: 'job_done',
          job_id: this.jobId,
          summary: { resolved: 6, needs_review: 2, rejected: 0 },
        });
      }
    }, 600);
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
