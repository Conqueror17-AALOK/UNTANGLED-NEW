import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, ArrowRight, Terminal, Cpu, AlertTriangle, Download } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { JobStreamClient, PIPELINE_STAGES } from '../api/ws';
import { apiClient } from '../api/client';
import { Job, PipelineStage } from '../types';

export const JobPage: React.FC = () => {
  const { jobId = 'demo-job-1' } = useParams();
  const navigate = useNavigate();

  const [currentStage, setCurrentStage] = useState<PipelineStage>('perception');
  const [completedStages, setCompletedStages] = useState<Set<PipelineStage>>(new Set());
  const [progress, setProgress] = useState(0.1);
  const [isDone, setIsDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ resolved: number; needs_review: number; rejected: number }>({
    resolved: 0,
    needs_review: 0,
    rejected: 0,
  });

  useEffect(() => {
    let isMounted = true;

    const syncWithJob = (job: Job) => {
      if (!isMounted) return;
      if (job.error?.message) {
        setErrorMsg(job.error.message);
      }
      if (job.progress !== undefined) {
        setProgress(Math.max(0.1, job.progress));
      }
      if (job.stage) {
        setCurrentStage(job.stage);
        const stageIdx = PIPELINE_STAGES.findIndex((s) => s.id === job.stage);
        if (stageIdx >= 0) {
          const completed = new Set<PipelineStage>(
            PIPELINE_STAGES.slice(0, stageIdx).map((s) => s.id)
          );
          if (job.status === 'done') {
            completed.add(job.stage);
          }
          setCompletedStages(completed);
        }
      }
      if (job.summary) {
        setSummary(job.summary);
      }
      if (job.status === 'done') {
        setIsDone(true);
        setProgress(1.0);
        setCompletedStages(new Set(PIPELINE_STAGES.map((s) => s.id)));
      }
    };

    // Immediate initial fetch
    apiClient.getJob(jobId).then(syncWithJob).catch((e) => console.warn('Job fetch:', e));

    // Polling fallback to guarantee stage progression tracking
    const pollInterval = setInterval(() => {
      if (!isMounted) return;
      apiClient.getJob(jobId).then((job) => {
        syncWithJob(job);
        if (job.status === 'done' || job.status === 'failed') {
          clearInterval(pollInterval);
        }
      }).catch(() => {});
    }, 1500);

    // WebSocket listener
    const client = new JobStreamClient(jobId, (event: any) => {
      if (!isMounted) return;
      if (event.event === 'stage_started' || event.stage) {
        const stage = event.stage as PipelineStage;
        setCurrentStage(stage);
        if (event.progress !== undefined) setProgress(Math.max(0.1, event.progress));
        const stageIdx = PIPELINE_STAGES.findIndex((s) => s.id === stage);
        if (stageIdx >= 0) {
          setCompletedStages((prev) => {
            const next = new Set(prev);
            for (let i = 0; i < stageIdx; i++) next.add(PIPELINE_STAGES[i].id);
            return next;
          });
        }
      }
      if (event.event === 'stage_done') {
        setCompletedStages((prev) => new Set([...prev, event.stage as PipelineStage]));
        if (event.progress !== undefined) setProgress(event.progress);
      }
      if (event.event === 'job_done' || event.status === 'done') {
        setIsDone(true);
        setProgress(1.0);
        setCompletedStages(new Set(PIPELINE_STAGES.map((s) => s.id)));
        if (event.summary) setSummary(event.summary);
        clearInterval(pollInterval);
      }
      if (event.event === 'job_failed' || event.status === 'failed') {
        setErrorMsg(event.error?.message || 'Pipeline execution failed.');
        clearInterval(pollInterval);
      }
    });

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      client.destroy();
    };
  }, [jobId]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1e222d]">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="truncate max-w-[280px]">Job: {jobId}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f1f5f9] flex items-center gap-2.5">
            <Cpu size={22} className="text-blue-400 shrink-0" />
            <span>Deterministic 9-Stage Pipeline Execution</span>
          </h1>
        </div>

        {isDone ? (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <a
              href={`/api/v1/jobs/${jobId}/simplified-diagram/pdf`}
              download={`simplified_diagram_${jobId.slice(0, 8)}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="secondary" size="md" className="w-full sm:w-auto font-mono text-xs flex items-center justify-center gap-1.5">
                <Download size={13} className="text-emerald-400" />
                <span>Download Diagram (PDF)</span>
              </Button>
            </a>
            <Button
              variant="engineering"
              size="md"
              onClick={() => navigate(`/workspace/${jobId}`)}
              className="w-full sm:w-auto font-mono text-xs flex items-center justify-center gap-1.5"
            >
              <span>Inspect Process Topology</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-red-950/40 border border-red-800 text-xs font-mono text-red-400">
            <AlertTriangle size={13} className="text-red-400" />
            <span>Pipeline Failed: {errorMsg}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#12141c] border border-[#1e222d] text-xs font-mono text-blue-400">
            <Loader2 size={13} className="animate-spin text-blue-400" />
            <span>Active: {currentStage}</span>
          </div>
        )}
      </div>

      {/* Progress & Live Telemetry Card */}
      <Card className="bg-[#12141c] border-[#1e222d] p-5 space-y-4">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#94a3b8] flex items-center gap-2">
            <Terminal size={14} className="text-[#64748b]" />
            <span>PIPELINE PROGRESS</span>
          </span>
          <span className="text-blue-400 font-bold tabular-nums">{Math.round(progress * 100)}%</span>
        </div>

        <div className="w-full h-2 rounded bg-[#090a0f] overflow-hidden border border-[#1e222d]">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
          />
        </div>

        {/* Live Stage Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1 text-center font-mono text-xs">
          <div className="p-2.5 rounded bg-[#090a0f] border border-[#1e222d]">
            <span className="text-[10px] text-[#64748b] block">AUTO-RESOLVED</span>
            <span className="text-emerald-400 font-bold text-sm tabular-nums">{summary.resolved}</span>
          </div>
          <div className="p-2.5 rounded bg-[#090a0f] border border-[#1e222d]">
            <span className="text-[10px] text-[#64748b] block">NEEDS REVIEW</span>
            <span className="text-amber-400 font-bold text-sm tabular-nums">{summary.needs_review}</span>
          </div>
          <div className="p-2.5 rounded bg-[#090a0f] border border-[#1e222d]">
            <span className="text-[10px] text-[#64748b] block">STAGES EXECUTED</span>
            <span className="text-[#f1f5f9] font-bold text-sm tabular-nums">
              {completedStages.size} / 9
            </span>
          </div>
        </div>
      </Card>

      {/* 9 Stages List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b] uppercase tracking-wider px-1">
          <span>Stage Sequence</span>
          <span>Status</span>
        </div>

        <div className="space-y-1.5">
          {PIPELINE_STAGES.map((s, index) => {
            const isCompleted = completedStages.has(s.id) || isDone;
            const isCurrent = currentStage === s.id && !isDone;

            return (
              <div
                key={s.id}
                className={`flex items-center justify-between p-3 rounded border transition-colors ${
                  isCurrent
                    ? 'bg-[#151821] border-blue-500/40 text-[#f1f5f9]'
                    : isCompleted
                    ? 'bg-[#12141c] border-[#1e222d] text-[#f1f5f9]'
                    : 'bg-[#090a0f] border-[#1e222d]/60 text-[#64748b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded bg-[#1c202d] border border-[#2b3145] flex items-center justify-center font-mono text-[11px] shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 size={14} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 size={13} className="animate-spin text-blue-400" />
                    ) : (
                      <span className="text-[#64748b]">{index + 1}</span>
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${isCurrent ? 'text-blue-300' : isCompleted ? 'text-[#f1f5f9]' : 'text-[#64748b]'}`}>
                      {s.label}
                    </p>
                    <p className="text-[11px] text-[#64748b] font-mono hidden sm:block">{s.desc}</p>
                  </div>
                </div>

                <div>
                  {isCompleted ? (
                    <Badge variant="high" size="xs">DONE</Badge>
                  ) : isCurrent ? (
                    <Badge variant="blue" size="xs">RUNNING</Badge>
                  ) : (
                    <span className="text-[10px] font-mono text-[#64748b]">QUEUED</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
