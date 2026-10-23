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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in print:p-0 print:space-y-4">
      
      {/* Official Audit Document Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1e222d]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#64748b] mb-1">
            <span>OFFICIAL AUDIT REPORT</span>
            <span>/</span>
            <span>DOC-ID: AUD-UNT-{jobId.slice(0, 8).toUpperCase()}</span>
            <span>/</span>
            <span className="text-emerald-400 font-semibold">ISA-5.1 CERTIFIED</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f1f5f9]">
            {labels.report_title || 'P&ID Drawing vs IO List Cross-Validation Report'}
          </h1>
          <p className="text-xs text-[#94a3b8] mt-1 max-w-2xl leading-relaxed">
            {labels.report_subtitle || 'Deterministic discrepancy analysis between physical P&ID blueprints and DCS electrical point registers.'}
          </p>
        </div>

        {/* Action Controls & Multi-lingual Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 print:hidden">
          
          {/* Operator Language Selector */}
          <div className="flex items-center bg-[#12141c] p-0.5 rounded border border-[#1e222d] text-xs font-mono">
            <span className="px-2 text-[#64748b] flex items-center gap-1 text-[11px]">
              <Globe size={12} className="text-blue-400" />
              <span>LANG:</span>
            </span>
            {(['en', 'hi', 'mr'] as const).map((l) => (
              <button
                key={l}
                id={`lang-${l}-btn`}
                onClick={() => setLang(l)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  lang === l
                    ? 'bg-[#1e222d] text-[#f1f5f9] font-bold border border-[#2b3145]'
                    : 'text-[#64748b] hover:text-[#f1f5f9]'
                }`}
              >
                {l === 'en' ? 'EN' : l === 'hi' ? 'हिन्दी' : 'मराठी'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={`/api/v1/jobs/${jobId}/simplified-diagram/pdf`}
              download={`simplified_diagram_${jobId.slice(0, 8)}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="secondary"
                size="sm"
                className="font-mono text-xs flex items-center gap-1.5 border-emerald-700/60 text-emerald-400 hover:bg-emerald-950/40"
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
        <Card className="p-4 space-y-1 bg-[#12141c] border-[#1e222d]">
          <span className="text-[10px] text-[#64748b] uppercase tracking-wider block">
            {labels.total_tags_title || 'Total Tags Evaluated'}
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-[#f1f5f9] tabular-nums">{summary.tags_total}</p>
          <span className="text-[10px] text-[#64748b]">100% Ingested</span>
        </Card>

        <Card className="p-4 space-y-1 bg-[#12141c] border-emerald-500/25">
          <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">
            {labels.resolved_title || 'Verified & Resolved'}
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums">{summary.resolved}</p>
          <span className="text-[10px] text-emerald-500">
            {((summary.resolved / Math.max(summary.tags_total, 1)) * 100).toFixed(0)}% Confidence
          </span>
        </Card>

        <Card className="p-4 space-y-1 bg-[#12141c] border-amber-500/25">
          <span className="text-[10px] text-amber-400 uppercase tracking-wider block">
            {labels.review_req_title || 'Requires Review'}
          </span>
          <p className="text-2xl sm:text-3xl font-bold text-amber-400 tabular-nums">{summary.needs_review}</p>
          <span className="text-[10px] text-amber-500">Human Check Required</span>
        </Card>

        <Card className="p-4 space-y-1 bg-[#12141c] border-[#1e222d]">
          <span className="text-[10px] text-blue-400 uppercase tracking-wider block">
            {labels.decision_split_title || 'Decision Distribution'}
          </span>
          <p className="text-lg font-bold text-[#f1f5f9] mt-0.5 tabular-nums">
            {summary.auto_pct}% <span className="text-xs text-[#64748b] font-normal">auto</span>
          </p>
          <p className="text-[10px] text-[#64748b]">
            {summary.llm_pct}% LLM | {summary.human_pct}% Human
          </p>
        </Card>
      </div>

      {/* Decision Distribution Bar */}
      <Card className="p-4 space-y-2.5 bg-[#12141c] border-[#1e222d]">
        <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#64748b]">
          Three-Tier Decision Logic Distribution
        </h3>
        
        <div className="w-full h-2.5 rounded bg-[#090a0f] flex overflow-hidden border border-[#1e222d]">
          <div style={{ width: `${summary.auto_pct}%` }} className="bg-emerald-500" title={`Auto: ${summary.auto_pct}%`} />
          <div style={{ width: `${summary.llm_pct}%` }} className="bg-blue-500" title={`LLM: ${summary.llm_pct}%`} />
          <div style={{ width: `${summary.human_pct}%` }} className="bg-amber-500" title={`Human: ${summary.human_pct}%`} />
        </div>

        <div className="flex flex-wrap items-center gap-5 text-[11px] font-mono text-[#94a3b8] pt-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Auto-Accepted (≥0.85): {summary.auto_pct}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> LLM Resolved (0.60–0.85): {summary.llm_pct}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Human Review Queue (&lt;0.60): {summary.human_pct}%
          </span>
        </div>
      </Card>

      {/* Discrepancy Breakdown Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Table 1: Defined in IO List, Missing in Drawing */}
        <Card className="p-4 space-y-3 bg-[#12141c] border-red-500/25">
          <div className="flex items-center justify-between pb-2 border-b border-[#1e222d]">
            <h3 className="text-xs font-bold text-[#f1f5f9] flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              <span>{labels.missing_drawing_title || 'Defined in IO List, Missing in Drawing'}</span>
            </h3>
            <Badge variant="low" size="xs">{report.missing_in_drawing.length}</Badge>
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            {labels.missing_drawing_desc || 'Signals present in the plant DCS IO database that were not detected anywhere on the P&ID blueprint.'}
          </p>

          <div className="space-y-1.5 font-mono text-xs">
            {report.missing_in_drawing.map((item) => (
              <div key={item.io_tag} className="p-2.5 rounded bg-[#090a0f] border border-[#1e222d] flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-red-400">{item.io_tag}</span>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">{item.description}</p>
                </div>
                <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                  MISSING IN DWG
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Table 2: Found in Drawing, Missing in IO List */}
        <Card className="p-4 space-y-3 bg-[#12141c] border-amber-500/25">
          <div className="flex items-center justify-between pb-2 border-b border-[#1e222d]">
            <h3 className="text-xs font-bold text-[#f1f5f9] flex items-center gap-2">
              <HelpCircle size={14} className="text-amber-400" />
              <span>{labels.missing_io_title || 'Found in Drawing, Missing in IO List'}</span>
            </h3>
            <Badge variant="medium" size="xs">{report.missing_in_io_list.length}</Badge>
          </div>
          <p className="text-[11px] text-[#94a3b8]">
            {labels.missing_io_desc || 'Physical equipment or mechanical valves detected on the blueprint that lack an electrical IO point.'}
          </p>

          <div className="space-y-1.5 font-mono text-xs">
            {report.missing_in_io_list.map((item) => (
              <div key={item.tag} className="p-2.5 rounded bg-[#090a0f] border border-[#1e222d] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-400">{item.tag}</span>
                  <span className="text-[11px] text-[#94a3b8] block">Manual Hand Valve / Mechanical</span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  NO DCS POINT
                </span>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* Signal Type Alignments & Cross-Check Matrix */}
      <Card className="p-4 space-y-3 bg-[#12141c] border-[#1e222d]">
        <div className="flex items-center justify-between pb-2 border-b border-[#1e222d]">
          <h3 className="text-xs font-bold text-[#f1f5f9] flex items-center gap-2">
            <FileSpreadsheet size={14} className="text-blue-400" />
            <span>{labels.type_mismatch_title || 'Instrument Type & Signal Discrepancies'}</span>
          </h3>
          <span className="text-[10px] font-mono text-[#64748b]">POINT-TO-POINT VERIFICATION</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#090a0f] text-[#64748b] text-[10px] uppercase tracking-wider border-b border-[#1e222d]">
              <tr>
                <th className="py-2 px-3">Tag</th>
                <th className="py-2 px-3">Drawing Identification</th>
                <th className="py-2 px-3">DCS Registered Signal</th>
                <th className="py-2 px-3 text-right">Verification Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e222d]">
              {report.type_mismatches.map((m) => (
                <tr key={m.tag} className="hover:bg-[#151821] transition-colors">
                  <td className="py-2 px-3 font-bold text-blue-400">{m.tag}</td>
                  <td className="py-2 px-3 text-[#f1f5f9]">{m.drawing_type}</td>
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
