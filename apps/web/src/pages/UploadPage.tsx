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
  Sliders
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      
      {/* Engineering Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#1e222d]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#64748b] mb-1">
            <span>INGESTION CONSOLE</span>
            <span>/</span>
            <span>SPEC: ISA-5.1-2009</span>
            <span>/</span>
            <span className="text-emerald-400">ENGINE IDLE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f1f5f9]">
            P&ID Drawing & DCS IO Ingestion
          </h1>
          <p className="text-xs text-[#94a3b8] mt-1 max-w-2xl leading-relaxed">
            Multi-signal OCR consensus, symbol port snapping, and deterministic cross-validation against distributed control system point registers.
          </p>
        </div>

        {/* Engine Telemetry Strip */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-[#94a3b8] bg-[#12141c] p-2 rounded border border-[#1e222d]">
          <div className="flex items-center gap-1.5">
            <Binary size={13} className="text-blue-400" />
            <span>Dual OCR Voting</span>
          </div>
          <span className="text-[#2b3145]">•</span>
          <div className="flex items-center gap-1.5">
            <Sliders size={13} className="text-purple-400" />
            <span>ISA-5.1 Rules</span>
          </div>
          <span className="text-[#2b3145]">•</span>
          <div className="flex items-center gap-1.5">
            <Database size={13} className="text-emerald-400" />
            <span>DCS Fuzzy Index</span>
          </div>
        </div>
      </div>

      {/* Main Upload Workspace */}
      <Card className="bg-[#12141c] border-[#1e222d] shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Target 1: P&ID Drawing Blueprint */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#f1f5f9] flex items-center gap-1.5">
                  <FileCode2 size={15} className="text-blue-400" />
                  <span>1. P&ID Blueprint (PDF)</span>
                </span>
                <span className="font-mono text-[10px] text-[#64748b]">Max 50MB · Vector or Scanned</span>
              </div>

              <label
                htmlFor="pdf-upload"
                className={`relative flex flex-col items-center justify-center p-6 border rounded-md cursor-pointer transition-all bg-[#090a0f] ${
                  pdfFile
                    ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
                    : 'border-[#1e222d] hover:border-[#2b3145] hover:bg-[#0f1117]'
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
                  <div className="text-center space-y-2">
                    <div className="w-9 h-9 mx-auto rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-medium text-[#f1f5f9] truncate max-w-[240px]">{pdfFile.name}</p>
                      <p className="text-[10px] text-[#64748b] font-mono">{(pdfFile.size / 1024).toFixed(1)} KB · Ready</p>
                    </div>
                    <span className="text-[11px] text-blue-400 hover:underline">Change file</span>
                  </div>
                ) : (
                  <div className="text-center space-y-2 py-2">
                    <div className="w-9 h-9 mx-auto rounded bg-[#151821] border border-[#1e222d] text-[#64748b] flex items-center justify-center">
                      <FileCode2 size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#f1f5f9]">Select or drop P&ID drawing</p>
                      <p className="text-[11px] text-[#64748b]">Supports multi-sheet engineering sets</p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Target 2: DCS IO List Register */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#f1f5f9] flex items-center gap-1.5">
                  <FileSpreadsheet size={15} className="text-emerald-400" />
                  <span>2. DCS IO Point Schedule (Excel)</span>
                </span>
                <span className="font-mono text-[10px] text-[#64748b]">Max 10MB · .xlsx / .xls</span>
              </div>

              <label
                htmlFor="xlsx-upload"
                className={`relative flex flex-col items-center justify-center p-6 border rounded-md cursor-pointer transition-all bg-[#090a0f] ${
                  xlsxFile
                    ? 'border-emerald-500/40 bg-emerald-500/[0.02]'
                    : 'border-[#1e222d] hover:border-[#2b3145] hover:bg-[#0f1117]'
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
                  <div className="text-center space-y-2">
                    <div className="w-9 h-9 mx-auto rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-medium text-[#f1f5f9] truncate max-w-[240px]">{xlsxFile.name}</p>
                      <p className="text-[10px] text-[#64748b] font-mono">{(xlsxFile.size / 1024).toFixed(1)} KB · Ready</p>
                    </div>
                    <span className="text-[11px] text-blue-400 hover:underline">Change file</span>
                  </div>
                ) : (
                  <div className="text-center space-y-2 py-2">
                    <div className="w-9 h-9 mx-auto rounded bg-[#151821] border border-[#1e222d] text-[#64748b] flex items-center justify-center">
                      <FileSpreadsheet size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[#f1f5f9]">Select or drop DCS IO register</p>
                      <p className="text-[11px] text-[#64748b]">Tag, signal type, channel, and ranges</p>
                    </div>
                  </div>
                )}
              </label>
            </div>

          </div>

          {/* Validation Alert */}
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-mono">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Execution Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#1e222d]">
            <button
              type="button"
              onClick={loadSampleFiles}
              disabled={isSubmitting}
              className="text-xs font-mono text-[#94a3b8] hover:text-[#f1f5f9] flex items-center gap-2 p-1.5 rounded hover:bg-[#151821] transition-colors"
            >
              <div className="w-5 h-5 rounded bg-[#1c202d] border border-[#2b3145] flex items-center justify-center text-blue-400">
                <Binary size={11} />
              </div>
              <span>Load Reference Benchmark (sample_pid_01.pdf & sample_io_list.xlsx)</span>
            </button>

            <Button
              type="submit"
              size="md"
              variant="engineering"
              isLoading={isSubmitting}
              disabled={!pdfFile || !xlsxFile}
              className="w-full sm:w-auto font-mono text-xs"
            >
              <span>Execute Ingestion & Cross-Validation</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </form>
      </Card>

      {/* Technical Engine Architecture Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div className="p-4 rounded-lg bg-[#12141c] border border-[#1e222d] space-y-2">
          <div className="w-7 h-7 rounded bg-[#151821] border border-[#2b3145] text-blue-400 flex items-center justify-center">
            <ShieldCheck size={15} />
          </div>
          <h3 className="text-xs font-semibold text-[#f1f5f9]">Cross-Validation Logic</h3>
          <p className="text-[11px] text-[#94a3b8] leading-relaxed">
            Deterministic set comparison identifying uninstrumented valves, orphan control loops, and signal protocol mismatches.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-[#12141c] border border-[#1e222d] space-y-2">
          <div className="w-7 h-7 rounded bg-[#151821] border border-[#2b3145] text-purple-400 flex items-center justify-center">
            <Sliders size={15} />
          </div>
          <h3 className="text-xs font-semibold text-[#f1f5f9]">Multi-Signal Confidence</h3>
          <p className="text-[11px] text-[#94a3b8] leading-relaxed">
            Weighted Bayesian fusion scoring dual-engine OCR agreement, bubble template IoU, and ISA-5.1 grammatical syntax.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-[#12141c] border border-[#1e222d] space-y-2">
          <div className="w-7 h-7 rounded bg-[#151821] border border-[#2b3145] text-emerald-400 flex items-center justify-center">
            <Layers size={15} />
          </div>
          <h3 className="text-xs font-semibold text-[#f1f5f9]">Topology Simplification</h3>
          <p className="text-[11px] text-[#94a3b8] leading-relaxed">
            Automatic collapsing of manual inline drains and instrument piping to produce uncluttered, interactive process schematics.
          </p>
        </div>
      </div>

    </div>
  );
};
