import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  RotateCcw,
  Edit3,
  Check,
  X,
  Workflow,
  Crosshair
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Tag } from '../types';

export const ReviewPage: React.FC = () => {
  const { jobId = 'demo-job-1' } = useParams();

  const [tags, setTags] = useState<Tag[]>([]);
  const [filter, setFilter] = useState<'all' | 'needs_review' | 'resolved'>('needs_review');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editType, setEditType] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ISA regex: ^[A-Z]{1,4}-?[0-9]{1,5}[A-Z]?$
  const tagPattern = /^[A-Z]{1,4}-?[0-9]{1,5}[A-Z]?$/;

  useEffect(() => {
    loadTags();
  }, [jobId]);

  const loadTags = async () => {
    try {
      const data = await apiClient.getTags(jobId);
      setTags(data);
      if (data.length > 0) {
        setSelectedTag(data.find((t) => t.status === 'needs_review') || data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setSelectedTag(tag);
    setEditValue(tag.normalized_tag);
    setEditType(tag.type);
    setValidationError(null);
  };

  const cancelEdit = () => {
    setEditingTagId(null);
    setValidationError(null);
  };

  const handleSave = async (tagId: string) => {
    const upper = editValue.trim().toUpperCase();
    if (!tagPattern.test(upper)) {
      setValidationError('Tag must conform to ISA-5.1 naming convention (e.g. PT-101, CV-101A)');
      return;
    }

    try {
      const updated = await apiClient.updateTag(jobId, tagId, upper, editType);
      setTags((prev) => prev.map((t) => (t.id === tagId ? updated : t)));
      setSelectedTag(updated);
      setEditingTagId(null);
      setToastMessage(`Tag ${upper} verified and recorded.`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setValidationError(error?.message || 'Failed to update tag');
    }
  };

  const handleRebuild = async () => {
    setIsRebuilding(true);
    try {
      await apiClient.rebuildGraph(jobId);
      setToastMessage('Topology rebuilt with manual corrections.');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRebuilding(false);
    }
  };

  // Keyboard shortcut: 'r' to rebuild graph
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRebuild();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jobId]);

  const displayedTags = tags.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  return (
    <div className="relative w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#24272f] border border-[#434856] text-slate-100 text-xs font-medium shadow-xl animate-fade-in">
          <Check size={15} className="text-emerald-400 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Refined Engineering Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#434856]">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100 tracking-tight mb-0.5">
            Review Queue
          </h1>
          <p className="text-xs text-slate-400 font-normal">
            Deterministic operator verification and automated topology cross-check.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRebuild}
            disabled={isRebuilding}
            className="bg-slate-100 text-slate-900 font-medium h-8 px-3 rounded-lg flex items-center gap-2 hover:bg-white transition-all text-xs disabled:opacity-50"
            title="Rebuild Topology (Hotkey: 'r')"
          >
            <RotateCcw size={13} className={`stroke-[2] ${isRebuilding ? 'animate-spin' : ''}`} />
            <span>Rebuild</span>
            <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-slate-200 text-[10px] font-mono font-medium">r</kbd>
          </button>

          <Link to={`/workspace/${jobId}`}>
            <button className="h-8 px-3 rounded-lg border border-[#434856] bg-[#24272f] text-slate-300 hover:text-white hover:bg-[#323642] flex items-center gap-2 transition-all text-xs font-medium">
              <Workflow size={13} className="text-slate-400" />
              <span>Canvas</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex rounded-lg bg-[#24272f] p-1 border border-[#434856] text-xs max-w-fit">
        {(['needs_review', 'resolved', 'all'] as const).map((tab) => {
          const count =
            tab === 'needs_review'
              ? tags.filter((t) => t.status === 'needs_review').length
              : tab === 'resolved'
              ? tags.filter((t) => t.status === 'resolved').length
              : tags.length;

          const isActive = filter === tab;

          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-md transition-all duration-150 flex items-center gap-2 font-medium text-xs ${
                isActive
                  ? 'bg-[#3f4554] text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab === 'needs_review' ? 'Needs Review' : tab === 'resolved' ? 'Resolved' : 'All Tags'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                isActive
                  ? 'bg-slate-700 text-slate-100'
                  : 'bg-white/[0.06] text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Data Table + Live Crop Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Tags Table (Col span 2) */}
        <div className="lg:col-span-2">
          <div className="adobe-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#24272f] text-slate-400 text-xs font-medium uppercase tracking-wider border-b border-[#434856]">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Raw Read</th>
                    <th className="py-2.5 px-4 font-medium">Target Tag</th>
                    <th className="py-2.5 px-4 font-medium">Type</th>
                    <th className="py-2.5 px-4 font-medium">Conf</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 text-right font-medium">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#434856] bg-transparent">
                  {displayedTags.length > 0 ? (
                    displayedTags.map((tag) => {
                      const isEditing = editingTagId === tag.id;
                      const isSelected = selectedTag?.id === tag.id;

                      return (
                        <tr
                          key={tag.id}
                          onClick={() => setSelectedTag(tag)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-white/[0.06] border-l-2 border-l-blue-400'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          {/* Raw OCR Read */}
                          <td className="py-3 px-4 text-amber-300 font-mono font-medium">
                            {tag.raw_text}
                          </td>

                          {/* Normalized Tag / Inline Edit */}
                          <td className="py-3 px-4">
                            {isEditing ? (
                              <div className="space-y-1.5">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave(tag.id);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-[#181a1f] border border-[#3b404d] text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500 uppercase"
                                  placeholder="PT-101"
                                  autoFocus
                                />
                                {validationError && (
                                  <p className="text-[10px] text-rose-400 font-medium">{validationError}</p>
                                )}
                              </div>
                            ) : (
                              <span className="font-medium text-slate-100 font-mono">{tag.normalized_tag}</span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="py-3 px-4 text-slate-300 font-normal truncate max-w-[140px]">
                            {tag.type.split(' ')[0]}
                          </td>

                          {/* Confidence */}
                          <td className="py-3 px-4">
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                              tag.confidence >= 0.85
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                                : tag.confidence >= 0.60
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-400/30'
                            }`}>
                              {Math.round(tag.confidence * 100)}%
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                                tag.status === 'resolved'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                                  : 'bg-rose-500/15 text-rose-300 border border-rose-400/30'
                              }`}
                            >
                              {tag.status === 'needs_review' ? 'REVIEW' : 'VERIFIED'}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSave(tag.id);
                                  }}
                                  className="p-1 rounded bg-slate-100 text-slate-900 hover:bg-white transition-all"
                                  title="Save Correction"
                                >
                                  <Check size={14} className="stroke-[2.5]" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelEdit();
                                  }}
                                  className="p-1 rounded bg-white/[0.08] text-slate-400 hover:text-white"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(tag);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                                title="Edit Tag"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 font-normal">
                        No tags found matching current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Live Crop & Inspector (Col span 1) */}
        <div>
          <div className="adobe-card p-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#434856]">
              <div className="flex items-center gap-2">
                <Crosshair size={14} className="text-slate-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Tag Inspection
                </h3>
              </div>
              {selectedTag && (
                <span className="adobe-chip text-xs">
                  {selectedTag.id.slice(0, 8)}
                </span>
              )}
            </div>

            {selectedTag ? (
              <div className="space-y-3 text-xs">
                {/* Crop Visualizer */}
                <div className="h-28 rounded-lg bg-[#24272f] border border-[#434856] flex items-center justify-center p-3">
                  <div className="border border-[#434856] bg-[#282b33] px-4 py-2 rounded-md text-center">
                    <span className="font-mono font-medium text-amber-300 text-sm block">
                      {selectedTag.raw_text}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                      [{selectedTag.bbox.join(', ')}]
                    </span>
                  </div>
                </div>

                {/* Reasoning */}
                {selectedTag.reasoning && (
                  <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] text-xs">
                    <p className="text-slate-300 text-xs leading-relaxed font-normal">
                      {selectedTag.reasoning}
                    </p>
                  </div>
                )}

                {/* Match Record */}
                <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-400 font-sans font-medium">
                    <span>DCS POINT</span>
                    <span className="text-emerald-400 font-mono font-medium">{selectedTag.io_match?.io_tag || 'None'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 font-sans font-medium">
                    <span>SIGNAL</span>
                    <span className="text-slate-200 font-mono">{selectedTag.io_match?.signal_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 font-sans font-medium">
                    <span>STATUS</span>
                    <span className="text-emerald-400 uppercase font-medium">{selectedTag.status}</span>
                  </div>
                </div>

                <button
                  onClick={() => startEdit(selectedTag)}
                  className="w-full h-8 rounded-lg border border-[#434856] bg-[#24272f] text-slate-200 font-medium hover:bg-[#323642] flex items-center justify-center gap-2 transition-all text-xs"
                >
                  <Edit3 size={13} />
                  <span>Edit Tag</span>
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs font-normal">
                Select a tag to inspect.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

