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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#12141c] border border-[#2b3145] rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 relative">
        <div className="flex items-center justify-between pb-3.5 border-b border-[#222736]">
          <h3 className="text-sm font-semibold tracking-tight text-[#f1f5f9]">{title}</h3>
          <button
            onClick={onClose}
            className="text-[#94a3b8] hover:text-[#f1f5f9] p-1 rounded hover:bg-[#1c202d] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
};
