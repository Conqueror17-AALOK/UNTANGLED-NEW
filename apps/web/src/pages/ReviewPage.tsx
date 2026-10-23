import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  RefreshCw,
  Edit2,
  Check,
  X,
  Eye
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
  const [editValue, setEditValue] = useState('');
  const [editType, setEditType] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // ISA regex from contract: ^[A-Z]{1,4}-?[0-9]{1,5}[A-Z]?$
  const tagPattern = /^[A-Z]{1,4}-?[0-9]{1,5}[A-Z]?$/;

  useEffect(() => {
    loadTags();
  }, [jobId]);

  const loadTags = async () => {
    try {
      const data = await apiClient.getTags(jobId);
      setTags(data);
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
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
      setValidationError('Tag format must match ISA convention (e.g. PT-101, FT101, CV-101A)');
      return;
    }

    try {
      const updated = await apiClient.updateTag(jobId, tagId, upper, editType);
      setTags((prev) => prev.map((t) => (t.id === tagId ? updated : t)));
      setEditingTagId(null);
      setToastMessage(`Tag ${upper} updated and marked as human-verified.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setValidationError(error?.message || 'Failed to update tag');
    }
  };

  const handleRebuild = async () => {
    setIsRebuilding(true);
    try {
      await apiClient.rebuildGraph(jobId);
      setToastMessage('Process sketch rebuilt successfully with your corrections!');
      setTimeout(() => setToastMessage(null), 4000);
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm shadow-2xl backdrop-blur-md animate-fade-in">
          <Check size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-industrial-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>Human-in-the-Loop Review Queue</span>
            <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/30">
              {tags.filter((t) => t.status === 'needs_review').length} Pending
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review ambiguous tag readings, fix optical typos, and trigger an instant process sketch rebuild.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleRebuild}
            isLoading={isRebuilding}
            className="shadow-lg shadow-cyan-500/20"
            title="Instant rebuild reruns stages 6-9 in <1s (Shortcut: 'r')"
          >
            <RefreshCw size={15} />
            <span>Rebuild Process Sketch</span>
            <kbd className="hidden sm:inline px-1 py-0.2 rounded bg-cyan-950/60 border border-cyan-400/40 text-[10px] font-mono">r</kbd>
          </Button>

          <Link to={`/workspace/${jobId}`}>
            <Button variant="secondary" size="md">
              <Eye size={15} />
              <span>Canvas</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['needs_review', 'resolved', 'all'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === tab
                ? 'bg-industrial-800 text-cyan-400 border border-cyan-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-industrial-900'
            }`}
          >
            {tab === 'needs_review' ? 'Needs Review' : tab === 'resolved' ? 'Resolved' : 'All Tags'}
          </button>
        ))}
      </div>

      {/* Tags Table */}
      <Card className="p-0 overflow-hidden border-industrial-800 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-industrial-950 text-slate-400 font-mono text-[11px] uppercase tracking-wider border-b border-industrial-800">
              <tr>
                <th className="py-3 px-4">Raw Read</th>
                <th className="py-3 px-4">Normalized Tag</th>
                <th className="py-3 px-4">Type / Category</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">IO Match</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-industrial-800/80">
              {displayedTags.length > 0 ? (
                displayedTags.map((tag) => {
                  const isEditing = editingTagId === tag.id;

                  return (
                    <tr
                      key={tag.id}
                      className={`hover:bg-industrial-850/60 transition-colors ${
                        tag.status === 'needs_review' ? 'bg-amber-500/[0.03]' : ''
                      }`}
                    >
                      {/* Raw Read */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-300">
                        <span className="bg-industrial-950 px-2 py-1 rounded border border-industrial-800 text-amber-300">
                          {tag.raw_text}
                        </span>
                      </td>

                      {/* Normalized Tag / Inline Edit */}
                      <td className="py-3 px-4 font-mono">
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
                              className="px-2 py-1 rounded bg-industrial-950 border border-cyan-500 text-cyan-300 text-xs font-mono focus:outline-none"
                              placeholder="e.g. PT-101"
                              autoFocus
                            />
                            {validationError && (
                              <p className="text-[10px] text-red-400 leading-tight">{validationError}</p>
                            )}
                          </div>
                        ) : (
                          <span className="font-bold text-slate-100">{tag.normalized_tag}</span>
                        )}
                      </td>

                      {/* Type / Category */}
                      <td className="py-3 px-4 text-slate-300">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="px-2 py-1 rounded bg-industrial-950 border border-industrial-700 text-slate-200 text-xs focus:outline-none"
                          />
                        ) : (
                          <div>
                            <span>{tag.type}</span>
                            <span className="text-[10px] text-slate-500 block uppercase font-mono">
                              {tag.category}
                            </span>
                          </div>
                        )}
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
                          size="sm"
                        >
                          {Math.round(tag.confidence * 100)}%
                        </Badge>
                      </td>

                      {/* IO Match */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {tag.io_match?.matched ? (
                          <span className="text-emerald-400 font-semibold">{tag.io_match.io_tag}</span>
                        ) : (
                          <span className="text-slate-500 italic">No match</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono capitalize ${
                            tag.status === 'resolved'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : tag.status === 'needs_review'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {tag.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSave(tag.id)}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded-lg bg-industrial-800 text-slate-400 hover:bg-industrial-700"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(tag)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-industrial-800 transition-colors"
                            title="Edit Tag"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No tags in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
