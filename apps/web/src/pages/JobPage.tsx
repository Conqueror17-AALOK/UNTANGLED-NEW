import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, ArrowRight, AlertTriangle, Download } from 'lucide-react';
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6 animate-fade-in">
      
      {/* Minimal Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <div className="text-xs font-mono text-cyan-400 mb-1">
            Job {jobId.slice(0, 8)}
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white flex items-center gap-2.5">
            <span>Pipeline Execution</span>
          </h1>
        </div>

        {isDone ? (
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <a
              href={`/api/v1/jobs/${jobId}/simplified-diagram/pdf`}
              download={`simplified_diagram_${jobId.slice(0, 8)}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="sm" className="font-mono text-xs flex items-center gap-1.5">
                <Download size={13} className="text-emerald-400" />
                <span>PDF Diagram</span>
              </Button>
            </a>
            <Button
              variant="engineering"
              size="sm"
              onClick={() => navigate(`/workspace/${jobId}`)}
              className="font-mono text-xs flex items-center gap-1.5"
            >
              <span>View Canvas</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-500/40 text-xs font-mono text-red-300">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span>Error: {errorMsg}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-industrial-900 border border-industrial-800 text-xs font-mono text-cyan-400">
            <Loader2 size={13} className="animate-spin" />
            <span className="uppercase">{currentStage}</span>
          </div>
        )}
      </div>

      {/* Progress Card */}
      <Card variant="glass" className="p-5 space-y-4">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-medium">PROGRESS</span>
          <span className="text-cyan-400 font-bold tabular-nums">{Math.round(progress * 100)}%</span>
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-full h-2 rounded-full bg-industrial-950 overflow-hidden border border-industrial-800">
          <div
            className="h-full rounded-full bg-cyan-400 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
          />
        </div>

        {/* Compact Stats */}
        <div className="grid grid-cols-3 gap-3 pt-1 text-center font-mono text-xs">
          <div className="p-3 rounded-lg bg-industrial-950/60 border border-industrial-800/80">
            <span className="text-[10px] text-slate-400 block">RESOLVED</span>
            <span className="text-emerald-400 font-bold text-lg tabular-nums mt-0.5 block">{summary.resolved}</span>
          </div>
          <div className="p-3 rounded-lg bg-industrial-950/60 border border-industrial-800/80">
            <span className="text-[10px] text-slate-400 block">REVIEW</span>
            <span className="text-amber-400 font-bold text-lg tabular-nums mt-0.5 block">{summary.needs_review}</span>
          </div>
          <div className="p-3 rounded-lg bg-industrial-950/60 border border-industrial-800/80">
            <span className="text-[10px] text-slate-400 block">STAGES</span>
            <span className="text-white font-bold text-lg tabular-nums mt-0.5 block">
              {completedStages.size} / 9
            </span>
          </div>
        </div>
      </Card>

      {/* Clean 9-Stage Sequence */}
      <div className="space-y-1.5">
        {PIPELINE_STAGES.map((s, index) => {
          const isCompleted = completedStages.has(s.id) || isDone;
          const isCurrent = currentStage === s.id && !isDone;

          return (
            <div
              key={s.id}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-xs transition-colors ${
                isCurrent
                  ? 'bg-industrial-900 border-cyan-500/50 text-white'
                  : isCompleted
                  ? 'bg-industrial-950/60 border-industrial-800/80 text-slate-300'
                  : 'bg-industrial-950/30 border-industrial-900 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center font-mono text-slate-500">
                  {isCompleted ? (
                    <CheckCircle2 size={15} className="text-emerald-400 inline" />
                  ) : isCurrent ? (
                    <Loader2 size={14} className="animate-spin text-cyan-400 inline" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={`font-medium ${isCurrent ? 'text-cyan-300 font-semibold' : ''}`}>
                  {s.label}
                </span>
              </div>

              <div>
                {isCompleted ? (
                  <span className="text-[10px] font-mono font-semibold text-emerald-400">DONE</span>
                ) : isCurrent ? (
                  <span className="text-[10px] font-mono font-semibold text-cyan-300 animate-pulse">RUNNING</span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-600">WAITING</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

