import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { UploadPage } from '../pages/UploadPage';
import { JobPage } from '../pages/JobPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ReviewPage } from '../pages/ReviewPage';
import { ReportPage } from '../pages/ReportPage';
import { Navbar } from '../components/layout/Navbar';
import { UntangledLogo } from '../components/layout/UntangledLogo';

export const AppRouter: React.FC = () => {
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/workspace');

  return (
    <div className={`relative ${isWorkspace ? 'h-screen overflow-hidden' : 'min-h-screen'} flex flex-col bg-[#282b33] text-[#e2e8f0] antialiased selection:bg-blue-500/30 selection:text-white font-normal`}>
      {/* Matte Architectural Background Canvas with Ambient Glassmorphism Light Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#30343e] via-[#282b33] to-[#24272f]" />
        {/* Soft Ambient Refraction Glows that shine subtly through frosted glass */}
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute top-[35%] right-[-5%] w-[600px] h-[600px] rounded-full bg-indigo-500/8 blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-adobe-grid opacity-25" />
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
          <footer className="border-t border-white/[0.08] py-3 bg-[#24272f]/70 backdrop-blur-md text-xs text-slate-400 font-normal">
            <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <UntangledLogo size="sm" showText={true} />
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-slate-400 hidden sm:inline">ISA-5.1 Deterministic Verification</span>
                <span className="text-slate-600 hidden md:inline">•</span>
                <span className="text-slate-400 hidden md:inline">DCS Cross-Validation</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
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
