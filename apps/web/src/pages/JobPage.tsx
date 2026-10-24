import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, ArrowRight, Terminal, Cpu, AlertTriangle, Download, Sparkles } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
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
    <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-2/3 h-56 bg-blue-500/10 rounded-full blur-3xl -z-10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800/80">
        <div className="flex items-start gap-3.5">
          <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-industrial-900 via-industrial-900 to-blue-950/40 border border-blue-500/30 items-center justify-center shadow-lg shadow-blue-950/30">
            <img src="/logo-mark.png" alt="UNTANGLED" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-700/50 mb-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-glow-cyan" />
              <span className="truncate max-w-[280px]">Job UUID: {jobId}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 flex items-center gap-2.5">
              <Cpu size={24} className="text-cyan-400 shrink-0" />
              <span>Deterministic 9-Stage Pipeline</span>
            </h1>
          </div>
        </div>

        {isDone ? (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
            <a
              href={`/api/v1/jobs/${jobId}/simplified-diagram/pdf`}
              download={`simplified_diagram_${jobId.slice(0, 8)}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="secondary" size="md" className="w-full sm:w-auto font-mono text-xs flex items-center justify-center gap-1.5 border-emerald-700/60 text-emerald-300 hover:bg-emerald-950/40">
                <Download size={13} className="text-emerald-400" />
                <span>Download Diagram (PDF)</span>
              </Button>
            </a>
            <Button
              variant="engineering"
              size="md"
              onClick={() => navigate(`/workspace/${jobId}`)}
              className="w-full sm:w-auto font-mono text-xs flex items-center justify-center gap-2 shadow-glow-cyan"
            >
              <span>Inspect Topology</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-red-950/60 border border-red-500/40 text-xs font-mono text-red-300 shadow-md">
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
            <span className="truncate max-w-[320px]">Failed: {errorMsg}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-industrial-900/90 border border-cyan-500/30 text-xs font-mono text-cyan-300 shadow-md">
            <Loader2 size={14} className="animate-spin text-cyan-400" />
            <span>Active Stage: <strong className="text-white uppercase">{currentStage}</strong></span>
          </div>
        )}
      </div>

      {/* Progress & Live Telemetry Card */}
      <Card variant="glass" className="relative p-6 space-y-5 overflow-hidden">
        {/* Subtle Watermark */}
        <div className="pointer-events-none absolute right-3 bottom-2 opacity-[0.035] select-none z-0">
          <img src="/logo-mark.png" alt="" className="w-48 h-48 object-contain" />
        </div>

        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 flex items-center gap-2">
            <Terminal size={14} className="text-cyan-400" />
            <span className="font-semibold tracking-wider">PIPELINE EXECUTION PROGRESS</span>
          </span>
          <div className="flex items-center gap-2">
            {isDone && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                <Sparkles size={12} />
                <span>COMPLETE</span>
              </span>
            )}
            <span className="text-cyan-400 font-bold text-base tabular-nums">{Math.round(progress * 100)}%</span>
          </div>
        </div>

        {/* High-tech Multi-gradient Progress Bar */}
        <div className="relative w-full h-3 rounded-full bg-industrial-950 overflow-hidden border border-industrial-800 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-500 relative"
            style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>

        {/* Live Stage Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 text-center font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-industrial-950/70 border-t-2 border-t-emerald-500 border border-industrial-800/80 shadow-md">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">AUTO-RESOLVED TAGS</span>
            <span className="text-emerald-400 font-bold text-xl tabular-nums mt-0.5 block">{summary.resolved}</span>
            <span className="text-[10px] text-slate-500 font-mono mt-1 block">Cross-verified</span>
          </div>
          <div className="p-3.5 rounded-xl bg-industrial-950/70 border-t-2 border-t-amber-500 border border-industrial-800/80 shadow-md">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">NEEDS REVIEW</span>
            <span className="text-amber-400 font-bold text-xl tabular-nums mt-0.5 block">{summary.needs_review}</span>
            <span className="text-[10px] text-slate-500 font-mono mt-1 block">HITL queue</span>
          </div>
          <div className="p-3.5 rounded-xl bg-industrial-950/70 border-t-2 border-t-cyan-500 border border-industrial-800/80 shadow-md">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">STAGES EXECUTED</span>
            <span className="text-slate-100 font-bold text-xl tabular-nums mt-0.5 block">
              {completedStages.size} <span className="text-xs text-slate-500">/ 9</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono mt-1 block">100% deterministic</span>
          </div>
        </div>
      </Card>

      {/* 9 Stages List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider px-1">
          <span className="font-semibold">Pipeline Architecture Sequence</span>
          <span>Status Verification</span>
        </div>

        <div className="space-y-2">
          {PIPELINE_STAGES.map((s, index) => {
            const isCompleted = completedStages.has(s.id) || isDone;
            const isCurrent = currentStage === s.id && !isDone;

            return (
              <div
                key={s.id}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${
                  isCurrent
                    ? 'bg-gradient-to-r from-blue-950/40 via-cyan-950/20 to-industrial-900 border-cyan-500/50 text-white shadow-glow-cyan'
                    : isCompleted
                    ? 'bg-industrial-900/70 border-industrial-800 text-slate-200 hover:border-industrial-700'
                    : 'bg-industrial-950/60 border-industrial-900 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-mono text-xs shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-glow-emerald'
                      : isCurrent
                      ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-glow-cyan'
                      : 'bg-industrial-900 border-industrial-800 text-slate-600'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 size={14} className="animate-spin text-cyan-400" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${isCurrent ? 'text-cyan-300 font-bold' : isCompleted ? 'text-slate-100' : 'text-slate-500'}`}>
                      {s.label}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono hidden sm:block mt-0.5">{s.desc}</p>
                  </div>
                </div>

                <div>
                  {isCompleted ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/50 border border-emerald-500/40 text-emerald-400 shadow-sm">
                      DONE
                    </span>
                  ) : isCurrent ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/60 border border-cyan-400 text-cyan-300 animate-pulse shadow-glow-cyan">
                      RUNNING
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-600 px-2 py-0.5">QUEUED</span>
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

