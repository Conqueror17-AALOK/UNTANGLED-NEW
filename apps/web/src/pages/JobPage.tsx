import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
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
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8 animate-fade-in">
      
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">JOB ID:</span>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              {jobId}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">Live Pipeline Tracker</h1>
        </div>

        {isDone ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate(`/workspace/${jobId}`)}
            className="animate-pulse-glow"
          >
            <span>Open Process Sketch</span>
            <ArrowRight size={16} />
          </Button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-industrial-900 border border-industrial-800 text-xs font-mono text-cyan-400">
            <Loader2 size={14} className="animate-spin text-cyan-400" />
            <span>Processing drawing stages...</span>
          </div>
        )}
      </div>

      {/* Progress Bar Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">OVERALL PROGRESS</span>
          <span className="text-cyan-400 font-bold">{Math.round(progress * 100)}%</span>
        </div>

        <div className="w-full h-3 rounded-full bg-industrial-950 overflow-hidden border border-industrial-800 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
          />
        </div>

        {/* Live Stage Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-industrial-950/60 border border-industrial-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">Auto-Resolved</span>
            <Badge variant="high">{summary.resolved} tags</Badge>
          </div>
          <div className="p-3 rounded-lg bg-industrial-950/60 border border-industrial-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">Needs Review</span>
            <Badge variant="medium">{summary.needs_review} tags</Badge>
          </div>
          <div className="p-3 rounded-lg bg-industrial-950/60 border border-industrial-800/60 flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Stages</span>
            <Badge variant="neutral">9 / 9</Badge>
          </div>
        </div>
      </Card>

      {/* 9 Stages List */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">Pipeline Stages Execution</h3>

        <div className="space-y-2">
          {PIPELINE_STAGES.map((s, index) => {
            const isCompleted = completedStages.has(s.id) || isDone;
            const isCurrent = currentStage === s.id && !isDone;

            return (
              <div
                key={s.id}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/5'
                    : isCompleted
                    ? 'bg-industrial-900/60 border-industrial-800 text-slate-300'
                    : 'bg-industrial-950/40 border-industrial-900 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold">
                    {isCompleted ? (
                      <CheckCircle2 size={18} className="text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 size={18} className="animate-spin text-cyan-400" />
                    ) : (
                      <span className="text-slate-600">{index + 1}</span>
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isCurrent ? 'text-cyan-300' : isCompleted ? 'text-slate-200' : 'text-slate-500'}`}>
                      {s.label}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono hidden sm:block">{s.desc}</p>
                  </div>
                </div>

                <div>
                  {isCompleted ? (
                    <Badge variant="high" size="sm">Completed</Badge>
                  ) : isCurrent ? (
                    <Badge variant="cyan" size="sm">Active</Badge>
                  ) : (
                    <span className="text-xs font-mono text-slate-600">Pending</span>
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
