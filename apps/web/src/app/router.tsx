import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { UploadPage } from '../pages/UploadPage';
import { JobPage } from '../pages/JobPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ReviewPage } from '../pages/ReviewPage';
import { ReportPage } from '../pages/ReportPage';
import { Navbar } from '../components/layout/Navbar';

export const AppRouter: React.FC = () => {
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/workspace');

  return (
    <div className={`relative ${isWorkspace ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col bg-[#282b33] text-[#e2e8f0] antialiased selection:bg-blue-500/30 selection:text-white font-normal`}>
      {/* Matte Architectural Background Canvas */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#30343e] via-[#282b33] to-[#24272f]" />
        <div className="absolute inset-0 bg-adobe-grid opacity-20" />
      </div>

      <div className={`relative z-10 flex flex-col ${isWorkspace ? 'h-full overflow-hidden' : 'min-h-screen'}`}>
        <NavbarWithJobId />
        <main className={`flex-1 ${isWorkspace ? 'h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-hidden' : ''}`}>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/jobs/:jobId" element={<JobPage />} />
            <Route path="/workspace/:jobId" element={<WorkspacePage />} />
            <Route path="/review/:jobId" element={<ReviewPage />} />
            <Route path="/report/:jobId" element={<ReportPage />} />
          </Routes>
        </main>

        {!isWorkspace && (
          <footer className="border-t border-[#434856] py-3.5 bg-[#24272f] text-xs text-slate-400 font-normal">
            <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/logo-mark.png" alt="UNTANGLED" className="w-4 h-4 object-contain opacity-80" />
                <span className="text-slate-200 font-medium">UNTANGLED</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">ISA-5.1 Deterministic Verification</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">DCS Cross-Validation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-slate-300 font-mono text-[11px]">System Ready</span>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

const NavbarWithJobId: React.FC = () => {
  const location = useLocation();
  const match = location.pathname.match(/\/(jobs|workspace|review|report)\/([^/]+)/);
  const currentJobId = match ? match[2] : 'demo-job-1';
  return <Navbar currentJobId={currentJobId} />;
};
