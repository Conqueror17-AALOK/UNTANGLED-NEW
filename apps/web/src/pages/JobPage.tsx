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

    apiClient.getJob(jobId).then(syncWithJob).catch((e) => console.warn('Job fetch:', e));

    const pollInterval = setInterval(() => {
      if (!isMounted) return;
      apiClient.getJob(jobId).then((job) => {
        syncWithJob(job);
        if (job.status === 'done' || job.status === 'failed') {
          clearInterval(pollInterval);
        }
      }).catch(() => {});
    }, 1500);

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
      
      {/* Minimal Frosted Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="text-xs font-mono text-cyan-400 mb-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>JOB {jobId.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-white">
            Pipeline Execution
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
              className="font-mono text-xs flex items-center gap-1.5 shadow-md"
            >
              <span>View Canvas</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs font-mono text-red-200 backdrop-blur-md">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span>Error: {errorMsg}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/35 text-xs font-mono text-cyan-200 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Loader2 size={13} className="animate-spin text-cyan-400" />
            <span className="uppercase font-semibold">{currentStage}</span>
          </div>
        )}
      </div>

      {/* Frosted Progress Card */}
      <Card variant="glass" className="p-6 space-y-5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-semibold tracking-wide">TOTAL PIPELINE PROGRESS</span>
          <span className="text-cyan-300 font-extrabold tabular-nums text-sm drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
            {Math.round(progress * 100)}%
          </span>
        </div>

        {/* Minimal Frosted Capsule Progress Bar */}
        <div className="w-full h-3 rounded-full bg-white/[0.04] p-0.5 border border-white/[0.1] backdrop-blur-md shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.6)] transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
          />
        </div>

        {/* Compact Glowing Glass Stat Pills */}
        <div className="grid grid-cols-3 gap-3.5 pt-1 text-center font-mono text-xs">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.15),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md">
            <span className="text-[10px] text-emerald-300/80 block font-semibold tracking-wider">RESOLVED</span>
            <span className="text-emerald-300 font-extrabold text-xl tabular-nums mt-0.5 block">{summary.resolved}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 shadow-[0_0_20px_rgba(245,158,11,0.15),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md">
            <span className="text-[10px] text-amber-300/80 block font-semibold tracking-wider">REVIEW</span>
            <span className="text-amber-300 font-extrabold text-xl tabular-nums mt-0.5 block">{summary.needs_review}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-400/30 shadow-[0_0_20px_rgba(59,130,246,0.15),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md">
            <span className="text-[10px] text-blue-300/80 block font-semibold tracking-wider">STAGES</span>
            <span className="text-white font-extrabold text-xl tabular-nums mt-0.5 block">
              {completedStages.size} / 9
            </span>
          </div>
        </div>
      </Card>

      {/* Clean 9-Stage Sequence with Frosted Glass Panels */}
      <div className="space-y-2">
        {PIPELINE_STAGES.map((s, index) => {
          const isCompleted = completedStages.has(s.id) || isDone;
          const isCurrent = currentStage === s.id && !isDone;

          return (
            <div
              key={s.id}
              className={`flex items-center justify-between px-4 py-3 rounded-2xl border text-xs transition-all duration-200 ${
                isCurrent
                  ? 'bg-gradient-to-r from-cyan-500/20 via-blue-600/15 to-indigo-600/20 border-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] text-white backdrop-blur-xl scale-[1.01]'
                  : isCompleted
                  ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.09] text-slate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-md'
                  : 'bg-white/[0.01] border-white/[0.04] text-slate-500'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <span className="w-5 text-center font-mono text-slate-400">
                  {isCompleted ? (
                    <CheckCircle2 size={16} className="text-emerald-400 inline drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  ) : isCurrent ? (
                    <Loader2 size={15} className="animate-spin text-cyan-400 inline" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={`font-medium ${isCurrent ? 'text-white font-semibold' : ''}`}>
                  {s.label}
                </span>
              </div>

              <div>
                {isCompleted ? (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                    DONE
                  </span>
                ) : isCurrent ? (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 animate-pulse">
                    RUNNING
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500">WAITING</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
