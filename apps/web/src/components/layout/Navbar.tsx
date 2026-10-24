import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Layers,
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

  // Poll system health on mount and periodically
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

  // Keyboard shortcut listener: '?' opens shortcuts modal
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
      <header className="sticky top-0 z-40 bg-industrial-950/90 backdrop-blur-md border-b border-industrial-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-15">
            
            {/* Brand Logo - Clean, Modern & Confident */}
            <Link to="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <Layers size={18} className="stroke-[2.2]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-100 font-sans">
                  UNTANGLE
                </span>
                <span className="hidden sm:inline text-[11px] font-mono text-cyan-400/80 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                  P&ID AI
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Tabs - Responsive with adaptive labels */}
            <nav className="hidden md:flex items-center gap-1 bg-industrial-900/90 p-1 rounded-xl border border-industrial-800/80 mx-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-industrial-800 text-cyan-400 font-semibold shadow-sm border border-cyan-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-industrial-800/50'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-cyan-400' : 'text-slate-400'} />
                    <span className="lg:hidden">{item.label}</span>
                    <span className="hidden lg:inline">{item.fullLabel}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Controls: Interactive Live Status & Hotkeys */}
            <div className="flex items-center gap-2 shrink-0">
              
              {/* Interactive System Health Badge (Replaces confusing static text) */}
              <button
                type="button"
                onClick={() => setStatusModalOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono transition-all border cursor-pointer ${
                  isOnline
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
                }`}
                title="Click to view live system engine telemetry"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'
                  }`}
                />
                <span className="hidden sm:inline">
                  {isOnline ? 'Engine Online' : 'Demo Mode'}
                </span>
                <span className="sm:hidden">
                  {isOnline ? 'Online' : 'Demo'}
                </span>
              </button>

              {/* Hotkeys (?) Button */}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShortcutsOpen(true)}
                className="hidden sm:flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-industrial-800 hover:border-industrial-700"
                title="Keyboard Shortcuts & Reference (?)"
              >
                <Keyboard size={13} className="text-slate-400" />
                <span className="hidden lg:inline">Hotkeys</span>
                <kbd className="px-1 py-0.2 rounded bg-industrial-800 text-[10px] text-cyan-300 font-mono">?</kbd>
              </Button>

              {/* Mobile Hamburger Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-industrial-900 border border-industrial-800"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-industrial-800 bg-industrial-950/95 backdrop-blur-xl px-4 py-3 space-y-1.5 animate-fade-in">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-industrial-800 text-cyan-400 font-semibold border border-cyan-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-industrial-900'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-cyan-400' : 'text-slate-400'} />
                  <span>{item.fullLabel}</span>
                </Link>
              );
            })}

            <div className="pt-2 border-t border-industrial-800 flex items-center justify-between">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setStatusModalOpen(true);
                }}
                className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-cyan-400 py-1"
              >
                <Activity size={14} className="text-cyan-400" />
                <span>View Engine Status</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShortcutsOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-cyan-400 py-1"
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
          <div className="p-3.5 rounded-xl bg-industrial-950 border border-industrial-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
              <div>
                <p className="font-semibold text-slate-200">
                  {isOnline ? 'FastAPI Gateway Connected' : 'Standalone Demo Mode'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isOnline ? 'Live cross-validation pipeline active' : 'Offline fixtures running in browser'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-industrial-800 text-slate-300 border border-industrial-700">
              v{health.version || '1.0.0'}
            </span>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Server size={13} className="text-cyan-400" />
              Subsystem Health Diagnostics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Database size={13} /> Database:
                </span>
                <span className="text-emerald-400 font-semibold">{health.checks?.database || 'Healthy (SQLite)'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <HardDrive size={13} /> Storage:
                </span>
                <span className="text-emerald-400 font-semibold">{health.checks?.storage || 'Healthy'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Cpu size={13} /> OCR Engine:
                </span>
                <span className="text-emerald-400 font-semibold">Tesseract + PyMuPDF</span>
              </div>
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Activity size={13} /> LLM Resolver:
                </span>
                <span className="text-cyan-300 font-semibold truncate max-w-[130px]" title={health.checks?.llm || 'NeMoTron & Heuristic'}>
                  NeMoTron / Rule
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setStatusModalOpen(false)}>
              Close Telemetry
            </Button>
          </div>
        </div>
      </Modal>

      {/* Keyboard Shortcuts & Operations Reference Modal */}
      <Modal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="System Hotkeys & Operations Guide">
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-industrial-950 border border-industrial-800 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <CheckCheck size={15} className="text-cyan-400" />
              <span>Multi-Signal Verification Protocol</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              UNTANGLE automatically cross-references physical P&ID blueprints against engineering DCS IO lists using visual OCR voting, OpenCV symbol correlation, RapidFuzz candidate indexing, and ISA-5.1 grammar parsing.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Keyboard size={13} className="text-slate-400" />
              Canvas & Review Hotkeys
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Toggle Shortcuts</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 text-cyan-300">?</kbd>
              </div>
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Zoom In / Out</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 text-cyan-300">+ / -</kbd>
              </div>
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Reset Viewport</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 text-cyan-300">0</kbd>
              </div>
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Before / After Split</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 text-cyan-300">b</kbd>
              </div>
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Rebuild Graph</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 text-cyan-300">r</kbd>
              </div>
              <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Close Active View</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 text-cyan-300">Esc</kbd>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setShortcutsOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
