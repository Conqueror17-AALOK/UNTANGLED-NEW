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
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 animate-fade-in font-sans min-h-[calc(100vh-8rem)] flex-1 flex flex-col justify-between">
      
      {/* Clean Technical Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-[#434856]">
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
            <Loader2 size={13} className="animate-spin text-cyan-400" />
            <span className="font-medium uppercase text-[11px]">{currentStage}</span>
          </div>
        )}
      </div>

      {/* Screen-Filling 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        
        {/* Progress & Stat Telemetry (Col span 5) */}
        <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
          <div className="adobe-card p-6 space-y-5 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-medium">
              <span className="tracking-wider uppercase">Pipeline Overall Progress</span>
              <span className="text-white font-semibold text-base tabular-nums">
                {Math.round(progress * 100)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-[#24272f] border border-white/[0.1] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
              />
            </div>

            {/* 3 Telemetry Stats in Clean Divided Strip */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.1] pt-4 border-t border-white/[0.1] text-center text-xs">
              <div className="py-2">
                <span className="text-[11px] text-neutral-400 block font-normal">Resolved</span>
                <span className="text-white font-semibold text-2xl tabular-nums mt-1 block">{summary.resolved}</span>
              </div>
              <div className="py-2">
                <span className="text-[11px] text-neutral-400 block font-normal">Review Queue</span>
                <span className="text-amber-400 font-semibold text-2xl tabular-nums mt-1 block">{summary.needs_review}</span>
              </div>
              <div className="py-2">
                <span className="text-[11px] text-neutral-400 block font-normal">Stages Completed</span>
                <span className="text-emerald-400 font-semibold text-2xl tabular-nums mt-1 block">
                  {completedStages.size} / 9
                </span>
              </div>
            </div>
          </div>

          {/* Quick Context Card */}
          <div className="adobe-card p-5 space-y-2 text-xs">
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block">
              Automated Intelligence Architecture
            </span>
            <p className="text-slate-300 font-normal leading-relaxed">
              Every drawing sheet passes through OCR text alignment, heuristic symbol segmentation, graph connection tracing, and deterministic DCS tag verification.
            </p>
          </div>
        </div>

        {/* 9-Stage Execution Sequence (Col span 7) */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="adobe-card divide-y divide-white/[0.08] overflow-hidden flex-1 flex flex-col justify-between">
            {PIPELINE_STAGES.map((s, index) => {
              const isCompleted = completedStages.has(s.id) || isDone;
              const isCurrent = currentStage === s.id && !isDone;

              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between px-5 py-3.5 text-xs transition-colors ${
                    isCurrent
                      ? 'bg-cyan-500/10 text-white'
                      : isCompleted
                      ? 'text-neutral-200 hover:bg-white/[0.04]'
                      : 'text-neutral-500'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="w-6 text-center text-neutral-400 font-mono text-xs">
                      {isCompleted ? (
                        <CheckCircle2 size={16} className="text-emerald-400 inline" />
                      ) : isCurrent ? (
                        <Loader2 size={15} className="animate-spin text-cyan-400 inline" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className={`text-xs sm:text-sm ${isCurrent ? 'font-semibold text-white' : 'font-normal'}`}>
                      {s.label}
                    </span>
                  </div>

                  <div>
                    {isCompleted ? (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Complete
                      </span>
                    ) : isCurrent ? (
                      <span className="text-[11px] font-medium px-2.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 animate-pulse">
                        Executing
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-500">Pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
