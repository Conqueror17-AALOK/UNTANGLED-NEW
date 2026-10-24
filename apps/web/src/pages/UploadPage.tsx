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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 pb-24 space-y-8 animate-fade-in">
      
      {/* Editorial Hero (Adobe Clean Display Black, 900 weight, tight tracking) */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-md text-xs font-bold text-white bg-[#2b211a] border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-[#eb1000]" />
          <span>ISA-5.1 · DETERMINISTIC CROSS-VALIDATION</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-heading font-black tracking-[-0.035em] text-white">
          P&ID Cross-Validation
        </h1>
        <p className="text-base sm:text-lg text-slate-400 font-bold max-w-xl mx-auto leading-relaxed">
          Upload engineering drawings and DCS schedules to detect discrepancies, resolve port connectivity, and generate clean process topology.
        </p>
      </div>

      {/* Quick 1-Click Benchmark Action Card */}
      <div className="adobe-card p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/10">
            <Zap size={20} className="text-[#eb1000]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-base font-extrabold text-white">Preloaded Separator Loop</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#2b211a] text-white border border-white/10">
                BENCHMARK READY
              </span>
            </div>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              sample_pid_01.pdf & sample_io_list.xlsx (24 I/O Channels)
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={loadSampleFiles}
          disabled={isSubmitting}
          variant="primary"
          size="md"
          className="w-full sm:w-auto font-bold whitespace-nowrap"
        >
          <Sparkles size={14} className="text-[#eb1000]" />
          <span>Run 1-Click Benchmark</span>
          <ArrowRight size={14} />
        </Button>
      </div>

      {/* Main Upload Editorial Card */}
      <Card variant="card" className="p-6 sm:p-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Target 1: P&ID Drawing Blueprint */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileCode2 size={16} className="text-[#eb1000]" />
                  <span>1. P&ID Blueprint (PDF)</span>
                </span>
                <span className="text-[11px] font-bold text-slate-400 px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08]">
                  Max 50MB
                </span>
              </label>

              <label
                htmlFor="pdf-upload"
                className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  pdfFile
                    ? 'border-[#10b981] bg-[#10b981]/10'
                    : 'adobe-well'
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
                    <div className="w-12 h-12 mx-auto rounded-full bg-[#10b981]/20 text-[#10b981] flex items-center justify-center border border-[#10b981]/30">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[240px]">
                        {pdfFile.name}
                      </p>
                      <p className="text-[11px] text-[#10b981] font-bold mt-0.5">
                        {(pdfFile.size / 1024).toFixed(1)} KB · READY
                      </p>
                    </div>
                    <span className="text-xs text-white hover:underline font-bold block pt-1">
                      Change blueprint file
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-2.5 py-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-white flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors">
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-white">
                        Choose P&ID PDF Blueprint
                      </p>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        Vector or scanned engineering drawing
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Target 2: DCS IO List Register */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-[#10b981]" />
                  <span>2. DCS IO Point Schedule (Excel)</span>
                </span>
                <span className="text-[11px] font-bold text-slate-400 px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08]">
                  Max 10MB
                </span>
              </label>

              <label
                htmlFor="xlsx-upload"
                className={`group relative flex flex-col items-center justify-center p-8 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  xlsxFile
                    ? 'border-[#10b981] bg-[#10b981]/10'
                    : 'adobe-well'
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
                    <div className="w-12 h-12 mx-auto rounded-full bg-[#10b981]/20 text-[#10b981] flex items-center justify-center border border-[#10b981]/30">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[240px]">
                        {xlsxFile.name}
                      </p>
                      <p className="text-[11px] text-[#10b981] font-bold mt-0.5">
                        {(xlsxFile.size / 1024).toFixed(1)} KB · READY
                      </p>
                    </div>
                    <span className="text-xs text-white hover:underline font-bold block pt-1">
                      Change Excel file
                    </span>
                  </div>
                ) : (
                  <div className="text-center space-y-2.5 py-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.08] text-white flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors">
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-white">
                        Choose DCS IO List (.xlsx)
                      </p>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
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
            <div className="flex items-center gap-3 p-4 rounded-xl bg-[#eb1000]/15 border border-[#eb1000]/30 text-white text-xs font-bold">
              <AlertTriangle size={18} className="shrink-0 text-[#eb1000]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Clean Action Buttons (Adobe Pill Buttons) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-white/[0.1]">
            <Button
              type="button"
              onClick={loadSampleFiles}
              disabled={isSubmitting}
              variant="secondary"
              size="md"
              className="w-full sm:w-auto"
            >
              <Sparkles size={14} className="text-[#eb1000]" />
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
      </Card>

    </div>
  );
};
