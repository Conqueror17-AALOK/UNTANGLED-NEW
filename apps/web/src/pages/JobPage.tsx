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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6 animate-fade-in">
      
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.1]">
        <div>
          <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#eb1000]" />
            <span className="font-mono uppercase">JOB {jobId.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-heading font-black tracking-[-0.035em] text-white">
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
              <Button variant="secondary" size="md" className="font-bold">
                <Download size={14} className="text-[#10b981]" />
                <span>PDF Diagram</span>
              </Button>
            </a>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate(`/workspace/${jobId}`)}
              className="font-bold"
            >
              <span>View Canvas</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#eb1000]/15 border border-[#eb1000]/30 text-xs font-bold text-white">
            <AlertTriangle size={15} className="text-[#eb1000] shrink-0" />
            <span>Error: {errorMsg}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold shadow-sm">
            <Loader2 size={13} className="animate-spin text-black" />
            <span className="uppercase font-black">{currentStage}</span>
          </div>
        )}
      </div>

      {/* Editorial Progress Card */}
      <Card variant="card" className="p-6 space-y-5">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-400 tracking-wider uppercase">TOTAL PIPELINE PROGRESS</span>
          <span className="text-white font-black text-base tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        </div>

        {/* Minimal Progress Bar Capsule */}
        <div className="w-full h-3 rounded-full bg-white/10 p-0.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
          />
        </div>

        {/* 3 Compact Editorial Stat Tiles */}
        <div className="grid grid-cols-3 gap-3.5 pt-1 text-center font-mono">
          <div className="p-4 rounded-xl bg-[#1a1a1a] border border-white/[0.08]">
            <span className="text-[10px] text-slate-400 block font-bold tracking-wider">RESOLVED</span>
            <span className="text-white font-black text-2xl tabular-nums mt-1 block">{summary.resolved}</span>
          </div>
          <div className="p-4 rounded-xl bg-[#1a1a1a] border border-white/[0.08]">
            <span className="text-[10px] text-slate-400 block font-bold tracking-wider">REVIEW</span>
            <span className="text-[#eb1000] font-black text-2xl tabular-nums mt-1 block">{summary.needs_review}</span>
          </div>
          <div className="p-4 rounded-xl bg-[#1a1a1a] border border-white/[0.08]">
            <span className="text-[10px] text-slate-400 block font-bold tracking-wider">STAGES</span>
            <span className="text-white font-black text-2xl tabular-nums mt-1 block">
              {completedStages.size} / 9
            </span>
          </div>
        </div>
      </Card>

      {/* 9-Stage Sequence with Adobe Editorial List Rows */}
      <div className="space-y-2">
        {PIPELINE_STAGES.map((s, index) => {
          const isCompleted = completedStages.has(s.id) || isDone;
          const isCurrent = currentStage === s.id && !isDone;

          return (
            <div
              key={s.id}
              className={`flex items-center justify-between px-5 py-3.5 rounded-xl border text-xs transition-all duration-150 ${
                isCurrent
                  ? 'bg-[#1a1a1a] border-white/40 text-white font-black'
                  : isCompleted
                  ? 'bg-[#141414] hover:bg-[#181818] border-white/[0.08] text-slate-200 font-bold'
                  : 'bg-[#0d0d0d] border-white/[0.04] text-slate-500 font-bold'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="w-5 text-center font-mono text-slate-400">
                  {isCompleted ? (
                    <CheckCircle2 size={16} className="text-[#10b981] inline" />
                  ) : isCurrent ? (
                    <Loader2 size={15} className="animate-spin text-white inline" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={`text-sm ${isCurrent ? 'text-white font-black' : 'font-bold'}`}>
                  {s.label}
                </span>
              </div>

              <div>
                {isCompleted ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#10b981]/20 text-[#10b981]">
                    DONE
                  </span>
                ) : isCurrent ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white text-black animate-pulse">
                    RUNNING
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-slate-600">WAITING</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
