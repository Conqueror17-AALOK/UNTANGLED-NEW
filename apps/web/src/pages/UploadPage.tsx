import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCode2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Binary,
  Layers,
  Database,
  Sliders,
  Sparkles,
  UploadCloud,
  FileText
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { apiClient } from '../api/client';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Invalid file format. Engineering drawing blueprint must be PDF.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('Drawing file exceeds 50MB system ingestion limit.');
      return;
    }
    setPdfFile(file);
  };

  const handleXlsxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setErrorMsg('Invalid file format. DCS IO List must be an Excel spreadsheet (.xlsx / .xls).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('IO List exceeds 10MB system limit.');
      return;
    }
    setXlsxFile(file);
  };

  const loadSampleFiles = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await apiClient.loadSampleJob();
      navigate(`/jobs/${res.job_id}`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error?.message || 'Failed to initialize benchmark sample job.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile || !xlsxFile) {
      setErrorMsg('Both P&ID drawing (PDF) and DCS IO register (XLSX) are required for cross-validation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.createJob(pdfFile, xlsxFile);
      navigate(`/jobs/${res.job_id}`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error?.message || 'Pipeline ingestion failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-3/4 h-64 bg-cyan-500/10 rounded-full blur-3xl -z-10" />

      {/* Engineering Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-industrial-800/80">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-industrial-900 via-industrial-900 to-cyan-950/40 border border-cyan-500/30 items-center justify-center shadow-lg shadow-cyan-950/30 group">
            <img src="/logo-mark.png" alt="UNTANGLED" className="w-9 h-9 object-contain group-hover:scale-105 transition-transform" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-700/50 mb-2.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-glow-cyan" />
              <span>Ingestion Console • Dual-OCR & ISA-5.1 Consensus</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">
              P&ID Drawing & DCS IO Ingestion
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
              Multi-signal OCR consensus, symbol port snapping, and deterministic cross-validation against distributed control system point registers.
            </p>
          </div>
        </div>

        {/* Engine Telemetry Strip */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 bg-industrial-900/80 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-industrial-800/80 shadow-md">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Binary size={14} className="text-cyan-400" />
            <span>Dual OCR Voting</span>
          </div>
          <span className="text-industrial-700">•</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Sliders size={14} className="text-purple-400" />
            <span>ISA-5.1 Rules</span>
          </div>
          <span className="text-industrial-700">•</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Database size={14} className="text-emerald-400" />
            <span>DCS Fuzzy Index</span>
          </div>
        </div>
      </div>

      {/* Benchmark Demo Quick-Launch Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-cyan-950/20 to-industrial-900 border border-cyan-800/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3 text-left w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Preloaded Benchmark Reference</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Ready to Run
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              sample_pid_01.pdf (Separator Loop) & sample_io_list.xlsx (24 Channels)
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={loadSampleFiles}
          disabled={isSubmitting}
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto font-mono text-xs text-cyan-300 border-cyan-800/60 hover:border-cyan-500 hover:bg-cyan-950/40 whitespace-nowrap"
        >
          <span>Run 1-Click Benchmark</span>
          <ArrowRight size={13} className="ml-1" />
        </Button>
      </div>

      {/* Main Upload Workspace */}
      <Card variant="glass" className="relative p-6 sm:p-8 space-y-6 overflow-hidden">
        {/* Subtle Background Watermark */}
        <div className="pointer-events-none absolute right-2 bottom-2 opacity-[0.035] select-none z-0">
          <img src="/logo-mark.png" alt="" className="w-64 h-64 object-contain" />
        </div>

        <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Target 1: P&ID Drawing Blueprint */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <FileCode2 size={13} />
                  </div>
                  <span>1. P&ID Blueprint (PDF)</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500 px-2 py-0.5 rounded bg-industrial-900 border border-industrial-800">
                  Vector or Scanned · Max 50MB
                </span>
              </div>

              <label
                htmlFor="pdf-upload"
                className={`group relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
                  pdfFile
                    ? 'border-emerald-500/50 bg-emerald-950/20 shadow-glow-emerald'
                    : 'border-industrial-700/60 hover:border-cyan-500/60 bg-industrial-950/70 hover:bg-industrial-900/70'
                }`}
              >
                <input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfChange}
                  className="sr-only"
                />

                {pdfFile ? (
                  <div className="text-center space-y-2.5 animate-fade-in">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/40">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-semibold text-slate-100 truncate max-w-[260px]">{pdfFile.name}</p>
                      <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        {(pdfFile.size / 1024).toFixed(1)} KB · Ready for Ingestion
                      </p>
                    </div>
                    <span className="inline-block text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
                      Replace drawing
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-3 py-3">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-industrial-900 border border-industrial-700 text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-500/40 group-hover:bg-cyan-950/30 flex items-center justify-center transition-all">
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        Drop P&ID drawing or click to browse
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        High-resolution engineering drawings & schematics
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-industrial-900 border border-industrial-800 text-[10px] font-mono text-slate-400">
                      <FileText size={10} />
                      <span>PDF FORMAT</span>
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Target 2: DCS IO List Register */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <FileSpreadsheet size={13} />
                  </div>
                  <span>2. DCS IO Point Schedule (Excel)</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500 px-2 py-0.5 rounded bg-industrial-900 border border-industrial-800">
                  .xlsx / .xls · Max 10MB
                </span>
              </div>

              <label
                htmlFor="xlsx-upload"
                className={`group relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
                  xlsxFile
                    ? 'border-emerald-500/50 bg-emerald-950/20 shadow-glow-emerald'
                    : 'border-industrial-700/60 hover:border-emerald-500/60 bg-industrial-950/70 hover:bg-industrial-900/70'
                }`}
              >
                <input
                  id="xlsx-upload"
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleXlsxChange}
                  className="sr-only"
                />

                {xlsxFile ? (
                  <div className="text-center space-y-2.5 animate-fade-in">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/40">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-semibold text-slate-100 truncate max-w-[260px]">{xlsxFile.name}</p>
                      <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        {(xlsxFile.size / 1024).toFixed(1)} KB · Ready for Indexing
                      </p>
                    </div>
                    <span className="inline-block text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
                      Replace register
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-3 py-3">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-industrial-900 border border-industrial-700 text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/40 group-hover:bg-emerald-950/30 flex items-center justify-center transition-all">
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                        Drop DCS point register or click to browse
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Channel addresses, ranges, signal types & descriptions
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-industrial-900 border border-industrial-800 text-[10px] font-mono text-slate-400">
                      <FileSpreadsheet size={10} />
                      <span>XLSX / XLS FORMAT</span>
                    </div>
                  </div>
                )}
              </label>
            </div>

          </div>

          {/* Validation Alert */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-950/50 border border-red-500/30 text-red-400 text-xs font-mono shadow-md">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Execution Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-industrial-800/80">
            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Multi-tier verification pipeline armed</span>
            </div>

            <Button
              type="submit"
              size="lg"
              variant="engineering"
              isLoading={isSubmitting}
              disabled={!pdfFile || !xlsxFile}
              className="w-full sm:w-auto font-mono text-xs flex items-center justify-center gap-2 shadow-glow-cyan"
            >
              <span>Execute Ingestion & Cross-Validation</span>
              <ArrowRight size={15} />
            </Button>
          </div>
        </form>
      </Card>

      {/* Technical Engine Architecture Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left">
        <Card variant="glass" className="p-5 space-y-3 relative group hover:border-blue-500/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-md">
            <ShieldCheck size={18} />
          </div>
          <h3 className="text-sm font-heading font-semibold text-slate-100">Cross-Validation Logic</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Deterministic set comparison identifying uninstrumented valves, orphan control loops, and signal protocol mismatches.
          </p>
          <div className="h-0.5 w-12 bg-blue-500/50 rounded-full" />
        </Card>

        <Card variant="glass" className="p-5 space-y-3 relative group hover:border-purple-500/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-md">
            <Sliders size={18} />
          </div>
          <h3 className="text-sm font-heading font-semibold text-slate-100">Multi-Signal Confidence</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Weighted Bayesian fusion scoring dual-engine OCR agreement, bubble template IoU, and ISA-5.1 grammatical syntax.
          </p>
          <div className="h-0.5 w-12 bg-purple-500/50 rounded-full" />
        </Card>

        <Card variant="glass" className="p-5 space-y-3 relative group hover:border-emerald-500/40 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-md">
            <Layers size={18} />
          </div>
          <h3 className="text-sm font-heading font-semibold text-slate-100">Topology Simplification</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Automatic collapsing of manual inline drains and instrument piping to produce uncluttered, interactive process schematics.
          </p>
          <div className="h-0.5 w-12 bg-emerald-500/50 rounded-full" />
        </Card>
      </div>

    </div>
  );
};

