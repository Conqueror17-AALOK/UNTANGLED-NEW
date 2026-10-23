import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, ArrowRight, Terminal, Cpu } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { JobStreamClient, PIPELINE_STAGES } from '../api/ws';
import { PipelineStage, WebSocketEvent } from '../types';

export const JobPage: React.FC = () => {
  const { jobId = 'demo-job-1' } = useParams();
  const navigate = useNavigate();

  const [currentStage, setCurrentStage] = useState<PipelineStage>('perception');
  const [completedStages, setCompletedStages] = useState<Set<PipelineStage>>(new Set());
  const [progress, setProgress] = useState(0.1);
  const [isDone, setIsDone] = useState(false);
  const [summary, setSummary] = useState<{ resolved: number; needs_review: number; rejected: number }>({
    resolved: 0,
    needs_review: 0,
    rejected: 0,
  });

  useEffect(() => {
    const client = new JobStreamClient(jobId, (event: WebSocketEvent) => {
      if (event.event === 'stage_started') {
        setCurrentStage(event.stage);
        setProgress(event.progress);
      } else if (event.event === 'stage_done') {
        setCompletedStages((prev) => new Set([...prev, event.stage]));
        setProgress(event.progress);
      } else if (event.event === 'job_done') {
        setIsDone(true);
        setProgress(1.0);
        setSummary(event.summary);
      }
    });

    return () => client.destroy();
  }, [jobId]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1e222d]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#64748b] mb-1">
            <span>PIPELINE MONITOR</span>
            <span>/</span>
            <span className="text-blue-400 font-semibold">JOB: {jobId}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f1f5f9] flex items-center gap-2.5">
            <Cpu size={22} className="text-blue-400" />
            <span>Deterministic 9-Stage Pipeline Execution</span>
          </h1>
        </div>

        {isDone ? (
          <Button
            variant="engineering"
            size="md"
            onClick={() => navigate(`/workspace/${jobId}`)}
            className="font-mono text-xs"
          >
            <span>Inspect Process Topology</span>
            <ArrowRight size={14} />
          </Button>
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
        <div className="grid grid-cols-3 gap-3 pt-1 text-center font-mono text-xs">
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
