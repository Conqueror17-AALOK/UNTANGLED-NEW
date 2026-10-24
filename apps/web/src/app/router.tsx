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
    <div className="relative min-h-screen flex flex-col bg-[#030712] text-[#f8fafc] antialiased overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Radiant Ambient Aurora Canvas for True Optical Glassmorphism */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none transform-gpu">
        {/* Deep space radial mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-15%,rgba(20,38,80,0.65),rgba(3,7,18,1))]" />
        
        {/* Electric Cyan & Teal Core Aurora */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-cyan-400/[0.24] via-teal-500/[0.16] to-transparent rounded-full blur-[100px] transform-gpu" />
        
        {/* Deep Royal Indigo / Sapphire Atmospheric Glow */}
        <div className="absolute top-[22%] -left-36 w-[700px] h-[500px] bg-gradient-to-tr from-indigo-600/[0.22] via-blue-600/[0.18] to-transparent rounded-full blur-[110px] transform-gpu" />
        
        {/* Celestial Violet / Purple Aurora */}
        <div className="absolute top-[38%] -right-36 w-[700px] h-[520px] bg-gradient-to-bl from-purple-600/[0.20] via-violet-500/[0.14] to-transparent rounded-full blur-[110px] transform-gpu" />
        
        {/* Process Emerald / Seafoam Floor Aurora */}
        <div className="absolute -bottom-36 left-1/3 w-[900px] h-[500px] bg-gradient-to-t from-emerald-500/[0.16] via-teal-500/[0.12] to-transparent rounded-full blur-[100px] transform-gpu" />
        
        {/* Micro CAD Technical Grid */}
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

        <footer className="border-t border-white/[0.08] py-4 bg-[#030712]/60 backdrop-blur-2xl text-[11px] text-[#64748b] font-mono">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <img src="/logo-mark.png" alt="UNTANGLED" className="w-4 h-4 object-contain opacity-75 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
              <span className="text-[#94a3b8] font-semibold">UNTANGLED PLATFORM</span>
              <span className="hidden sm:inline text-white/20">•</span>
              <span className="hidden sm:inline">ISA-5.1 COMPLIANT</span>
              <span className="hidden sm:inline text-white/20">•</span>
              <span className="hidden sm:inline">DCS CROSS-VALIDATION GATEWAY</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">ENGINE v1.0 ONLINE</span>
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
