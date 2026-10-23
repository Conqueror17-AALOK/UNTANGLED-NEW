import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
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
      setErrorMsg('Expected application/pdf for P&ID drawing.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('PDF file exceeds 50MB maximum size limit.');
      return;
    }
    setPdfFile(file);
  };

  const handleXlsxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setErrorMsg('Expected Excel (.xlsx) file for IO List.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Excel file exceeds 10MB maximum size limit.');
      return;
    }
    setXlsxFile(file);
  };

  const loadSampleFiles = () => {
    setErrorMsg(null);
    const fakePdf = new File(['%PDF-1.4 sample content'], 'sample_pid_01.pdf', { type: 'application/pdf' });
    const fakeXlsx = new File(['fake xlsx content'], 'sample_io_list.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    setPdfFile(fakePdf);
    setXlsxFile(fakeXlsx);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile || !xlsxFile) {
      setErrorMsg('Please upload both the P&ID drawing (PDF) and the IO List (XLSX).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.createJob(pdfFile, xlsxFile);
      navigate(`/jobs/${res.job_id}`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error?.message || 'Failed to submit files for processing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
          <Sparkles size={13} />
          <span>Win on Trust, Not Feature Count</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-100">
          Untangle Cluttered P&IDs in Seconds
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Upload your industrial engineering drawing and DCS IO List. Our pipeline performs multi-signal OCR,
          template matching, cross-validation, and synthesizes a verified, interactive process sketch.
        </p>
      </div>

      {/* Main Upload Card */}
      <Card className="border-industrial-700/80 shadow-2xl relative overflow-hidden">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Dropzone 1: P&ID PDF */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>1. P&ID Blueprint (PDF)</span>
                <span className="text-slate-500 font-mono text-[11px]">Max 50MB</span>
              </label>

              <label
                htmlFor="pdf-upload"
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  pdfFile
                    ? 'border-cyan-500/60 bg-cyan-500/5'
                    : 'border-industrial-700 hover:border-slate-500 bg-industrial-950/40 hover:bg-industrial-900/60'
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
                    <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{pdfFile.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <span className="text-[11px] text-cyan-400 underline">Click to replace</span>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-industrial-800 text-slate-400 flex items-center justify-center">
                      <UploadCloud size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">Drop PDF drawing here</p>
                      <p className="text-xs text-slate-500">Supports vector & scanned sheets</p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Dropzone 2: IO List XLSX */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>2. DCS IO List (Excel)</span>
                <span className="text-slate-500 font-mono text-[11px]">Max 10MB</span>
              </label>

              <label
                htmlFor="xlsx-upload"
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                  xlsxFile
                    ? 'border-emerald-500/60 bg-emerald-500/5'
                    : 'border-industrial-700 hover:border-slate-500 bg-industrial-950/40 hover:bg-industrial-900/60'
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
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200 truncate max-w-[200px]">{xlsxFile.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{(xlsxFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <span className="text-[11px] text-emerald-400 underline">Click to replace</span>
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-industrial-800 text-slate-400 flex items-center justify-center">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">Drop IO List (.xlsx) here</p>
                      <p className="text-xs text-slate-500">Tag, signal type & ranges</p>
                    </div>
                  </div>
                )}
              </label>
            </div>

          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-industrial-800">
            <button
              type="button"
              onClick={loadSampleFiles}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 underline underline-offset-4"
            >
              <Sparkles size={14} />
              Load Demo Files (sample_pid_01.pdf & sample_io_list.xlsx)
            </button>

            <Button
              type="submit"
              size="lg"
              variant="primary"
              isLoading={isSubmitting}
              disabled={!pdfFile || !xlsxFile}
              className="w-full sm:w-auto"
            >
              <span>Analyze & Untangle</span>
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      </Card>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        <div className="p-4 rounded-xl bg-industrial-900/50 border border-industrial-800/80">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-2">
            <ShieldCheck size={18} />
          </div>
          <h4 className="text-xs font-semibold text-slate-200">Cross-Validation</h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Every drawing tag is verified against DCS points to detect missing transmitters or phantom valves.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-industrial-900/50 border border-industrial-800/80">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2">
            <span className="font-mono font-bold text-xs">93%</span>
          </div>
          <h4 className="text-xs font-semibold text-slate-200">Multi-Signal Confidence</h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Transparently weighted scores combining OCR certainty, template IoU, and ISA-5.1 grammar rules.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-industrial-900/50 border border-industrial-800/80">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
            <CheckCircle2 size={18} />
          </div>
          <h4 className="text-xs font-semibold text-slate-200">Human In The Loop</h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Instant correction of ambiguous reads with high-res source crop preview and fast sub-second rebuild.
          </p>
        </div>
      </div>
    </div>
  );
};
