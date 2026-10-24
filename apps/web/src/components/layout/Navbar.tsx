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
      <header className="sticky top-0 z-40 bg-[#000000]/95 backdrop-blur-md border-b border-white/[0.1] h-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            
            {/* Brand Logo - UNTANGLED (Adobe Clean Typography) */}
            <Link to="/" className="flex items-center gap-3 group shrink-0" title="UNTANGLED Platform">
              <div className="flex items-center justify-center">
                <img
                  src="/logo-mark.png"
                  alt="UNTANGLED Logo"
                  className="w-8 h-8 object-contain transition-transform group-hover:scale-105"
                />
              </div>
              <span className="text-xl font-heading font-black tracking-tight text-white">
                UNTANGLED
              </span>
            </Link>

            {/* Desktop Navigation - Adobe Docked Selector Strip */}
            <nav className="hidden md:flex items-center gap-1 bg-[#141414] p-1 rounded-full border border-white/[0.12] mx-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-150 ${
                      active
                        ? 'bg-[#ffffff] text-[#000000] font-black shadow-sm'
                        : 'text-[#9ca3af] hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-black' : 'text-[#9ca3af]'} />
                    <span className="lg:hidden">{item.label}</span>
                    <span className="hidden lg:inline">{item.fullLabel}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Controls: Hotkeys & Mobile Toggle */}
            <div className="flex items-center gap-2.5 shrink-0">

              {/* Hotkeys (?) Button */}
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setShortcutsOpen(true)}
                className="hidden sm:flex items-center gap-1.5 text-xs text-white"
                title="Keyboard Shortcuts & Reference (?)"
              >
                <Keyboard size={13} />
                <span className="hidden lg:inline">Hotkeys</span>
                <kbd className="px-1.5 py-0.2 rounded bg-white/20 text-[10px] font-mono font-bold">?</kbd>
              </Button>

              {/* Mobile Hamburger Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-white p-2 rounded-full bg-[#141414] border border-white/[0.12]"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/[0.12] bg-[#0d0d0d] px-4 py-3 space-y-1 animate-fade-in">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-bold transition-colors ${
                    active
                      ? 'bg-white text-black font-extrabold'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-black' : 'text-slate-400'} />
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
                className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white py-1"
              >
                <Activity size={14} className="text-[#eb1000]" />
                <span>View Engine Status</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShortcutsOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white py-1"
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
          <div className="p-4 rounded-xl bg-[#1a1a1a] border border-white/[0.1] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-[#10b981]' : 'bg-[#eb1000]'}`} />
              <div>
                <p className="font-extrabold text-white text-sm">
                  {isOnline ? 'FastAPI Gateway Connected' : 'Standalone Demo Mode'}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  {isOnline ? 'Live cross-validation pipeline active' : 'Offline fixtures running in browser'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-white/10 text-white border border-white/10">
              v{health.version || '1.0.0'}
            </span>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Server size={14} className="text-[#eb1000]" />
              Subsystem Health Diagnostics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-bold">
                  <Database size={14} /> Database:
                </span>
                <span className="text-[#10b981] font-bold">{health.checks?.database || 'Healthy (SQLite)'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-bold">
                  <HardDrive size={14} /> Storage:
                </span>
                <span className="text-[#10b981] font-bold">{health.checks?.storage || 'Healthy'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-bold">
                  <Cpu size={14} /> OCR Engine:
                </span>
                <span className="text-[#10b981] font-bold">Tesseract + PyMuPDF</span>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-400 font-bold">
                  <Activity size={14} /> LLM Resolver:
                </span>
                <span className="text-white font-bold truncate max-w-[130px]" title={health.checks?.llm || 'NeMoTron & Heuristic'}>
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
          <div className="p-4 rounded-xl bg-[#1a1a1a] border border-white/[0.1] space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-white">
              <CheckCheck size={16} className="text-[#eb1000]" />
              <span>Multi-Signal Verification Protocol</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300 font-medium">
              UNTANGLED automatically cross-references physical P&ID blueprints against engineering DCS IO lists using visual OCR voting, OpenCV symbol correlation, RapidFuzz candidate indexing, and ISA-5.1 grammar parsing.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Keyboard size={14} />
              Canvas & Review Hotkeys
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex justify-between items-center">
                <span className="text-slate-300 font-bold">Toggle Shortcuts</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.15] text-white font-bold">?</kbd>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex justify-between items-center">
                <span className="text-slate-300 font-bold">Zoom In / Out</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.15] text-white font-bold">+ / -</kbd>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex justify-between items-center">
                <span className="text-slate-300 font-bold">Reset Viewport</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.15] text-white font-bold">0</kbd>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex justify-between items-center">
                <span className="text-slate-300 font-bold">Compare Split</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.15] text-white font-bold">b</kbd>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex justify-between items-center">
                <span className="text-slate-300 font-bold">Rebuild Graph</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.15] text-white font-bold">r</kbd>
              </div>
              <div className="p-3 rounded-xl bg-[#141414] border border-white/[0.08] flex justify-between items-center">
                <span className="text-slate-300 font-bold">Close Active View</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.15] text-white font-bold">Esc</kbd>
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
