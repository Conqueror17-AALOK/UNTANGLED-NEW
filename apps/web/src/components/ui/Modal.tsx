import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-[#323642]/85 backdrop-blur-2xl border border-white/[0.15] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 relative">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.1]">
          <h3 className="text-base font-semibold tracking-tight text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.1] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
};
