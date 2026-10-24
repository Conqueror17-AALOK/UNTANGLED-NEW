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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8 animate-fade-in">
      
      {/* Minimal Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-white">
          P&ID Cross-Validation
        </h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Upload your engineering drawing and DCS schedule to detect discrepancies and generate simplified topology.
        </p>
      </div>

      {/* Main Upload Card */}
      <Card variant="glass" className="p-6 sm:p-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Target 1: P&ID Drawing Blueprint */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileCode2 size={15} className="text-cyan-400" />
                  <span>P&ID Drawing (PDF)</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">Max 50MB</span>
              </label>

              <label
                htmlFor="pdf-upload"
                className={`group relative flex flex-col items-center justify-center p-8 rounded-xl border border-dashed cursor-pointer transition-all duration-200 ${
                  pdfFile
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-industrial-700/80 hover:border-cyan-500/60 bg-industrial-950/60 hover:bg-industrial-900/60'
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
                    <div className="w-10 h-10 mx-auto rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-medium text-slate-200 truncate max-w-[220px]">
                        {pdfFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {(pdfFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <span className="text-[11px] text-cyan-400 hover:underline">Change file</span>
                  </div>
                ) : (
                  <div className="text-center space-y-2 py-2">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-industrial-900 text-slate-400 group-hover:text-cyan-400 flex items-center justify-center transition-colors">
                      <UploadCloud size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">
                        Choose P&ID file
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">or drag and drop here</p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Target 2: DCS IO List Register */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet size={15} className="text-emerald-400" />
                  <span>DCS IO List (Excel)</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">Max 10MB</span>
              </label>

              <label
                htmlFor="xlsx-upload"
                className={`group relative flex flex-col items-center justify-center p-8 rounded-xl border border-dashed cursor-pointer transition-all duration-200 ${
                  xlsxFile
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-industrial-700/80 hover:border-emerald-500/60 bg-industrial-950/60 hover:bg-industrial-900/60'
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
                    <div className="w-10 h-10 mx-auto rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-mono font-medium text-slate-200 truncate max-w-[220px]">
                        {xlsxFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {(xlsxFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <span className="text-[11px] text-cyan-400 hover:underline">Change file</span>
                  </div>
                ) : (
                  <div className="text-center space-y-2 py-2">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-industrial-900 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center transition-colors">
                      <UploadCloud size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">
                        Choose IO List file
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">or drag and drop here</p>
                    </div>
                  </div>
                )}
              </label>
            </div>

          </div>

          {/* Validation Error Alert */}
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-xs font-mono">
              <AlertTriangle size={15} className="shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Clean Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-industrial-800">
            <Button
              type="button"
              onClick={loadSampleFiles}
              disabled={isSubmitting}
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto text-xs text-slate-400 hover:text-white flex items-center gap-1.5"
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
              className="w-full sm:w-auto text-xs flex items-center justify-center gap-2"
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

