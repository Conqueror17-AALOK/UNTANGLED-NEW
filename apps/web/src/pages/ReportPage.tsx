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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-industrial-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-white tracking-tight">
              {labels.report_title || 'Audit Report'}
            </h1>
            <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-industrial-900 border border-industrial-800">
              {jobId}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            P&ID Drawing vs DCS IO Register Verification
          </p>
        </div>

        {/* Action Controls & Multi-lingual Switcher */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* Language Selector */}
          <div className="flex items-center bg-industrial-950 p-1 rounded-lg border border-industrial-800 text-xs font-mono">
            <Globe size={13} className="text-slate-400 ml-1.5 mr-1" />
            {(['en', 'hi', 'mr'] as const).map((l) => (
              <button
                key={l}
                id={`lang-${l}-btn`}
                onClick={() => setLang(l)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  lang === l
                    ? 'bg-industrial-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {l === 'en' ? 'EN' : l === 'hi' ? 'HI' : 'MR'}
              </button>
            ))}
          </div>

          <a
            href={`/api/v1/jobs/${jobId}/simplified-diagram/pdf`}
            download={`diagram_${jobId.slice(0, 8)}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="secondary"
              size="sm"
              className="font-mono text-xs flex items-center gap-1.5 border-emerald-700/60 text-emerald-300 hover:bg-emerald-950/40"
            >
              <Download size={13} />
              <span>Diagram PDF</span>
            </Button>
          </a>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadPDF}
            className="font-mono text-xs flex items-center gap-1.5"
          >
            <FileCheck2 size={13} className="text-blue-400" />
            <span>Report PDF</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            className="font-mono text-xs flex items-center gap-1.5"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Print</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJSON}
            className="font-mono text-xs flex items-center gap-1.5"
          >
            <Download size={13} />
            <span>JSON</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <Card variant="glass" className="p-4 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
            {labels.total_tags_title || 'Total Tags'}
          </span>
          <p className="text-2xl font-heading font-bold text-white tabular-nums">{summary.tags_total}</p>
        </Card>

        <Card variant="glass" className="p-4 space-y-1">
          <span className="text-[10px] text-emerald-400 uppercase tracking-wider block font-semibold">
            {labels.resolved_title || 'Verified'}
          </span>
          <p className="text-2xl font-heading font-bold text-emerald-400 tabular-nums">{summary.resolved}</p>
          <span className="text-[10px] text-slate-400 block">
            {summary.tags_total > 0 ? Math.round((summary.resolved / summary.tags_total) * 100) : 0}% matched
          </span>
        </Card>

        <Card variant="glass" className="p-4 space-y-1">
          <span className="text-[10px] text-amber-400 uppercase tracking-wider block font-semibold">
            {labels.review_req_title || 'Needs Review'}
          </span>
          <p className="text-2xl font-heading font-bold text-amber-400 tabular-nums">{summary.needs_review}</p>
          <span className="text-[10px] text-slate-400 block">
            {summary.needs_review === 0 ? 'All cleared' : 'Action items'}
          </span>
        </Card>

        <Card variant="glass" className="p-4 space-y-1">
          <span className="text-[10px] text-purple-400 uppercase tracking-wider block font-semibold">
            Decision Split
          </span>
          <p className="text-2xl font-heading font-bold text-purple-300 tabular-nums">
            {summary.auto_pct}%
          </p>
          <span className="text-[10px] text-slate-400 block">
            {summary.llm_pct}% LLM • {summary.human_pct}% Manual
          </span>
        </Card>
      </div>

      {/* Decision Distribution Bar */}
      <Card variant="glass" className="p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Decision Distribution
          </span>
          <div className="flex items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Auto ({summary.auto_pct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> LLM ({summary.llm_pct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Review ({summary.human_pct}%)
            </span>
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-industrial-950 flex overflow-hidden border border-industrial-800">
          <div style={{ width: `${summary.auto_pct}%` }} className="bg-emerald-500" />
          <div style={{ width: `${summary.llm_pct}%` }} className="bg-blue-500" />
          <div style={{ width: `${summary.human_pct}%` }} className="bg-amber-500" />
        </div>
      </Card>

      {/* Discrepancy Breakdown Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Table 1: In IO List, Missing in Drawing */}
        <Card variant="glass" className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-industrial-800">
            <h3 className="text-xs font-heading font-bold text-slate-200 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <span>{labels.missing_drawing_title || 'In IO List, Missing in Drawing'}</span>
            </h3>
            <Badge variant="low" size="xs">{report.missing_in_drawing.length}</Badge>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {report.missing_in_drawing.length > 0 ? (
              report.missing_in_drawing.map((item) => (
                <div key={item.io_tag} className="p-2.5 rounded-lg bg-industrial-950/80 border border-industrial-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-red-400">{item.io_tag}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.description}</p>
                  </div>
                  <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                    Missing in Drawing
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-slate-500 text-xs">No missing tags</p>
            )}
          </div>
        </Card>

        {/* Table 2: In Drawing, Missing in IO List */}
        <Card variant="glass" className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-industrial-800">
            <h3 className="text-xs font-heading font-bold text-slate-200 flex items-center gap-2">
              <HelpCircle size={14} className="text-amber-400" />
              <span>{labels.missing_io_title || 'In Drawing, Missing in IO List'}</span>
            </h3>
            <Badge variant="medium" size="xs">{report.missing_in_io_list.length}</Badge>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {report.missing_in_io_list.length > 0 ? (
              report.missing_in_io_list.map((item) => (
                <div key={item.tag} className="p-2.5 rounded-lg bg-industrial-950/80 border border-industrial-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-400">{item.tag}</span>
                    <span className="text-[11px] text-slate-400 block">Mechanical / Manual</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    No DCS Point
                  </span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-slate-500 text-xs">No missing IO points</p>
            )}
          </div>
        </Card>
      </div>

      {/* Signal Verification Matrix */}
      <Card variant="glass" className="p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-industrial-800">
          <h3 className="text-xs font-heading font-bold text-slate-200 flex items-center gap-2">
            <FileSpreadsheet size={14} className="text-cyan-400" />
            <span>{labels.type_mismatch_title || 'Signal & Type Alignment'}</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {report.type_mismatches.length} Signals Verified
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-industrial-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-industrial-950 text-slate-400 text-[10px] uppercase tracking-wider border-b border-industrial-800">
              <tr>
                <th className="py-2.5 px-3">Tag</th>
                <th className="py-2.5 px-3">Drawing Type</th>
                <th className="py-2.5 px-3">DCS Registered</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/60 bg-industrial-900/30">
              {report.type_mismatches.map((m) => (
                <tr key={m.tag} className="hover:bg-industrial-800/30 transition-colors">
                  <td className="py-2 px-3 font-bold text-cyan-400">{m.tag}</td>
                  <td className="py-2 px-3 text-slate-200">{m.drawing_type}</td>
                  <td className="py-2 px-3 text-emerald-400">{m.io_signal}</td>
                  <td className="py-2 px-3 text-right">
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
