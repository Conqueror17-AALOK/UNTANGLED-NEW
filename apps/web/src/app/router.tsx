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
    <div className="relative min-h-screen flex flex-col bg-[#07090e] text-[#f1f5f9] antialiased overflow-x-hidden">
      {/* Ambient background mesh lighting for genuine glassmorphism refraction */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-cyan-500/[0.09] rounded-full blur-[140px]" />
        <div className="absolute top-[25%] -left-40 w-[600px] h-[400px] bg-blue-600/[0.07] rounded-full blur-[160px]" />
        <div className="absolute top-[45%] -right-40 w-[600px] h-[400px] bg-indigo-600/[0.06] rounded-full blur-[160px]" />
        <div className="absolute -bottom-40 left-1/3 w-[700px] h-[400px] bg-emerald-500/[0.05] rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-cad-grid opacity-25" />
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

        <footer className="border-t border-white/[0.08] py-4 bg-[#07090e]/80 backdrop-blur-xl text-[11px] text-[#64748b] font-mono">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <img src="/logo-mark.png" alt="UNTANGLED" className="w-4 h-4 object-contain opacity-70" />
              <span className="text-[#94a3b8] font-semibold">UNTANGLED PLATFORM</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">ISA-5.1 SPECIFICATION</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">CROSS-VALIDATION ENGINE</span>
            </div>
            <div>
              <span>DCS VERIFICATION GATEWAY</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// Reactively passes current active jobId from URL pathname
const NavbarWithJobId: React.FC = () => {
  const location = useLocation();
  const match = location.pathname.match(/\/(?:jobs|workspace|review|report)\/([^/]+)/);
  const activeJobId = match ? match[1] : 'demo-job-1';
  return <Navbar currentJobId={activeJobId} />;
};
