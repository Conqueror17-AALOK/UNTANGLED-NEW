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
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
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
    <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white/[0.05] border border-emerald-400/40 text-emerald-300 text-xs font-mono shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_25px_rgba(16,185,129,0.2)] backdrop-blur-2xl animate-fade-in">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-white tracking-tight">
              Review Queue
            </h1>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-semibold">
              {tags.filter((t) => t.status === 'needs_review').length} items to review
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Operator validation and symbol confirmation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="engineering"
            size="sm"
            onClick={handleRebuild}
            isLoading={isRebuilding}
            className="font-mono text-xs flex items-center gap-1.5"
            title="Rebuild Topology (Hotkey: 'r')"
          >
            <RotateCcw size={13} />
            <span>Rebuild</span>
            <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-blue-900/60 border border-blue-400/40 text-[10px] font-mono">r</kbd>
          </Button>

          <Link to={`/workspace/${jobId}`}>
            <Button variant="secondary" size="sm" className="font-mono text-xs flex items-center gap-1.5">
              <Workflow size={13} className="text-cyan-400" />
              <span>Canvas</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs - Frosted Glass Bar */}
      <div className="flex rounded-xl bg-white/[0.04] p-1 border border-white/[0.1] backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] text-xs font-mono max-w-fit">
        {(['needs_review', 'resolved', 'all'] as const).map((tab) => {
          const count =
            tab === 'needs_review'
              ? tags.filter((t) => t.status === 'needs_review').length
              : tab === 'resolved'
              ? tags.filter((t) => t.status === 'resolved').length
              : tags.length;

          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-2 ${
                filter === tab
                  ? 'bg-white/[0.14] text-white font-bold border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.25)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <span>{tab === 'needs_review' ? 'Needs Review' : tab === 'resolved' ? 'Resolved' : 'All Tags'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                filter === tab
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/30'
                  : 'bg-white/[0.05] text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Data Table + Live Crop Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tags Table (Col span 2) */}
        <div className="lg:col-span-2">
          <Card variant="glass" className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-white/[0.04] text-slate-400 text-[10px] uppercase tracking-wider border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Raw Read</th>
                    <th className="py-3 px-4">Target Tag</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Conf</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] bg-transparent">
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
                              ? 'bg-industrial-800/70 border-l-2 border-l-cyan-400'
                              : 'hover:bg-industrial-800/40'
                          }`}
                        >
                          {/* Raw OCR Read */}
                          <td className="py-3 px-4 text-amber-300 font-semibold">
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
                                  className="px-2.5 py-1 rounded-lg bg-industrial-950 border border-cyan-400 text-cyan-300 text-xs font-mono focus:outline-none uppercase shadow-glow-cyan"
                                  placeholder="PT-101"
                                  autoFocus
                                />
                                {validationError && (
                                  <p className="text-[10px] text-red-400">{validationError}</p>
                                )}
                              </div>
                            ) : (
                              <span className="font-bold text-white">{tag.normalized_tag}</span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="py-3 px-4 text-slate-300 truncate max-w-[140px]">
                            {tag.type.split(' ')[0]}
                          </td>

                          {/* Confidence */}
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                tag.confidence >= 0.85
                                  ? 'high'
                                  : tag.confidence >= 0.60
                                  ? 'medium'
                                  : 'low'
                              }
                              size="xs"
                            >
                              {Math.round(tag.confidence * 100)}%
                            </Badge>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                                tag.status === 'resolved'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
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
                                  className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 shadow-sm"
                                  title="Save Correction"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelEdit();
                                  }}
                                  className="p-1.5 rounded-lg bg-white/[0.06] text-slate-400 hover:bg-white/[0.12] hover:text-white border border-white/[0.1]"
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
                                className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-white/[0.06] transition-colors"
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
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        No tags found matching current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Live Crop & Inspector (Col span 1) */}
        <div>
          <Card variant="glass" className="p-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Crosshair size={14} className="text-cyan-400" />
                <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-slate-200">
                  Tag Inspection
                </h3>
              </div>
              {selectedTag && (
                <span className="text-[10px] font-mono text-cyan-300 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.1]">
                  {selectedTag.id.slice(0, 8)}
                </span>
              )}
            </div>

            {selectedTag ? (
              <div className="space-y-3 font-mono text-xs">
                {/* Crop Visualizer */}
                <div className="h-28 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex items-center justify-center p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                  <div className="border border-cyan-400/40 bg-cyan-950/30 px-4 py-2 rounded-xl text-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                    <span className="font-mono font-bold text-amber-300 text-base block">
                      {selectedTag.raw_text}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
                      [{selectedTag.bbox.join(', ')}]
                    </span>
                  </div>
                </div>

                {/* Reasoning */}
                {selectedTag.reasoning && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md text-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {selectedTag.reasoning}
                    </p>
                  </div>
                )}

                {/* Match Record */}
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md space-y-2 text-xs shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                  <div className="flex justify-between text-slate-400">
                    <span>DCS POINT</span>
                    <span className="text-emerald-400 font-bold">{selectedTag.io_match?.io_tag || 'None'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>SIGNAL</span>
                    <span className="text-slate-200">{selectedTag.io_match?.signal_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>STATUS</span>
                    <span className="text-cyan-400 uppercase font-semibold">{selectedTag.status}</span>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => startEdit(selectedTag)}
                  className="w-full font-mono text-xs justify-center gap-1.5"
                >
                  <Edit3 size={13} />
                  <span>Edit Tag</span>
                </Button>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                Select a tag to inspect.
              </div>
            )}
          </Card>
        </div>

      </div>

    </div>
  );
};
