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
  CheckCheck
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface NavbarProps {
  currentJobId?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentJobId = 'demo-job-1' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { label: 'Ingestion', path: '/', icon: UploadCloud },
    { label: 'Pipeline Monitor', path: `/jobs/${currentJobId}`, icon: Cpu },
    { label: 'Process Topology', path: `/workspace/${currentJobId}`, icon: Workflow },
    { label: 'Review Queue', path: `/review/${currentJobId}`, icon: CheckCircle2 },
    { label: 'Audit Report', path: `/report/${currentJobId}`, icon: FileSpreadsheet },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

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

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#090a0f]/95 backdrop-blur-md border-b border-[#1e222d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            
            {/* Logo & System Metadata */}
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded bg-[#151821] border border-[#2b3145] flex items-center justify-center text-[#f1f5f9] group-hover:border-blue-500/50 transition-colors shadow-sm">
                  <Layers size={17} className="text-blue-400 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-tight font-mono text-[#f1f5f9]">
                      UNTANGLE
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/25">
                      v1.0-PROD
                    </span>
                  </div>
                </div>
              </Link>

              <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-[#1e222d] text-[11px] font-mono text-[#64748b]">
                <span>SPEC: ISA-5.1-2009</span>
                <span>•</span>
                <span className="truncate max-w-[120px]">JOB: {currentJobId.slice(0, 8)}</span>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-[#12141c] p-1 rounded-md border border-[#1e222d]">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                      active
                        ? 'bg-[#1e222d] text-[#f1f5f9] shadow-sm font-semibold'
                        : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#181a24]'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-blue-400' : 'text-[#64748b]'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* System Status & Shortcuts */}
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-[#12141c] border border-[#1e222d] text-[11px] font-mono text-[#94a3b8]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>DCS LINK ACTIVE</span>
              </div>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => setShortcutsOpen(true)}
                className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono border border-[#1e222d] hover:border-[#2b3145]"
                title="System Hotkeys (?)"
              >
                <Keyboard size={13} className="text-[#64748b]" />
                <span className="text-[#94a3b8]">Hotkeys</span>
                <kbd className="px-1 py-0.2 rounded bg-[#1e222d] text-[10px] text-[#f1f5f9]">?</kbd>
              </Button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-[#94a3b8] hover:text-[#f1f5f9] p-1.5 rounded bg-[#12141c] border border-[#1e222d]"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[#1e222d] bg-[#0f1117] px-4 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium ${
                    active
                      ? 'bg-[#1e222d] text-[#f1f5f9] font-semibold'
                      : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#151821]'
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Engineering Reference & Hotkeys Modal */}
      <Modal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title="System Hotkeys & Operations Reference">
        <div className="space-y-4 text-xs text-[#94a3b8]">
          <div className="p-3 rounded bg-[#090a0f] border border-[#1e222d] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f1f5f9]">
              <CheckCheck size={14} className="text-emerald-400" />
              <span>Multi-Signal Verification Protocol</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#94a3b8]">
              UNTANGLE fuses visual OCR voting (PyMuPDF & Tesseract), template correlation, DCS IO schedule distance, and ISA-5.1 grammar parsing into a deterministic confidence metric.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#64748b]">
              Canvas & Review Hotkeys
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-[#090a0f] border border-[#1e222d] flex justify-between items-center">
                <span>Zoom In / Out</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#1e222d] text-[#f1f5f9]">+ / -</kbd>
              </div>
              <div className="p-2 rounded bg-[#090a0f] border border-[#1e222d] flex justify-between items-center">
                <span>Reset Viewport</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#1e222d] text-[#f1f5f9]">0</kbd>
              </div>
              <div className="p-2 rounded bg-[#090a0f] border border-[#1e222d] flex justify-between items-center">
                <span>Before / After Split</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#1e222d] text-[#f1f5f9]">b</kbd>
              </div>
              <div className="p-2 rounded bg-[#090a0f] border border-[#1e222d] flex justify-between items-center">
                <span>Close Active View</span>
                <kbd className="px-1.5 py-0.5 rounded bg-[#1e222d] text-[#f1f5f9]">Esc</kbd>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setShortcutsOpen(false)}>
              Close Reference
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
