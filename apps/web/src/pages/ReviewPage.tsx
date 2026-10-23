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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5 animate-fade-in">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded bg-[#151821] border border-emerald-500/40 text-emerald-400 text-xs font-mono shadow-2xl backdrop-blur-md animate-fade-in">
          <Check size={15} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1e222d]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#64748b] mb-1">
            <span>OPERATOR VERIFICATION</span>
            <span>/</span>
            <span className="text-amber-400 font-semibold">
              {tags.filter((t) => t.status === 'needs_review').length} ITEMS REQUIRING REVIEW
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f1f5f9] flex items-center gap-2.5">
            <span>Human-in-the-Loop Review Queue</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="engineering"
            size="sm"
            onClick={handleRebuild}
            isLoading={isRebuilding}
            className="font-mono text-xs"
            title="Rebuild Topology (Hotkey: 'r')"
          >
            <RotateCcw size={13} />
            <span>Rebuild Topology</span>
            <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-blue-900/40 border border-blue-400/40 text-[10px] font-mono">r</kbd>
          </Button>

          <Link to={`/workspace/${jobId}`}>
            <Button variant="secondary" size="sm" className="font-mono text-xs">
              <Workflow size={13} />
              <span>Canvas</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 font-mono text-xs">
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
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-2 ${
                filter === tab
                  ? 'bg-[#151821] text-[#f1f5f9] font-bold border border-[#2b3145]'
                  : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#12141c]'
              }`}
            >
              <span>{tab === 'needs_review' ? 'Needs Review' : tab === 'resolved' ? 'Resolved' : 'All Tags'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#090a0f] border border-[#1e222d] text-[#64748b]">
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
          <Card className="p-0 overflow-hidden bg-[#12141c] border-[#1e222d]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#090a0f] text-[#64748b] text-[10px] uppercase tracking-wider border-b border-[#1e222d]">
                  <tr>
                    <th className="py-2.5 px-3">Raw Read</th>
                    <th className="py-2.5 px-3">Target Tag</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Conf</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e222d]">
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
                              ? 'bg-[#181b24]'
                              : 'hover:bg-[#151821]'
                          }`}
                        >
                          {/* Raw OCR Read */}
                          <td className="py-2.5 px-3 text-amber-300 font-semibold">
                            {tag.raw_text}
                          </td>

                          {/* Normalized Tag / Inline Edit */}
                          <td className="py-2.5 px-3">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave(tag.id);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  className="px-2 py-0.5 rounded bg-[#090a0f] border border-blue-500 text-blue-300 text-xs font-mono focus:outline-none uppercase"
                                  placeholder="PT-101"
                                  autoFocus
                                />
                                {validationError && (
                                  <p className="text-[10px] text-red-400">{validationError}</p>
                                )}
                              </div>
                            ) : (
                              <span className="font-bold text-[#f1f5f9]">{tag.normalized_tag}</span>
                            )}
                          </td>

                          {/* Type */}
                          <td className="py-2.5 px-3 text-[#94a3b8] truncate max-w-[140px]">
                            {tag.type.split(' ')[0]}
                          </td>

                          {/* Confidence */}
                          <td className="py-2.5 px-3">
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
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                tag.status === 'resolved'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                              }`}
                            >
                              {tag.status === 'needs_review' ? 'REVIEW' : 'VERIFIED'}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-2.5 px-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSave(tag.id);
                                  }}
                                  className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                  title="Save Correction"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelEdit();
                                  }}
                                  className="p-1 rounded bg-[#1e222d] text-[#94a3b8] hover:bg-[#2b3145]"
                                  title="Cancel"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(tag);
                                }}
                                className="p-1 rounded text-[#64748b] hover:text-[#f1f5f9] hover:bg-[#1e222d] transition-colors"
                                title="Edit Tag"
                              >
                                <Edit3 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#64748b]">
                        No tags found matching current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Live Crop & Traceability Inspector (Col span 1) */}
        <div>
          <Card className="bg-[#12141c] border-[#1e222d] p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e222d]">
              <div className="flex items-center gap-2">
                <Crosshair size={14} className="text-blue-400" />
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#f1f5f9]">
                  Crop Traceability
                </h3>
              </div>
              {selectedTag && (
                <span className="text-[10px] font-mono text-[#64748b]">
                  TAG ID: {selectedTag.id.slice(0, 12)}
                </span>
              )}
            </div>

            {selectedTag ? (
              <div className="space-y-3 font-mono text-xs">
                
                {/* Crop Visualizer */}
                <div className="h-32 rounded bg-[#090a0f] border border-[#1e222d] flex items-center justify-center p-3 relative overflow-hidden">
                  <div className="border border-blue-500/50 bg-blue-500/10 px-4 py-2.5 rounded text-center">
                    <span className="text-[10px] text-[#64748b] block">RAW SCAN CROP</span>
                    <span className="font-mono font-bold text-amber-300 text-base">
                      {selectedTag.raw_text}
                    </span>
                    <span className="text-[9px] text-[#64748b] mt-0.5 block">
                      bbox: [{selectedTag.bbox.join(', ')}]
                    </span>
                  </div>
                </div>

                {/* Reasoning Analysis */}
                <div className="p-2.5 rounded bg-[#090a0f] border border-[#1e222d] space-y-1 text-[11px]">
                  <span className="text-[#64748b] text-[10px] block">ISA-5.1 RESOLUTION REASONING:</span>
                  <p className="text-[#94a3b8] italic leading-relaxed">
                    "{selectedTag.reasoning || 'Tag verified against DCS point schedule.'}"
                  </p>
                </div>

                {/* DCS Match Record */}
                <div className="p-2.5 rounded bg-[#090a0f] border border-[#1e222d] space-y-1 text-[11px]">
                  <div className="flex justify-between text-[#64748b]">
                    <span>DCS POINT:</span>
                    <span className="text-emerald-400 font-bold">{selectedTag.io_match?.io_tag || 'None'}</span>
                  </div>
                  <div className="flex justify-between text-[#64748b]">
                    <span>SIGNAL TYPE:</span>
                    <span className="text-[#f1f5f9]">{selectedTag.io_match?.signal_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-[#64748b]">
                    <span>STATUS:</span>
                    <span className="text-blue-400 uppercase">{selectedTag.status}</span>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => startEdit(selectedTag)}
                  className="w-full font-mono text-xs justify-center"
                >
                  <Edit3 size={12} />
                  <span>Edit Selected Tag</span>
                </Button>
              </div>
            ) : (
              <div className="py-12 text-center text-[#64748b] text-xs font-mono">
                Select a tag in the table to inspect high-resolution crop and reasoning.
              </div>
            )}
          </Card>
        </div>

      </div>

    </div>
  );
};
