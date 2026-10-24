import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCode2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UploadCloud,
  Sparkles
} from 'lucide-react';
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
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 flex flex-col justify-between space-y-4 animate-fade-in font-sans min-h-[calc(100vh-8rem)]">
      
      {/* Expansive Technical Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-white">
            P&ID Cross-Validation Studio
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 font-normal mt-0.5 max-w-2xl">
            Automated ingestion and deterministic validation of physical P&ID drawings against DCS I/O point registers.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono font-medium px-3 py-1 rounded-full bg-white/[0.06] text-neutral-300 border border-white/[0.1] backdrop-blur-md">
            ISA-5.1 · OCR Normalization · DCS 4-Signal
          </span>
        </div>
      </div>

      {/* Main Screen-Filling Upload Container */}
      <div className="adobe-card p-6 sm:p-8 lg:p-10 flex-1 flex flex-col justify-between space-y-6 shadow-2xl">
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 flex-1 min-h-[420px] lg:min-h-[460px]">
            
            {/* Target 1: P&ID Drawing Blueprint */}
            <div className="flex flex-col h-full space-y-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-neutral-200">
                <span className="flex items-center gap-2">
                  <FileCode2 size={16} className="text-cyan-400" />
                  <span className="font-semibold text-sm">1. P&ID Blueprint (PDF)</span>
                </span>
                <span className="text-[11px] text-neutral-400 font-normal px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1]">
                  Vector or Scanned · Max 50MB
                </span>
              </div>

              <label
                htmlFor="pdf-upload"
                className={`group relative flex-1 flex flex-col items-center justify-center p-8 lg:p-12 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                  pdfFile
                    ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.15)]'
                    : 'adobe-well hover:border-cyan-400/50 hover:bg-white/[0.04]'
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
                  <div className="text-center space-y-3 py-4 max-w-md">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                      <CheckCircle2 size={36} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm sm:text-base font-semibold text-white truncate max-w-[360px] mx-auto">
                        {pdfFile.name}
                      </p>
                      <p className="text-xs text-emerald-400 font-medium">
                        {(pdfFile.size / 1024).toFixed(1)} KB · READY FOR INGESTION
                      </p>
                    </div>
                    <span className="text-xs text-cyan-400 hover:underline font-medium block pt-1">
                      Click to replace blueprint file
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-3.5 py-4 max-w-sm">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-white/[0.08] text-cyan-400 flex items-center justify-center border border-white/[0.15] shadow-lg group-hover:scale-110 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/40 transition-all duration-300">
                      <UploadCloud size={32} className="sm:scale-125" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base sm:text-lg font-semibold text-white">
                        Choose P&ID PDF Blueprint
                      </p>
                      <p className="text-xs sm:text-sm text-neutral-400 font-normal">
                        Drag & drop engineering blueprint, or browse local files
                      </p>
                    </div>
                    <span className="inline-block text-[11px] text-cyan-300 font-medium px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25">
                      Supports Multi-Page Vector PDF & Scanned Drawings
                    </span>
                  </div>
                )}
              </label>
            </div>

            {/* Target 2: DCS IO List Register */}
            <div className="flex flex-col h-full space-y-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-neutral-200">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-emerald-400" />
                  <span className="font-semibold text-sm">2. DCS IO Point Schedule (Excel)</span>
                </span>
                <span className="text-[11px] text-neutral-400 font-normal px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1]">
                  XLSX or XLS · Max 10MB
                </span>
              </div>

              <label
                htmlFor="xlsx-upload"
                className={`group relative flex-1 flex flex-col items-center justify-center p-8 lg:p-12 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                  xlsxFile
                    ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_24px_rgba(16,185,129,0.15)]'
                    : 'adobe-well hover:border-emerald-400/50 hover:bg-white/[0.04]'
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
                  <div className="text-center space-y-3 py-4 max-w-md">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                      <CheckCircle2 size={36} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm sm:text-base font-semibold text-white truncate max-w-[360px] mx-auto">
                        {xlsxFile.name}
                      </p>
                      <p className="text-xs text-emerald-400 font-medium">
                        {(xlsxFile.size / 1024).toFixed(1)} KB · READY FOR INGESTION
                      </p>
                    </div>
                    <span className="text-xs text-cyan-400 hover:underline font-medium block pt-1">
                      Click to replace Excel schedule
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-3.5 py-4 max-w-sm">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-white/[0.08] text-emerald-400 flex items-center justify-center border border-white/[0.15] shadow-lg group-hover:scale-110 group-hover:bg-emerald-500/20 group-hover:border-emerald-400/40 transition-all duration-300">
                      <UploadCloud size={32} className="sm:scale-125" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base sm:text-lg font-semibold text-white">
                        Choose DCS IO List (.xlsx)
                      </p>
                      <p className="text-xs sm:text-sm text-neutral-400 font-normal">
                        Drag & drop I/O schedule, or browse local files
                      </p>
                    </div>
                    <span className="inline-block text-[11px] text-emerald-300 font-medium px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                      Channel Addresses, Signal Types & Tag Ranges
                    </span>
                  </div>
                )}
              </label>
            </div>

          </div>

          {/* Validation Error Alert */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-white text-xs font-medium">
              <AlertTriangle size={18} className="shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Clean Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/[0.1] shrink-0">
            <Button
              type="button"
              onClick={loadSampleFiles}
              disabled={isSubmitting}
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto font-medium"
            >
              <Sparkles size={16} className="text-amber-400" />
              <span>Load Sample Dataset</span>
            </Button>

            <Button
              type="submit"
              size="lg"
              variant="primary"
              isLoading={isSubmitting}
              disabled={!pdfFile || !xlsxFile}
              className="w-full sm:w-auto font-medium text-neutral-900 bg-white hover:bg-slate-100 shadow-md"
            >
              <span>Validate & Ingest Topology</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      </div>

    </div>
  );
};
