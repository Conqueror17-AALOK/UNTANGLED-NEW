import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { UploadPage } from '../pages/UploadPage';
import { JobPage } from '../pages/JobPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ReviewPage } from '../pages/ReviewPage';
import { ReportPage } from '../pages/ReportPage';
import { Sidebar } from '../components/layout/Sidebar';

export const AppRouter: React.FC = () => {
  const location = useLocation();
  const match = location.pathname.match(/\/(jobs|workspace|review|report)\/([^/]+)/);
  const storedJobId = typeof window !== 'undefined' ? localStorage.getItem('untangled_active_job_id') : null;
  const currentJobId = match ? match[2] : (storedJobId || 'demo-job-1');

  return (
    <div className="relative h-screen w-screen overflow-hidden flex bg-[#282b33] text-[#e2e8f0] antialiased selection:bg-blue-500/30 selection:text-white font-normal">
      {/* Matte Architectural Background Canvas with Ambient Glassmorphism Light Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#30343e] via-[#282b33] to-[#24272f]" />
        {/* Soft Ambient Refraction Glows that shine subtly through frosted glass */}
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute top-[35%] right-[-5%] w-[600px] h-[600px] rounded-full bg-indigo-500/8 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-adobe-grid opacity-25" />
      </div>

      {/* Main Application Flex Shell: Left Sidebar + Right Main Workspace */}
      <div className="relative z-10 flex flex-col lg:flex-row w-full h-full overflow-hidden">
        {/* Persistent Left Sidebar (replaces the upper line navbar) */}
        <Sidebar currentJobId={currentJobId} />

        {/* Right Main Content Area - Expands to fill screen */}
        <main className="flex-1 h-full min-h-0 overflow-y-auto flex flex-col">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/jobs" element={<JobPage />} />
            <Route path="/jobs/:jobId" element={<JobPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/workspace/:jobId" element={<WorkspacePage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/review/:jobId" element={<ReviewPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/report/:jobId" element={<ReportPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};
