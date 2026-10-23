import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Layers,
  Upload,
  Activity,
  Eye,
  CheckSquare,
  FileText,
  Menu,
  X,
  HelpCircle,
  Compass,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface NavbarProps {
  currentJobId?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentJobId = 'demo-job-1' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Upload', path: '/', icon: Upload },
    { label: 'Pipeline', path: `/jobs/${currentJobId}`, icon: Activity },
    { label: 'Process Sketch', path: `/workspace/${currentJobId}`, icon: Eye },
    { label: 'Review Queue', path: `/review/${currentJobId}`, icon: CheckSquare },
    { label: 'Report', path: `/report/${currentJobId}`, icon: FileText },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  // Keyboard shortcut listener: '?' opens tour modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setTourOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const tourSteps = [
    {
      step: '1',
      title: 'Upload P&ID & IO List',
      desc: 'Drag & drop real engineering drawings or click Load Demo Files (100% turnkey)',
      path: '/',
    },
    {
      step: '2',
      title: '9-Stage Real-Time Pipeline',
      desc: 'Watch deterministic execution over WebSocket from OCR voting to topological layout',
      path: `/jobs/${currentJobId}`,
    },
    {
      step: '3',
      title: 'Interactive Process Sketch',
      desc: 'Layer toggles, Before/After split view, and Tag Inspector with 5-signal confidence',
      path: `/workspace/${currentJobId}`,
    },
    {
      step: '4',
      title: 'Human Review Queue',
      desc: 'Inline ISA tag correction (PT10l -> PT101) with instant <1s graph rebuild',
      path: `/review/${currentJobId}`,
    },
    {
      step: '5',
      title: 'Cross-Validation Audit Report',
      desc: 'Discrepancy matrices, multi-lingual English/Hindi/Marathi toggle, and official PDF download',
      path: `/report/${currentJobId}`,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-industrial-950/80 backdrop-blur-md border-b border-industrial-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Brand */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-slate-950 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                <Layers size={22} className="stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-cyan-300 bg-clip-text text-transparent">
                    UNTANGLE
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    v1.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono hidden sm:block">P&ID Untangling & Cross-Val Engine</p>
              </div>
            </Link>

            {/* Desktop Stepper Navigation */}
            <nav className="hidden md:flex items-center gap-1 bg-industrial-900/80 p-1.5 rounded-xl border border-industrial-800">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-industrial-800'
                    }`}
                  >
                    <Icon size={14} className={active ? 'text-cyan-400' : 'text-slate-500'} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Controls: Demo Tour & Live Status */}
            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTourOpen(true)}
                className="hidden sm:flex items-center gap-1.5 text-xs text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10"
                title="Judge Demo Tour & Keyboard Shortcuts (?)"
              >
                <Compass size={14} className="text-cyan-400" />
                <span>Demo Tour</span>
                <span className="font-mono text-[10px] bg-cyan-500/20 px-1 py-0.2 rounded text-cyan-300 border border-cyan-500/30">?</span>
              </Button>

              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Multi-Signal Ready</span>
              </div>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-slate-400 hover:text-slate-200 p-2 rounded-lg bg-industrial-900 border border-industrial-800"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-industrial-800 bg-industrial-950/95 backdrop-blur-xl px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-industrial-900'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setTourOpen(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-cyan-400 hover:bg-cyan-500/10"
            >
              <Compass size={18} />
              Interactive Demo Tour & Shortcuts
            </button>
          </div>
        )}
      </header>

      {/* Judge Demo Tour & Keyboard Shortcuts Modal */}
      <Modal isOpen={tourOpen} onClose={() => setTourOpen(false)} title="UNTANGLE: Judge Demo Tour & Architecture Guide">
        <div className="space-y-6 text-xs text-slate-300">
          
          {/* Key Differentiators Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/30 space-y-1.5">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
              <Sparkles size={16} />
              <span>Six Engineering Differentiators</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              1. P&ID & IO Cross-Validation · 2. Multi-Signal Confidence (OCR, Symbol, IO, ISA, LLM) · 3. Three-Tier Decision Logic (&gt;0.85 Auto, 0.60-0.85 LLM, &lt;0.60 Review) · 4. Interactive Simplified Process Sketch · 5. Multi-lingual Operator Reports (EN / HI / MR) · 6. Traceability Crop Overlay with Direct Bounding Box Mapping.
            </p>
          </div>

          {/* 5-Step Guided Demo Flow */}
          <div className="space-y-2.5">
            <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] font-mono">
              Recommended 5-Step Demo Walkthrough
            </h4>
            <div className="space-y-2">
              {tourSteps.map((st) => (
                <div
                  key={st.step}
                  onClick={() => {
                    setTourOpen(false);
                    navigate(st.path);
                  }}
                  className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 hover:border-cyan-500/50 hover:bg-industrial-900/60 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                      {st.step}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {st.title}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{st.desc}</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Keyboard Shortcuts Cheat Sheet */}
          <div className="space-y-2 pt-2 border-t border-industrial-800">
            <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
              <HelpCircle size={13} className="text-slate-400" />
              Keyboard Shortcuts Cheat Sheet
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Toggle Tour Modal</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 border border-industrial-700 text-cyan-300">?</kbd>
              </div>
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Zoom In / Out</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 border border-industrial-700 text-cyan-300">+ / -</kbd>
              </div>
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Reset Viewport</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 border border-industrial-700 text-cyan-300">0</kbd>
              </div>
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Before / After Split</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 border border-industrial-700 text-cyan-300">b</kbd>
              </div>
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Rebuild Graph</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 border border-industrial-700 text-cyan-300">r</kbd>
              </div>
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800 flex justify-between items-center">
                <span className="text-slate-400">Close Modals</span>
                <kbd className="px-1.5 py-0.5 rounded bg-industrial-800 border border-industrial-700 text-cyan-300">Esc</kbd>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setTourOpen(false)}>
              Got it, let's explore!
            </Button>
          </div>

        </div>
      </Modal>
    </>
  );
};
