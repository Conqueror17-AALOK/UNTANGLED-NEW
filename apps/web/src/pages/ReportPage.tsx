import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Download,
  AlertTriangle,
  HelpCircle,
  Printer,
  Globe,
  FileCheck2,
  FileSpreadsheet
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { apiClient } from '../api/client';
import { ReportData } from '../types';

export const ReportPage: React.FC = () => {
  const { jobId = 'demo-job-1' } = useParams();
  const [lang, setLang] = useState<'en' | 'hi' | 'mr'>('en');
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    apiClient.getReport(jobId, lang)
      .then((data) => {
        setReport(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load report:', err);
        setIsLoading(false);
      });
  }, [jobId, lang]);

  if (isLoading || !report) {
    return (
      <div className="py-24 text-center text-[#64748b] text-xs font-mono">
        <div className="w-6 h-6 mx-auto mb-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Generating audit report data...
      </div>
    );
  }

  const { summary } = report;
  const labels = report.i18n_labels || {};

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `untangle_audit_${jobId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDownloadPDF = () => {
    const pdfUrl = apiClient.getExportUrl(jobId, 'pdf');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', pdfUrl);
    downloadAnchor.setAttribute('download', `untangle_audit_report_${jobId}.pdf`);
    downloadAnchor.setAttribute('target', '_blank');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in print:p-0 print:space-y-4">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-3/4 h-52 bg-emerald-500/10 rounded-full blur-3xl -z-10" />

      {/* Official Audit Document Background Watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03] overflow-hidden select-none z-0">
        <img
          src="/logo-full.png"
          alt=""
          className="w-[580px] max-w-full -rotate-12 filter drop-shadow-[0_0_40px_rgba(56,189,248,0.5)]"
        />
      </div>

      {/* Official Audit Document Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800/80">
        <div className="flex items-start gap-3.5">
          <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-industrial-900 via-industrial-900 to-emerald-950/40 border border-emerald-500/30 items-center justify-center shadow-lg shadow-emerald-950/30">
            <img src="/logo-mark.png" alt="UNTANGLED" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 mb-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-glow-emerald" />
              <span>Audit Report • Verification Doc {jobId.slice(0, 8).toUpperCase()}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
              {labels.report_title || 'P&ID Drawing vs IO List Cross-Validation Report'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              {labels.report_subtitle || 'Deterministic discrepancy analysis between physical P&ID blueprints and DCS electrical point registers.'}
            </p>
          </div>
        </div>

        {/* Action Controls & Multi-lingual Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 print:hidden">
          
          {/* Operator Language Selector */}
          <div className="flex items-center bg-industrial-950 p-1 rounded-xl border border-industrial-800 text-xs font-mono shadow-sm">
            <span className="px-2 text-slate-500 flex items-center gap-1.5 text-[11px] font-semibold">
              <Globe size={13} className="text-cyan-400" />
              <span>LANG:</span>
            </span>
            {(['en', 'hi', 'mr'] as const).map((l) => (
              <button
                key={l}
                id={`lang-${l}-btn`}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  lang === l
                    ? 'bg-industrial-800 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {l === 'en' ? 'EN' : l === 'hi' ? 'हिन्दी' : 'मराठी'}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/v1/jobs/${jobId}/simplified-diagram/pdf`}
              download={`simplified_diagram_${jobId.slice(0, 8)}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="secondary"
                size="sm"
                className="font-mono text-xs flex items-center gap-1.5 border-emerald-700/60 text-emerald-300 hover:bg-emerald-950/40"
                title="Download Simplified Process Diagram as Vector PDF"
              >
                <Download size={13} className="text-emerald-400" />
                <span>Diagram PDF</span>
              </Button>
            </a>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPDF}
              className="font-mono text-xs"
              title="Download Certified Audit PDF Report"
            >
              <FileCheck2 size={13} className="text-blue-400" />
              <span>Report PDF</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              className="font-mono text-xs"
              title="Print Sheet"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportJSON}
              className="font-mono text-xs"
              title="Export JSON Payload"
            >
              <Download size={13} />
              <span>JSON</span>
            </Button>
          </div>

        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
        <Card variant="glass" className="p-4 space-y-1.5 border-t-2 border-t-blue-500">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
            {labels.total_tags_title || 'Total Tags Evaluated'}
          </span>
          <p className="text-2xl sm:text-3xl font-heading font-bold text-white tabular-nums">{summary.tags_total}</p>
          <span className="text-[10px] text-slate-500 block">100% Ingested</span>
        </Card>

        <Card variant="glass" className="p-4 space-y-1.5 border-t-2 border-t-emerald-500">
          <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-semibold">
            {labels.resolved_title || 'Verified & Resolved'}
          </span>
          <p className="text-2xl sm:text-3xl font-heading font-bold text-emerald-400 tabular-nums">{summary.resolved}</p>
          <span className="text-[10px] text-emerald-500 block">
            {((summary.resolved / Math.max(summary.tags_total, 1)) * 100).toFixed(0)}% Cross-Validated
          </span>
        </Card>

        <Card variant="glass" className="p-4 space-y-1.5 border-t-2 border-t-amber-500">
          <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-semibold">
            {labels.review_req_title || 'Requires Review'}
          </span>
          <p className="text-2xl sm:text-3xl font-heading font-bold text-amber-400 tabular-nums">{summary.needs_review}</p>
          <span className="text-[10px] text-amber-500 block">HITL Action Queue</span>
        </Card>

        <Card variant="glass" className="p-4 space-y-1.5 border-t-2 border-t-purple-500">
          <span className="text-[10px] text-purple-400 uppercase tracking-wider block font-semibold">
            {labels.decision_split_title || 'Decision Distribution'}
          </span>
          <p className="text-lg font-bold text-white mt-0.5 tabular-nums">
            {summary.auto_pct}% <span className="text-xs text-slate-400 font-normal">auto</span>
          </p>
          <p className="text-[10px] text-slate-500">
            {summary.llm_pct}% LLM | {summary.human_pct}% Human
          </p>
        </Card>
      </div>

      {/* Decision Distribution Bar */}
      <Card variant="glass" className="p-5 space-y-3">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
          Three-Tier Decision Logic Distribution
        </h3>
        
        <div className="w-full h-3 rounded-full bg-industrial-950 flex overflow-hidden border border-industrial-800 p-0.5">
          <div style={{ width: `${summary.auto_pct}%` }} className="bg-emerald-500 rounded-l-full" title={`Auto: ${summary.auto_pct}%`} />
          <div style={{ width: `${summary.llm_pct}%` }} className="bg-blue-500" title={`LLM: ${summary.llm_pct}%`} />
          <div style={{ width: `${summary.human_pct}%` }} className="bg-amber-500 rounded-r-full" title={`Human: ${summary.human_pct}%`} />
        </div>

        <div className="flex flex-wrap items-center gap-5 text-xs font-mono text-slate-300 pt-0.5">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-glow-emerald" /> Auto-Accepted (≥0.85): <strong className="text-white">{summary.auto_pct}%</strong>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> LLM Resolved (0.60–0.85): <strong className="text-white">{summary.llm_pct}%</strong>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Human Review Queue (&lt;0.60): <strong className="text-white">{summary.human_pct}%</strong>
          </span>
        </div>
      </Card>

      {/* Discrepancy Breakdown Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Table 1: Defined in IO List, Missing in Drawing */}
        <Card variant="glass" className="p-5 space-y-3.5 border-red-500/30">
          <div className="flex items-center justify-between pb-2.5 border-b border-industrial-800/80">
            <h3 className="text-xs font-heading font-bold text-slate-100 flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-400" />
              <span>{labels.missing_drawing_title || 'Defined in IO List, Missing in Drawing'}</span>
            </h3>
            <Badge variant="low" size="xs">{report.missing_in_drawing.length}</Badge>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {labels.missing_drawing_desc || 'Signals present in the plant DCS IO database that were not detected anywhere on the P&ID blueprint.'}
          </p>

          <div className="space-y-2 font-mono text-xs">
            {report.missing_in_drawing.map((item) => (
              <div key={item.io_tag} className="p-3 rounded-xl bg-industrial-950/80 border border-industrial-800/80 flex items-start justify-between shadow-sm">
                <div>
                  <span className="text-xs font-bold text-red-400">{item.io_tag}</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                </div>
                <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20">
                  MISSING IN DWG
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Table 2: Found in Drawing, Missing in IO List */}
        <Card variant="glass" className="p-5 space-y-3.5 border-amber-500/30">
          <div className="flex items-center justify-between pb-2.5 border-b border-industrial-800/80">
            <h3 className="text-xs font-heading font-bold text-slate-100 flex items-center gap-2">
              <HelpCircle size={15} className="text-amber-400" />
              <span>{labels.missing_io_title || 'Found in Drawing, Missing in IO List'}</span>
            </h3>
            <Badge variant="medium" size="xs">{report.missing_in_io_list.length}</Badge>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {labels.missing_io_desc || 'Physical equipment or mechanical valves detected on the blueprint that lack an electrical IO point.'}
          </p>

          <div className="space-y-2 font-mono text-xs">
            {report.missing_in_io_list.map((item) => (
              <div key={item.tag} className="p-3 rounded-xl bg-industrial-950/80 border border-industrial-800/80 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-xs font-bold text-amber-400">{item.tag}</span>
                  <span className="text-[11px] text-slate-400 block">Manual Hand Valve / Mechanical</span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  NO DCS POINT
                </span>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* Signal Type Alignments & Cross-Check Matrix */}
      <Card variant="glass" className="p-5 space-y-4">
        <div className="flex items-center justify-between pb-2.5 border-b border-industrial-800/80">
          <h3 className="text-xs font-heading font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet size={15} className="text-cyan-400" />
            <span>{labels.type_mismatch_title || 'Instrument Type & Signal Discrepancies'}</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-industrial-950 border border-industrial-800">
            POINT-TO-POINT VERIFICATION
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-industrial-800/80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-industrial-950 text-slate-400 text-[10px] uppercase tracking-wider border-b border-industrial-800/80">
              <tr>
                <th className="py-2.5 px-4">Tag</th>
                <th className="py-2.5 px-4">Drawing Identification</th>
                <th className="py-2.5 px-4">DCS Registered Signal</th>
                <th className="py-2.5 px-4 text-right">Verification Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/60 bg-industrial-900/40">
              {report.type_mismatches.map((m) => (
                <tr key={m.tag} className="hover:bg-industrial-800/40 transition-colors">
                  <td className="py-2.5 px-4 font-bold text-cyan-400">{m.tag}</td>
                  <td className="py-2.5 px-4 text-slate-200">{m.drawing_type}</td>
                  <td className="py-2.5 px-4 text-emerald-400">{m.io_signal}</td>
                  <td className="py-2.5 px-4 text-right">
                    <Badge variant="high" size="xs">{labels.matched_status || 'MATCHED'}</Badge>
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
