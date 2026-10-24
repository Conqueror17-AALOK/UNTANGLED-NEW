import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UploadCloud,
  Workflow,
  Cpu,
  CheckCircle2,
  FileSpreadsheet,
  Keyboard,
  X,
  Menu,
  Server,
  Activity,
  Database,
  HardDrive
} from 'lucide-react';
import { UntangledLogo } from './UntangledLogo';
import { Modal } from '../ui/Modal';
import { apiClient } from '../../api/client';

interface SidebarProps {
  currentJobId?: string;
}

interface SystemHealth {
  status: string;
  version: string;
  checks?: Record<string, string>;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentJobId = 'demo-job-1' }) => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealth>({ status: 'ok', version: '1.0.0' });

  useEffect(() => {
    let isMounted = true;
    apiClient.getHealth().then((h) => {
      if (isMounted) setHealth(h);
    }).catch(() => {
      if (isMounted) setHealth({ status: 'offline', version: '1.0.0' });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navItems = [
    {
      step: '1',
      label: 'Upload',
      fullLabel: '1. Ingestion & Upload',
      sublabel: 'PDF & DCS Schedule',
      path: '/',
      icon: UploadCloud,
    },
    {
      step: '2',
      label: 'Pipeline',
      fullLabel: '2. Pipeline Execution',
      sublabel: '9-Stage Perception',
      path: `/jobs/${currentJobId}`,
      icon: Workflow,
    },
    {
      step: '3',
      label: 'Process Sketch',
      fullLabel: '3. Process Sketch',
      sublabel: 'Interactive CAD Canvas',
      path: `/workspace/${currentJobId}`,
      icon: Cpu,
    },
    {
      step: '4',
      label: 'Review Queue',
      fullLabel: '4. Review Queue',
      sublabel: 'Confidence & Tag Audit',
      path: `/review/${currentJobId}`,
      icon: CheckCircle2,
    },
    {
      step: '5',
      label: 'Audit Report',
      fullLabel: '5. Audit Report',
      sublabel: 'Cross-Validation Audit',
      path: `/report/${currentJobId}`,
      icon: FileSpreadsheet,
    },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const isOnline = health.status === 'ok';

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full space-y-6">
      {/* Top Brand Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.1]">
          <Link to="/" className="group block" title="METAWIZ UNTANGLED Platform">
            <UntangledLogo size="md" showText={true} stacked={true} />
          </Link>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08]"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <div className="space-y-1.5">
          <div className="px-3 pb-1 text-[10px] font-semibold tracking-wider uppercase text-slate-400 font-mono">
            Workflow Pipeline
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.label}
                  to={item.path}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                    active
                      ? 'bg-white/[0.14] backdrop-blur-md text-white font-medium border border-white/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_16px_rgba(0,0,0,0.25)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.05] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        active
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-white/[0.04] text-slate-400 group-hover:text-slate-200 group-hover:bg-white/[0.08]'
                      }`}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`truncate text-xs ${active ? 'font-semibold text-white' : 'font-medium'}`}>
                        {item.fullLabel}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal truncate">
                        {item.sublabel}
                      </span>
                    </div>
                  </div>

                  {active && (
                    <span className="w-1.5 h-4 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(56,189,248,0.8)] shrink-0" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Telemetry & Utilities Section */}
      <div className="space-y-3 pt-4 border-t border-white/[0.1]">
        {/* System Engine Health Card (Clickable for Telemetry) */}
        <button
          onClick={() => setStatusModalOpen(true)}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md border border-white/[0.1] text-xs transition-all text-left group"
          title="View Engine Subsystems Health"
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
              }`}
            />
            <div className="flex flex-col leading-none">
              <span className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                {isOnline ? 'FastAPI Gateway' : 'Standalone Demo'}
              </span>
              <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                Engine Status: {isOnline ? 'Active' : 'Offline'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
            v{health.version || '1.0.0'}
          </span>
        </button>

        {/* Shortcuts & Verification Tag */}
        <div className="flex items-center justify-between px-1 text-xs text-slate-400">
          <button
            onClick={() => setShortcutsOpen(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-1"
          >
            <Keyboard size={13} />
            <span>Shortcuts</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[9px] font-mono border border-white/[0.1]">?</kbd>
          </button>
          <span className="text-[10px] font-mono text-slate-500">
            ISA-5.1 Standard
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header (Only on small screens where sidebar is hidden) */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#24272f]/90 backdrop-blur-xl border-b border-white/[0.1] h-14 px-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <UntangledLogo size="sm" />
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg bg-white/[0.06] border border-white/[0.1] text-slate-200"
          aria-label="Open sidebar navigation"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* Mobile Slide-Out Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-[#24272f] border-r border-white/[0.12] p-5 shadow-2xl z-10 animate-fade-in">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Persistent Left Sidebar (No upper line navigation!) */}
      <aside className="hidden lg:flex w-64 xl:w-72 h-screen shrink-0 border-r border-white/[0.1] bg-[#24272f]/80 backdrop-blur-2xl flex-col p-5 z-30 select-none shadow-xl">
        {sidebarContent}
      </aside>

      {/* Interactive Telemetry Modal */}
      <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="METAWIZ UNTANGLED Engine Telemetry">
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-500'}`} />
              <div>
                <p className="font-semibold text-white text-sm">
                  {isOnline ? 'FastAPI Gateway Connected' : 'Standalone Demo Mode'}
                </p>
                <p className="text-xs text-slate-400 font-normal">
                  {isOnline ? 'Live cross-validation pipeline active' : 'Offline fixtures running in browser'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-medium bg-white/10 text-white border border-white/10">
              v{health.version || '1.0.0'}
            </span>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Server size={14} className="text-cyan-400" />
              Subsystem Health Diagnostics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <Database size={14} /> Database:
                </span>
                <span className="text-emerald-400 font-medium">{health.checks?.database || 'Healthy (SQLite)'}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <HardDrive size={14} /> Storage:
                </span>
                <span className="text-emerald-400 font-medium">{health.checks?.storage || 'Healthy'}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <Cpu size={14} /> OCR Engine:
                </span>
                <span className="text-emerald-400 font-medium">Tesseract + PyMuPDF</span>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <Activity size={14} /> LLM Resolver:
                </span>
                <span className="text-slate-100 font-medium truncate max-w-[130px]" title={health.checks?.llm || 'NeMoTron & Heuristic'}>
                  NeMoTron / Rule
                </span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Keyboard Shortcuts Modal */}
      <Modal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="Keyboard Shortcuts & Reference">
        <div className="space-y-4 text-xs text-slate-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
              <span>Toggle Shortcuts</span>
              <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-white text-[11px]">?</kbd>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
              <span>Zoom In Canvas</span>
              <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-white text-[11px]">+</kbd>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
              <span>Zoom Out Canvas</span>
              <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-white text-[11px]">-</kbd>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
              <span>Reset Viewport</span>
              <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-white text-[11px]">0</kbd>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};
