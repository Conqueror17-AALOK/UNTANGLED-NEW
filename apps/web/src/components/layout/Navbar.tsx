import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layers, Upload, Activity, Eye, CheckSquare, FileText, Menu, X } from 'lucide-react';

interface NavbarProps {
  currentJobId?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentJobId = 'demo-job-1' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

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

  return (
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

          {/* Live Engine Indicator & Mobile Toggle */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Multi-Signal Engine Ready</span>
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
        </div>
      )}
    </header>
  );
};
