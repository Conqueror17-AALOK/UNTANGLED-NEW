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
    <div className="min-h-screen flex flex-col bg-[#090a0f] text-[#f1f5f9] antialiased">
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

      <footer className="border-t border-[#1e222d] py-4 bg-[#090a0f] text-[11px] text-[#64748b] font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-[#94a3b8] font-semibold">UNTANGLE INDUSTRIAL ENGINE</span>
            <span>•</span>
            <span>ISA-5.1-2009 SPECIFICATION</span>
            <span>•</span>
            <span>IEC 62443 COMPLIANT PIPELINE</span>
          </div>
          <div>
            <span>DCS CROSS-VALIDATION GATEWAY</span>
          </div>
        </div>
      </footer>
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
