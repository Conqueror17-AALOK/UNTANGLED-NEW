import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { UploadPage } from '../pages/UploadPage';
import { JobPage } from '../pages/JobPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ReviewPage } from '../pages/ReviewPage';
import { ReportPage } from '../pages/ReportPage';
import { Navbar } from '../components/layout/Navbar';

export const AppRouter: React.FC = () => {
  return (
    <div className="relative min-h-screen flex flex-col bg-[#181a1f] text-[#e5e7eb] antialiased overflow-x-hidden selection:bg-blue-500/25 selection:text-white font-normal">
      {/* Matte Architectural Background Canvas */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1c1e24] via-[#181a1f] to-[#15161a]" />
        <div className="absolute inset-0 bg-adobe-grid opacity-15" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <NavbarWithJobId />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/jobs/:jobId" element={<JobPage />} />
            <Route path="/workspace/:jobId" element={<WorkspacePage />} />
            <Route path="/review/:jobId" element={<ReviewPage />} />
            <Route path="/report/:jobId" element={<ReportPage />} />
          </Routes>
        </main>

        <footer className="border-t border-[#2d313a] py-5 bg-[#16171c] text-xs text-neutral-400 font-normal">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo-mark.png" alt="UNTANGLED" className="w-4 h-4 object-contain opacity-80" />
              <span className="text-neutral-200 font-medium">UNTANGLED</span>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-400">ISA-5.1 Deterministic Verification</span>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-400">DCS Cross-Validation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-neutral-300 font-mono text-[11px]">System Ready</span>
            </div>
          </div>
        </footer>
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
