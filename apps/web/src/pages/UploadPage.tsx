import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCode2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UploadCloud,
  Sparkles,
  Zap
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
      setErrorMsg('P&ID drawing must be a PDF file.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('File exceeds 50MB limit.');
      return;
    }
    setPdfFile(file);
  };

  const handleXlsxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setErrorMsg('IO List must be an Excel file (.xlsx or .xls).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File exceeds 10MB limit.');
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
      setErrorMsg(error?.message || 'Failed to load sample dataset.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile || !xlsxFile) {
      setErrorMsg('Please provide both the P&ID drawing (PDF) and DCS IO List (Excel).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.createJob(pdfFile, xlsxFile);
      navigate(`/jobs/${res.job_id}`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error?.message || 'Upload failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-24 space-y-8 animate-fade-in">
      
      {/* Minimal Aesthetic Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-400/35 backdrop-blur-md shadow-[0_0_20px_rgba(6,182,212,0.25),inset_0_1px_0_0_rgba(255,255,255,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>ISA-5.1 · DETERMINISTIC CROSS-VALIDATION</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-white drop-shadow-sm">
          P&ID Cross-Validation
        </h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          Upload engineering drawings and DCS schedules to detect discrepancies, resolve port connectivity, and generate clean process topology.
        </p>
      </div>

      {/* Quick 1-Click Benchmark Action Card */}
      <div className="premium-glass rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/[0.12] hover:border-cyan-400/40 transition-all shadow-[0_12px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-400/30 text-cyan-300 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(6,182,212,0.25)]">
            <Zap size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Preloaded Separator Loop</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
                BENCHMARK READY
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              sample_pid_01.pdf & sample_io_list.xlsx (24 I/O Channels)
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={loadSampleFiles}
          disabled={isSubmitting}
          variant="engineering"
          size="sm"
          className="w-full sm:w-auto font-mono text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shadow-md"
        >
          <Sparkles size={13} />
          <span>Run 1-Click Benchmark</span>
          <ArrowRight size={13} />
        </Button>
      </div>

      {/* Main Upload Frosted Glass Card */}
      <Card variant="glass" className="p-6 sm:p-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Target 1: P&ID Drawing Blueprint */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileCode2 size={16} className="text-cyan-400" />
                  <span>1. P&ID Blueprint (PDF)</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                  Max 50MB
                </span>
              </label>

              <label
                htmlFor="pdf-upload"
                className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  pdfFile
                    ? 'border-emerald-400/60 bg-emerald-950/30 shadow-[0_0_25px_rgba(16,185,129,0.2),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl'
                    : 'glass-well hover:border-cyan-400/60 hover:bg-cyan-500/[0.03] shadow-[inset_0_2px_8px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.1)]'
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
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-medium text-white truncate max-w-[240px]">
                        {pdfFile.name}
                      </p>
                      <p className="text-[11px] text-emerald-400/90 font-mono mt-0.5">
                        {(pdfFile.size / 1024).toFixed(1)} KB · READY
                      </p>
                    </div>
                    <span className="text-[11px] text-cyan-300 hover:text-white underline font-mono">
                      Change blueprint file
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-2.5 py-2">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.06] border border-white/[0.15] text-slate-300 group-hover:text-cyan-300 group-hover:border-cyan-400/50 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center transition-all duration-300">
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                        Choose P&ID PDF Blueprint
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Vector or scanned engineering drawing
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Target 2: DCS IO List Register */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-emerald-400" />
                  <span>2. DCS IO Point Schedule (Excel)</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                  Max 10MB
                </span>
              </label>

              <label
                htmlFor="xlsx-upload"
                className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  xlsxFile
                    ? 'border-emerald-400/60 bg-emerald-950/30 shadow-[0_0_25px_rgba(16,185,129,0.2),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl'
                    : 'glass-well hover:border-emerald-400/60 hover:bg-emerald-500/[0.03] shadow-[inset_0_2px_8px_rgba(0,0,0,0.5),0_1px_1px_rgba(255,255,255,0.1)]'
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
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-medium text-white truncate max-w-[240px]">
                        {xlsxFile.name}
                      </p>
                      <p className="text-[11px] text-emerald-400/90 font-mono mt-0.5">
                        {(xlsxFile.size / 1024).toFixed(1)} KB · READY
                      </p>
                    </div>
                    <span className="text-[11px] text-cyan-300 hover:text-white underline font-mono">
                      Change Excel file
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-2.5 py-2">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-white/[0.06] border border-white/[0.15] text-slate-300 group-hover:text-emerald-300 group-hover:border-emerald-400/50 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center transition-all duration-300">
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                        Choose DCS IO List (.xlsx)
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Channel addresses & point tag register
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>

          </div>

          {/* Validation Error Alert */}
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs font-mono backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <AlertTriangle size={16} className="shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Clean Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
            <Button
              type="button"
              onClick={loadSampleFiles}
              disabled={isSubmitting}
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto text-xs text-slate-300 hover:text-white flex items-center gap-2"
            >
              <Sparkles size={13} className="text-cyan-400" />
              <span>Load Sample Files</span>
            </Button>

            <Button
              type="submit"
              size="md"
              variant="engineering"
              isLoading={isSubmitting}
              disabled={!pdfFile || !xlsxFile}
              className="w-full sm:w-auto text-xs flex items-center justify-center gap-2 font-semibold shadow-lg"
            >
              <span>Validate & Process</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </form>
      </Card>

    </div>
  );
};
