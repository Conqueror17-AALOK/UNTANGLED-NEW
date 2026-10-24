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
      <header className="sticky top-0 z-40 bg-[#030712]/50 backdrop-blur-2xl border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.5),inset_0_-1px_0_0_rgba(255,255,255,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo - UNTANGLED */}
            <Link to="/" className="flex items-center gap-3 group shrink-0" title="UNTANGLED Platform">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-cyan-500/25 blur-md group-hover:bg-cyan-400/40 transition-colors" />
                <img
                  src="/logo-mark.png"
                  alt="UNTANGLED Emblem"
                  className="relative w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(56,189,248,0.7)] group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-heading font-extrabold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                  UNTANGLED
                </span>
                <span className="hidden sm:inline text-[10px] font-mono text-cyan-300 font-semibold px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.25),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-md">
                  P&ID AI
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Floating Glass Pill Dock */}
            <nav className="hidden md:flex items-center gap-1.5 bg-white/[0.03] backdrop-blur-2xl p-1.5 rounded-2xl border border-white/[0.1] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.15),0_10px_30px_rgba(0,0,0,0.4)] mx-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                      active
                        ? 'bg-gradient-to-r from-cyan-500/25 via-blue-600/30 to-indigo-600/25 text-white font-bold border border-cyan-400/40 shadow-[0_0_20px_rgba(6,182,212,0.3),inset_0_1px_1px_0_rgba(255,255,255,0.3)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]' : 'text-slate-400'} />
                    <span className="lg:hidden">{item.label}</span>
                    <span className="hidden lg:inline">{item.fullLabel}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Controls: Interactive Live Status & Hotkeys */}
            <div className="flex items-center gap-2 shrink-0">
              
              {/* Interactive System Health Badge */}
              <button
                type="button"
                onClick={() => setStatusModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono transition-all border cursor-pointer backdrop-blur-md ${
                  isOnline
                    ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2),inset_0_1px_0_0_rgba(255,255,255,0.18)] hover:bg-emerald-500/25'
                    : 'bg-cyan-500/15 border-cyan-400/35 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.2),inset_0_1px_0_0_rgba(255,255,255,0.18)] hover:bg-cyan-500/25'
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
                variant="secondary"
                size="xs"
                onClick={() => setShortcutsOpen(true)}
                className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
                title="Keyboard Shortcuts & Reference (?)"
              >
                <Keyboard size={13} className="text-slate-400" />
                <span className="hidden lg:inline">Hotkeys</span>
                <kbd className="px-1 py-0.2 rounded bg-white/[0.1] text-[10px] text-cyan-300 font-mono border border-white/[0.15]">?</kbd>
              </Button>

              {/* Mobile Hamburger Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-slate-400 hover:text-white p-2 rounded-xl bg-white/[0.04] border border-white/[0.1] backdrop-blur-md"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/[0.08] bg-[#030712]/90 backdrop-blur-2xl px-4 py-3 space-y-1.5 animate-fade-in">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-white font-semibold border border-cyan-400/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-cyan-400' : 'text-slate-400'} />
                  <span>{item.fullLabel}</span>
                </Link>
              );
            })}

            <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setStatusModalOpen(true);
                }}
                className="flex items-center gap-2 text-xs font-mono text-slate-300 hover:text-cyan-300 py-1"
              >
                <Activity size={14} className="text-cyan-400" />
                <span>View Engine Status</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShortcutsOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-mono text-slate-300 hover:text-cyan-300 py-1"
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
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex items-center justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
              <div>
                <p className="font-semibold text-white">
                  {isOnline ? 'FastAPI Gateway Connected' : 'Standalone Demo Mode'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isOnline ? 'Live cross-validation pipeline active' : 'Offline fixtures running in browser'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.06] text-cyan-300 border border-white/[0.12]">
              v{health.version || '1.0.0'}
            </span>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Server size={13} className="text-cyan-400" />
              Subsystem Health Diagnostics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex items-center justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Database size={13} className="text-cyan-400" /> Database:
                </span>
                <span className="text-emerald-400 font-semibold">{health.checks?.database || 'Healthy (SQLite)'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex items-center justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <HardDrive size={13} className="text-emerald-400" /> Storage:
                </span>
                <span className="text-emerald-400 font-semibold">{health.checks?.storage || 'Healthy'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex items-center justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Cpu size={13} className="text-indigo-400" /> OCR Engine:
                </span>
                <span className="text-emerald-400 font-semibold">Tesseract + PyMuPDF</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex items-center justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Activity size={13} className="text-purple-400" /> LLM Resolver:
                </span>
                <span className="text-cyan-300 font-semibold truncate max-w-[130px]" title={health.checks?.llm || 'NeMoTron & Heuristic'}>
                  NeMoTron / Rule
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setStatusModalOpen(false)}>
              Close Telemetry
            </Button>
          </div>
        </div>
      </Modal>

      {/* Keyboard Shortcuts & Operations Reference Modal */}
      <Modal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="System Hotkeys & Operations Guide">
        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md space-y-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <CheckCheck size={15} className="text-cyan-400" />
              <span>Multi-Signal Verification Protocol</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              UNTANGLED automatically cross-references physical P&ID blueprints against engineering DCS IO lists using visual OCR voting, OpenCV symbol correlation, RapidFuzz candidate indexing, and ISA-5.1 grammar parsing.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Keyboard size={13} className="text-slate-400" />
              Canvas & Review Hotkeys
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex justify-between items-center">
                <span className="text-slate-400">Toggle Shortcuts</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.08] text-cyan-300 border border-white/[0.12]">?</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex justify-between items-center">
                <span className="text-slate-400">Zoom In / Out</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.08] text-cyan-300 border border-white/[0.12]">+ / -</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex justify-between items-center">
                <span className="text-slate-400">Reset Viewport</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.08] text-cyan-300 border border-white/[0.12]">0</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex justify-between items-center">
                <span className="text-slate-400">Before / After Split</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.08] text-cyan-300 border border-white/[0.12]">b</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex justify-between items-center">
                <span className="text-slate-400">Rebuild Graph</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.08] text-cyan-300 border border-white/[0.12]">r</kbd>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex justify-between items-center">
                <span className="text-slate-400">Close Active View</span>
                <kbd className="px-2 py-0.5 rounded-md bg-white/[0.08] text-cyan-300 border border-white/[0.12]">Esc</kbd>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShortcutsOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
