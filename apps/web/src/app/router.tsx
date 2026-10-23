import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { UploadPage } from '../pages/UploadPage';
import { JobPage } from '../pages/JobPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ReviewPage } from '../pages/ReviewPage';
import { ReportPage } from '../pages/ReportPage';
import { Navbar } from '../components/layout/Navbar';

export const AppRouter: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-industrial-950 text-slate-100">
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

      <footer className="border-t border-industrial-800/80 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>UNTANGLE Industrial P&ID Verification Engine</span>
          <span>Built for Trust, Reliability, and Real Engineering Audits</span>
        </div>
      </footer>
    </div>
  );
};

// Helper to pass current active jobId to Navbar
const NavbarWithJobId: React.FC = () => {
  const pathname = window.location.pathname;
  const match = pathname.match(/\/(?:jobs|workspace|review|report)\/([^/]+)/);
  const activeJobId = match ? match[1] : 'demo-job-1';
  return <Navbar currentJobId={activeJobId} />;
};
