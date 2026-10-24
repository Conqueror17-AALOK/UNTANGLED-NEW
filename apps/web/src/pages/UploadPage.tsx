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
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 animate-fade-in font-sans">
      
      {/* Clean Technical Hero */}
      <div className="text-center space-y-1.5 pb-2">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          P&ID Cross-Validation
        </h1>
        <p className="text-xs text-neutral-400 font-normal max-w-lg mx-auto">
          Automated ingestion and deterministic validation of physical P&ID drawings against DCS I/O point registers.
        </p>
      </div>

      {/* Main Upload Container */}
      <div className="adobe-card p-6 sm:p-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Target 1: P&ID Drawing Blueprint */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileCode2 size={15} className="text-blue-400" />
                  <span>1. P&ID Blueprint (PDF)</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-normal">
                  Max 50MB
                </span>
              </label>

              <label
                htmlFor="pdf-upload"
                className={`group relative flex flex-col items-center justify-center p-8 rounded-xl border transition-all duration-200 cursor-pointer ${
                  pdfFile
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'adobe-well hover:border-slate-400'
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
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white truncate max-w-[240px]">
                        {pdfFile.name}
                      </p>
                      <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                        {(pdfFile.size / 1024).toFixed(1)} KB · READY
                      </p>
                    </div>
                    <span className="text-xs text-blue-400 hover:underline font-medium block pt-1">
                      Change blueprint file
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-2.5 py-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-white flex items-center justify-center group-hover:bg-[#3f4554] transition-colors">
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Choose P&ID PDF Blueprint
                      </p>
                      <p className="text-xs text-neutral-400 font-normal mt-0.5">
                        Vector or scanned engineering drawing
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Target 2: DCS IO List Register */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet size={15} className="text-emerald-400" />
                  <span>2. DCS IO Point Schedule (Excel)</span>
                </span>
                <span className="text-[10px] text-neutral-400 font-normal">
                  Max 10MB
                </span>
              </label>

              <label
                htmlFor="xlsx-upload"
                className={`group relative flex flex-col items-center justify-center p-8 rounded-xl border transition-all duration-200 cursor-pointer ${
                  xlsxFile
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'adobe-well hover:border-slate-400'
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
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white truncate max-w-[240px]">
                        {xlsxFile.name}
                      </p>
                      <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                        {(xlsxFile.size / 1024).toFixed(1)} KB · READY
                      </p>
                    </div>
                    <span className="text-xs text-blue-400 hover:underline font-medium block pt-1">
                      Change Excel file
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-2.5 py-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-white flex items-center justify-center group-hover:bg-[#3f4554] transition-colors">
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Choose DCS IO List (.xlsx)
                      </p>
                      <p className="text-xs text-neutral-400 font-normal mt-0.5">
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
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/15 border border-red-500/30 text-white text-xs font-medium">
              <AlertTriangle size={18} className="shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Clean Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-[#434856]">
            <Button
              type="button"
              onClick={loadSampleFiles}
              disabled={isSubmitting}
              variant="secondary"
              size="md"
              className="w-full sm:w-auto"
            >
              <Sparkles size={14} className="text-amber-400" />
              <span>Load Sample Files</span>
            </Button>

            <Button
              type="submit"
              size="md"
              variant="primary"
              isLoading={isSubmitting}
              disabled={!pdfFile || !xlsxFile}
              className="w-full sm:w-auto"
            >
              <span>Validate & Process</span>
              <ArrowRight size={14} />
            </Button>
          </div>
        </form>
      </div>

    </div>
  );
};
