import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  RotateCcw,
  Edit3,
  Check,
  X,
  Workflow,
  Crosshair,
  Search,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../api/client';
import { Tag } from '../types';

export const ReviewPage: React.FC = () => {
  const { jobId: paramJobId } = useParams();
  const storedJobId = typeof window !== 'undefined' ? localStorage.getItem('untangled_active_job_id') : null;
  const jobId = paramJobId || storedJobId || 'demo-job-1';

  const [tags, setTags] = useState<Tag[]>([]);
  const [filter, setFilter] = useState<'all' | 'needs_review' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editType, setEditType] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cropFailed, setCropFailed] = useState(false);

  // Robust industrial plant tag regex (accepts ISA tags, plant/unit prefixes like 14-T-211B, 631-G-0306A, PCV-17, 14-0021-164)
  const tagPattern = /^[A-Z0-9]{1,8}(-[A-Z0-9]{1,8}){0,4}$|^[A-Z]{1,5}[0-9]{1,6}[A-Z]?$/;

  useEffect(() => {
    loadTags();
  }, [jobId]);

  useEffect(() => {
    setCropFailed(false);
  }, [selectedTag?.id]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      let data = await apiClient.getTags(jobId);
      
      // Fallback gracefully to demo tags if current job has 0 tags (e.g. fresh run)
      if ((!data || data.length === 0) && jobId !== 'demo-job-1') {
        try {
          const fallback = await apiClient.getTags('demo-job-1');
          if (fallback && fallback.length > 0) {
            data = fallback;
          }
        } catch {
          // ignore
        }
      }

      setTags(data || []);
      if (data && data.length > 0) {
        const needsReview = data.filter((t) => t.status === 'needs_review');
        if (needsReview.length > 0) {
          setFilter('needs_review');
          setSelectedTag(needsReview[0]);
        } else {
          setFilter('all');
          setSelectedTag(data[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load job tags, loading fallback demo tags:', err);
      try {
        const demoData = await apiClient.getTags('demo-job-1');
        setTags(demoData || []);
        if (demoData && demoData.length > 0) {
          setSelectedTag(demoData[0]);
          setFilter('all');
        }
      } catch (e) {
        console.error('Critical fallback failure:', e);
      }
    } finally {
      setIsLoading(false);
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
      setValidationError('Tag must conform to industrial plant naming convention (e.g. PT-101, 14-T-211B)');
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
    const matchesFilter = filter === 'all' || t.status === filter;
    const matchesSearch =
      !searchQuery ||
      t.normalized_tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.raw_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="relative w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 animate-fade-in font-sans">
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
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-100 tracking-tight">
              Review Queue
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              Job: {jobId.length > 12 ? `${jobId.slice(0, 10)}...` : jobId}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-normal">
            Deterministic operator verification, tag disambiguation, and automated topology cross-check.
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

      {/* Control Bar: Filter Tabs + Search Box */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Tabs with Frosted Glassmorphism */}
        <div className="flex rounded-xl bg-white/[0.04] backdrop-blur-md p-1 border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-xs max-w-fit">
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
                className={`px-3 py-1 rounded-lg transition-all duration-150 flex items-center gap-2 font-medium text-xs ${
                  isActive
                    ? 'bg-white/[0.15] backdrop-blur-md text-white font-medium shadow-sm border border-white/[0.2]'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>{tab === 'needs_review' ? 'Needs Review' : tab === 'resolved' ? 'Resolved' : 'All Tags'}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.06] text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags or types..."
            className="pl-8 pr-3 py-1.5 rounded-lg bg-[#24272f] border border-[#434856] text-slate-200 text-xs focus:outline-none focus:border-cyan-400 placeholder-slate-500 w-full sm:w-60 font-sans"
          />
        </div>
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400 font-normal">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 size={24} className="animate-spin text-cyan-400" />
                          <span className="text-xs">Loading tags from job index...</span>
                        </div>
                      </td>
                    </tr>
                  ) : displayedTags.length > 0 ? (
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
                              <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave(tag.id);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  className="px-2.5 py-1 rounded-md bg-[#24272f] border border-cyan-400 text-slate-100 text-xs font-mono focus:outline-none uppercase"
                                  placeholder="PT-101"
                                  autoFocus
                                />
                                {validationError && (
                                  <p className="text-[10px] text-rose-400 font-medium flex items-center gap-1">
                                    <AlertCircle size={10} />
                                    <span>{validationError}</span>
                                  </p>
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
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleSave(tag.id)}
                                  className="p-1 rounded bg-slate-100 text-slate-900 hover:bg-white transition-all"
                                  title="Save Correction"
                                >
                                  <Check size={14} className="stroke-[2.5]" />
                                </button>
                                <button
                                  onClick={() => cancelEdit()}
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
                        No tags found matching current filter ({filter})
                        {searchQuery && ` and search "${searchQuery}"`}.
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
                <span className="adobe-chip text-xs font-mono">
                  {selectedTag.id.slice(0, 10)}
                </span>
              )}
            </div>

            {selectedTag ? (
              <div className="space-y-3 text-xs">
                {/* Crop Visualizer */}
                <div className="h-32 rounded-lg bg-[#24272f] border border-[#434856] flex items-center justify-center p-2 relative overflow-hidden">
                  {selectedTag.bbox && selectedTag.bbox.length >= 4 && !jobId.startsWith('demo-') && !jobId.startsWith('mock-') && !cropFailed ? (
                    <img
                      src={apiClient.getSourceCropUrl(jobId, selectedTag.page || 1, selectedTag.bbox)}
                      alt={`Drawing Crop of ${selectedTag.normalized_tag}`}
                      className="max-h-full max-w-full object-contain rounded border border-cyan-500/40 shadow-sm"
                      onError={() => setCropFailed(true)}
                    />
                  ) : (
                    <div className="border border-[#434856] bg-[#282b33] px-4 py-2 rounded-md text-center">
                      <span className="font-mono font-medium text-amber-300 text-sm block">
                        {selectedTag.raw_text}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                        [{selectedTag.bbox ? selectedTag.bbox.map((v) => Math.round(v)).join(', ') : 'No Coordinates'}]
                      </span>
                    </div>
                  )}
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
                    <span>CONFIDENCE</span>
                    <span className="text-cyan-400 font-medium">{Math.round(selectedTag.confidence * 100)}%</span>
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
