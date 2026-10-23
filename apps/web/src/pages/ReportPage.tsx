import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Download,
  AlertTriangle,
  HelpCircle,
  Printer
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { apiClient } from '../api/client';
import { ReportData } from '../types';

export const ReportPage: React.FC = () => {
  const { jobId = 'demo-job-1' } = useParams();
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    apiClient.getReport(jobId).then(setReport);
  }, [jobId]);

  if (!report) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm">
        Loading validation report...
      </div>
    );
  }

  const { summary } = report;

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `untangle_report_${jobId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              AUDIT VERIFICATION
            </span>
            <span className="text-xs font-mono text-slate-400">JOB: {jobId}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
            P&ID Drawing vs IO List Cross-Validation Report
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic discrepancy analysis between physical P&ID blueprints and DCS electrical point registers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrint}>
            <Printer size={14} />
            <span>Print / PDF</span>
          </Button>

          <Button variant="primary" size="sm" onClick={handleExportJSON}>
            <Download size={14} />
            <span>Export JSON</span>
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1 bg-industrial-900">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Total Tags Extracted</span>
          <p className="text-3xl font-extrabold text-slate-100">{summary.tags_total}</p>
          <span className="text-[10px] text-slate-500 font-mono">100% evaluated</span>
        </Card>

        <Card className="p-4 space-y-1 bg-industrial-900 border-emerald-500/30">
          <span className="text-[11px] font-mono text-emerald-400 uppercase">Resolved & Verified</span>
          <p className="text-3xl font-extrabold text-emerald-400">{summary.resolved}</p>
          <span className="text-[10px] text-emerald-500 font-mono">{(summary.resolved / summary.tags_total * 100).toFixed(0)}% accuracy</span>
        </Card>

        <Card className="p-4 space-y-1 bg-industrial-900 border-amber-500/30">
          <span className="text-[11px] font-mono text-amber-400 uppercase">Review Required</span>
          <p className="text-3xl font-extrabold text-amber-400">{summary.needs_review}</p>
          <span className="text-[10px] text-amber-500 font-mono">Optical or IO mismatches</span>
        </Card>

        <Card className="p-4 space-y-1 bg-industrial-900">
          <span className="text-[11px] font-mono text-cyan-400 uppercase">Decision Split</span>
          <p className="text-lg font-bold text-slate-200 mt-1">
            {summary.auto_pct}% <span className="text-xs text-slate-400 font-normal">auto</span>
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {summary.llm_pct}% LLM | {summary.human_pct}% Human
          </p>
        </Card>
      </div>

      {/* Three-Tier Resolution Progress Bar */}
      <Card className="p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Three-Tier Decision Logic Distribution
        </h3>
        
        <div className="w-full h-4 rounded-full bg-industrial-950 flex overflow-hidden border border-industrial-800">
          <div style={{ width: `${summary.auto_pct}%` }} className="bg-emerald-500" title={`Auto: ${summary.auto_pct}%`} />
          <div style={{ width: `${summary.llm_pct}%` }} className="bg-cyan-500" title={`LLM: ${summary.llm_pct}%`} />
          <div style={{ width: `${summary.human_pct}%` }} className="bg-amber-500" title={`Human: ${summary.human_pct}%`} />
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-slate-400 pt-1">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Auto-Accepted (&gt;= 0.85): {summary.auto_pct}%
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> LLM Resolved (0.60-0.85): {summary.llm_pct}%
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Human Review Queue (&lt; 0.60): {summary.human_pct}%
          </span>
        </div>
      </Card>

      {/* Discrepancy Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Discrepancy 1: Missing in Drawing */}
        <Card className="p-5 space-y-4 border-red-500/30">
          <div className="flex items-center justify-between pb-2 border-b border-industrial-800">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              <span>Defined in IO List, Missing in Drawing</span>
            </h3>
            <Badge variant="low" size="sm">{report.missing_in_drawing.length}</Badge>
          </div>
          <p className="text-[11px] text-slate-400">
            Signals present in the plant DCS IO database that were not detected anywhere on the P&ID blueprint.
          </p>

          <div className="space-y-2">
            {report.missing_in_drawing.map((item) => (
              <div key={item.io_tag} className="p-3 rounded-lg bg-industrial-950 border border-industrial-800 flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-red-400">{item.io_tag}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                </div>
                <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                  MISSING
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Discrepancy 2: Missing in IO List */}
        <Card className="p-5 space-y-4 border-amber-500/30">
          <div className="flex items-center justify-between pb-2 border-b border-industrial-800">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <HelpCircle size={16} className="text-amber-400" />
              <span>Found in Drawing, Missing in IO List</span>
            </h3>
            <Badge variant="medium" size="sm">{report.missing_in_io_list.length}</Badge>
          </div>
          <p className="text-[11px] text-slate-400">
            Physical equipment or mechanical valves detected on the blueprint that lack an electrical IO point.
          </p>

          <div className="space-y-2">
            {report.missing_in_io_list.map((item) => (
              <div key={item.tag} className="p-3 rounded-lg bg-industrial-950 border border-industrial-800 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-amber-400">{item.tag}</span>
                  <span className="text-[11px] text-slate-400 block">Manual Hand Valve / Mechanical</span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  NO IO POINT
                </span>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* Type Mismatches */}
      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <FileText size={16} className="text-cyan-400" />
          <span>Instrument Type & Signal Discrepancies</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-industrial-950 text-slate-400 font-mono text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-3">Tag</th>
                <th className="py-2.5 px-3">Drawing Representation</th>
                <th className="py-2.5 px-3">DCS Registered Signal</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800">
              {report.type_mismatches.map((m) => (
                <tr key={m.tag} className="hover:bg-industrial-950/50">
                  <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">{m.tag}</td>
                  <td className="py-2.5 px-3 text-slate-300">{m.drawing_type}</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-mono">{m.io_signal}</td>
                  <td className="py-2.5 px-3">
                    <Badge variant="high" size="sm">Matched</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
};
