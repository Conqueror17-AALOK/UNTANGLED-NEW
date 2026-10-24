import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  UploadCloud,
  Cpu,
  Workflow,
  CheckCircle2,
  FileSpreadsheet,
  Menu,
  X,
  Keyboard,
  CheckCheck,
  Server,
  Activity,
  HardDrive,
  Database
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { UntangledLogo } from './UntangledLogo';
import { apiClient } from '../../api/client';

interface NavbarProps {
  currentJobId?: string;
}

interface SystemHealth {
  status: string;
  version: string;
  checks?: Record<string, string>;
}

export const Navbar: React.FC<NavbarProps> = ({ currentJobId = 'demo-job-1' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealth>({ status: 'checking', version: '1.0.0' });
  const location = useLocation();

  const navItems = [
    { label: 'Upload', fullLabel: 'Upload', path: '/', icon: UploadCloud },
    { label: 'Pipeline', fullLabel: 'Pipeline', path: `/jobs/${currentJobId}`, icon: Cpu },
    { label: 'Sketch', fullLabel: 'Process Sketch', path: `/workspace/${currentJobId}`, icon: Workflow },
    { label: 'Review', fullLabel: 'Review Queue', path: `/review/${currentJobId}`, icon: CheckCircle2 },
    { label: 'Report', fullLabel: 'Audit Report', path: `/report/${currentJobId}`, icon: FileSpreadsheet },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  useEffect(() => {
    let mounted = true;
    const checkHealth = async () => {
      try {
        const data = await apiClient.getHealth();
        if (mounted) setHealth(data);
      } catch {
        if (mounted) setHealth({ status: 'offline', version: '1.0.0' });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isOnline = health.status === 'ok';

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#282b33]/70 backdrop-blur-xl border-b border-white/[0.1] shadow-sm h-14 sm:h-16 transition-colors">
        <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            
            {/* Brand Logo - METAWIZ UNTANGLED Glassmorphic Vector */}
            <Link to="/" className="group shrink-0" title="METAWIZ UNTANGLED Platform">
              <UntangledLogo size="md" showText={true} />
            </Link>

            {/* Desktop Navigation - Docked Frosted Glass Strip */}
            <nav className="hidden md:flex items-center gap-1 bg-white/[0.04] backdrop-blur-md p-1 rounded-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] mx-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                      active
                        ? 'bg-white/[0.15] backdrop-blur-md text-white font-medium shadow-sm border border-white/[0.2]'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-cyan-400' : 'text-slate-400'} />
                    <span className="lg:hidden">{item.label}</span>
                    <span className="hidden lg:inline">{item.fullLabel}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Controls: Hotkeys & Mobile Toggle */}
            <div className="flex items-center gap-2.5 shrink-0">

              {/* Hotkeys (?) Button with Glassmorphism */}
              <button
                onClick={() => setShortcutsOpen(true)}
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.09] backdrop-blur-md transition-all shadow-sm"
                title="Keyboard Shortcuts & Reference (?)"
              >
                <Keyboard size={13} />
                <span className="hidden lg:inline">Hotkeys</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono">?</kbd>
              </button>

              {/* Mobile Hamburger Toggle with Glassmorphism */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-slate-200 p-2 rounded-lg bg-white/[0.05] border border-white/[0.12] backdrop-blur-md"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/[0.12] bg-[#282b33]/90 backdrop-blur-2xl px-4 py-3 space-y-1 animate-fade-in shadow-xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/[0.15] text-white font-medium border border-white/[0.2]'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-cyan-400' : 'text-slate-400'} />
                  <span>{item.fullLabel}</span>
                </Link>
              );
            })}

            <div className="pt-3 border-t border-white/[0.1] flex items-center justify-between">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setStatusModalOpen(true);
                }}
                className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white py-1"
              >
                <Activity size={14} className="text-blue-400" />
                <span>View Engine Status</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShortcutsOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white py-1"
              >
                <Keyboard size={14} />
                <span>Shortcuts (?)</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Interactive System Status Modal */}
      <Modal isOpen={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="System Engine Telemetry & Status">
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-lg bg-[#24272f] border border-[#434856] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
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
              <Server size={14} className="text-blue-400" />
              Subsystem Health Diagnostics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <Database size={14} /> Database:
                </span>
                <span className="text-emerald-400 font-medium">{health.checks?.database || 'Healthy (SQLite)'}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <HardDrive size={14} /> Storage:
                </span>
                <span className="text-emerald-400 font-medium">{health.checks?.storage || 'Healthy'}</span>
              </div>
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <Cpu size={14} /> OCR Engine:
                </span>
                <span className="text-emerald-400 font-medium">Tesseract + PyMuPDF</span>
              </div>
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-medium">
                  <Activity size={14} /> LLM Resolver:
                </span>
                <span className="text-slate-100 font-medium truncate max-w-[130px]" title={health.checks?.llm || 'NeMoTron & Heuristic'}>
                  NeMoTron / Rule
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setStatusModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Keyboard Shortcuts Modal */}
      <Modal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="System Hotkeys & Operations Guide">
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-lg bg-[#24272f] border border-[#434856] space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCheck size={16} className="text-blue-400" />
              <span>Multi-Signal Verification Protocol</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300 font-normal">
              METAWIZ UNTANGLED automatically cross-references physical P&ID blueprints against engineering DCS IO lists using visual OCR voting, OpenCV symbol correlation, RapidFuzz candidate indexing, and ISA-5.1 grammar parsing.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Keyboard size={14} />
              Canvas & Review Hotkeys
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex justify-between items-center">
                <span className="text-slate-300 font-medium">Toggle Shortcuts</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.12] text-white font-medium">?</kbd>
              </div>
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex justify-between items-center">
                <span className="text-slate-300 font-medium">Zoom In / Out</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.12] text-white font-medium">+ / -</kbd>
              </div>
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex justify-between items-center">
                <span className="text-slate-300 font-medium">Reset Viewport</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.12] text-white font-medium">0</kbd>
              </div>
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex justify-between items-center">
                <span className="text-slate-300 font-medium">Compare Split</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.12] text-white font-medium">b</kbd>
              </div>
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex justify-between items-center">
                <span className="text-slate-300 font-medium">Rebuild Graph</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.12] text-white font-medium">r</kbd>
              </div>
              <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex justify-between items-center">
                <span className="text-slate-300 font-medium">Close Active View</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.12] text-white font-medium">Esc</kbd>
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setShortcutsOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
