import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, ArrowRight, AlertTriangle, Download } from 'lucide-react';
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
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 animate-fade-in font-sans">
      
      {/* Clean Technical Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#434856]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Pipeline Execution
          </h1>
          <p className="text-xs text-neutral-400 font-normal mt-0.5">
            Sequential 9-stage perception, parsing, reconciliation, and topology synthesis.
          </p>
        </div>

        {isDone ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={`/api/v1/jobs/${jobId}/simplified-diagram/pdf`}
              download={`simplified_diagram_${jobId.slice(0, 8)}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="sm" className="font-medium">
                <Download size={13} className="text-emerald-400" />
                <span>PDF Diagram</span>
              </Button>
            </a>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/workspace/${jobId}`)}
              className="font-medium"
            >
              <span>View Canvas</span>
              <ArrowRight size={13} />
            </Button>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span>Error: {errorMsg}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#24272f] border border-[#434856] text-xs text-neutral-200">
            <Loader2 size={13} className="animate-spin text-blue-400" />
            <span className="font-medium uppercase text-[11px]">{currentStage}</span>
          </div>
        )}
      </div>

      {/* Progress Card with Integrated Stat Strip (No Boxception) */}
      <div className="adobe-card p-5 space-y-4">
        <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
          <span>PIPELINE PROGRESS</span>
          <span className="text-white font-semibold text-sm tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-full h-2 rounded-full bg-[#24272f] border border-[#434856] overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
          />
        </div>

        {/* 3 Stats in a Clean Divided Row (No Nested Boxes) */}
        <div className="grid grid-cols-3 divide-x divide-[#434856] pt-2 border-t border-[#434856] text-center text-xs">
          <div className="py-1">
            <span className="text-[11px] text-neutral-400 block font-normal">Resolved</span>
            <span className="text-white font-semibold text-xl tabular-nums mt-0.5 block">{summary.resolved}</span>
          </div>
          <div className="py-1">
            <span className="text-[11px] text-neutral-400 block font-normal">Review Queue</span>
            <span className="text-amber-400 font-semibold text-xl tabular-nums mt-0.5 block">{summary.needs_review}</span>
          </div>
          <div className="py-1">
            <span className="text-[11px] text-neutral-400 block font-normal">Completed</span>
            <span className="text-white font-semibold text-xl tabular-nums mt-0.5 block">
              {completedStages.size} / 9
            </span>
          </div>
        </div>
      </div>

      {/* 9-Stage Sequence in a Single Clean Divided List (No Separate Box for Each Stage) */}
      <div className="adobe-card divide-y divide-[#434856] overflow-hidden">
        {PIPELINE_STAGES.map((s, index) => {
          const isCompleted = completedStages.has(s.id) || isDone;
          const isCurrent = currentStage === s.id && !isDone;

          return (
            <div
              key={s.id}
              className={`flex items-center justify-between px-4 py-3 text-xs transition-colors ${
                isCurrent
                  ? 'bg-blue-500/10 text-white'
                  : isCompleted
                  ? 'text-neutral-200 hover:bg-white/[0.04]'
                  : 'text-neutral-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-center text-neutral-400 font-mono text-[11px]">
                  {isCompleted ? (
                    <CheckCircle2 size={15} className="text-emerald-400 inline" />
                  ) : isCurrent ? (
                    <Loader2 size={14} className="animate-spin text-blue-400 inline" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={`text-xs ${isCurrent ? 'font-semibold text-white' : 'font-normal'}`}>
                  {s.label}
                </span>
              </div>

              <div>
                {isCompleted ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                    Done
                  </span>
                ) : isCurrent ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 animate-pulse">
                    Running
                  </span>
                ) : (
                  <span className="text-[10px] text-neutral-400">Pending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
