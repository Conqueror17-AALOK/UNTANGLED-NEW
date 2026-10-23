import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  CheckSquare,
  FileText,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { apiClient } from '../api/client';
import { GraphData, GraphNode, Tag } from '../types';

export const WorkspacePage: React.FC = () => {
  const { jobId = 'demo-job-1' } = useParams();

  const [graph, setGraph] = useState<GraphData | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

  // Canvas Viewport State (Zoom & Pan)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Layer Filter State
  const [activeLayer, setActiveLayer] = useState<'all' | 'equipment' | 'instrument' | 'valve'>('all');
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

  useEffect(() => {
    apiClient.getGraph(jobId).then((g) => {
      setGraph(g);
      // Auto-select first node for immediate inspection
      if (g.nodes.length > 0) {
        setSelectedNode(g.nodes.find((n) => n.id === 'PT-101') || g.nodes[0]);
      }
    });
    apiClient.getTags(jobId).then(setTags);
  }, [jobId]);

  useEffect(() => {
    if (selectedNode) {
      const match = tags.find((t) => t.normalized_tag === selectedNode.id || t.id === selectedNode.tag_id);
      setSelectedTag(match || null);
    }
  }, [selectedNode, tags]);

  // Pan & Zoom Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(z + 0.15, 3));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => Math.max(z - 0.15, 0.4));
      } else if (e.key === '0') {
        e.preventDefault();
        resetViewport();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setShowBeforeAfter((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter nodes based on layer
  const visibleNodes = (graph?.nodes || []).filter((node) => {
    if (activeLayer === 'all') return true;
    return node.category === activeLayer;
  });

  const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

  const visibleEdges = (graph?.edges || []).filter(
    (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 animate-fade-in">
      
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-industrial-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <span>Simplified Process Sketch Canvas</span>
            <span className="text-xs font-mono font-normal text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              v{graph?.version || 1}
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Interactive, topological representation synthesized from P&ID drawing and validated with DCS IO List.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={showBeforeAfter ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowBeforeAfter(!showBeforeAfter)}
          >
            <SlidersHorizontal size={14} />
            <span>Before / After Split</span>
          </Button>

          <Link to={`/review/${jobId}`}>
            <Button variant="secondary" size="sm">
              <CheckSquare size={14} />
              <span>Review Queue</span>
            </Button>
          </Link>

          <Link to={`/report/${jobId}`}>
            <Button variant="outline" size="sm">
              <FileText size={14} />
              <span>Validation Report</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Workspace Layout (Canvas + Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Canvas Area (Col span 2) */}
        <div className="lg:col-span-2 space-y-3">
          
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-industrial-900 border border-industrial-800 text-xs">
            
            {/* Layer Toggles */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-mono text-[11px] px-2 flex items-center gap-1">
                <Layers size={13} /> Layer:
              </span>
              {(['all', 'equipment', 'instrument', 'valve'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(layer)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                    activeLayer === layer
                      ? 'bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-industrial-800'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>

            {/* Pan & Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
                className="p-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-300"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
                className="p-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-300"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <button
                onClick={resetViewport}
                className="p-1.5 rounded-lg bg-industrial-800 hover:bg-industrial-700 text-slate-300"
                title="Reset View"
              >
                <RotateCcw size={15} />
              </button>
              <span className="text-[11px] font-mono text-slate-400 px-1.5">
                {Math.round(zoom * 100)}%
              </span>
            </div>

          </div>

          {/* SVG Canvas Box */}
          <Card className="p-0 h-[560px] relative overflow-hidden bg-industrial-950 border-industrial-800 select-none">
            
            {/* Canvas Background Grid */}
            <div
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <svg className="w-full h-full">
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1E293D" strokeWidth="0.8" />
                  </pattern>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#06B6D4" />
                  </marker>
                  <marker id="arrow-magenta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#EC4899" />
                  </marker>
                </defs>

                <rect width="100%" height="100%" fill="url(#grid)" />

                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  
                  {/* Edges */}
                  {visibleEdges.map((edge) => {
                    const src = graph?.nodes.find((n) => n.id === edge.source);
                    const tgt = graph?.nodes.find((n) => n.id === edge.target);
                    if (!src || !tgt) return null;

                    const isProcess = edge.line_type === 'process';
                    const strokeColor = isProcess ? '#06B6D4' : '#EC4899';
                    const marker = isProcess ? 'url(#arrow)' : 'url(#arrow-magenta)';

                    return (
                      <g key={edge.id}>
                        <line
                          x1={src.x}
                          y1={src.y}
                          x2={tgt.x}
                          y2={tgt.y}
                          stroke={strokeColor}
                          strokeWidth={isProcess ? 2.5 : 1.5}
                          strokeDasharray={isProcess ? undefined : '5,5'}
                          markerEnd={edge.directed ? marker : undefined}
                          className="transition-all"
                        />
                      </g>
                    );
                  })}

                  {/* Nodes */}
                  {visibleNodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    const isHighConf = node.confidence >= 0.85;
                    const isMedConf = node.confidence >= 0.60 && node.confidence < 0.85;
                    const ringColor = isHighConf ? '#10B981' : isMedConf ? '#F59E0B' : '#EF4444';

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                        }}
                        className="cursor-pointer group"
                      >
                        {/* Outer Selection / Confidence Ring */}
                        <circle
                          r="28"
                          fill="none"
                          stroke={isSelected ? '#38BDF8' : ringColor}
                          strokeWidth={isSelected ? 3 : 2}
                          strokeDasharray={isMedConf ? '4,3' : undefined}
                          className="transition-all duration-200 group-hover:scale-110"
                        />

                        {/* Node Body */}
                        <circle
                          r="24"
                          fill="#111827"
                          stroke="#1E293D"
                          strokeWidth="1.5"
                        />

                        {/* Node Label */}
                        <text
                          textAnchor="middle"
                          dy="-2"
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="JetBrains Mono, monospace"
                          fill="#F8FAFC"
                        >
                          {node.id}
                        </text>
                        <text
                          textAnchor="middle"
                          dy="10"
                          fontSize="8"
                          fill="#94A3B8"
                        >
                          {node.type.split(' ')[0]}
                        </text>

                        {/* Confidence Tag Bottom */}
                        <rect
                          x="-16"
                          y="18"
                          width="32"
                          height="12"
                          rx="3"
                          fill="#070A12"
                          stroke={ringColor}
                          strokeWidth="1"
                        />
                        <text
                          x="0"
                          y="27"
                          textAnchor="middle"
                          fontSize="7"
                          fontFamily="monospace"
                          fontWeight="bold"
                          fill={ringColor}
                        >
                          {Math.round(node.confidence * 100)}%
                        </text>
                      </g>
                    );
                  })}

                </g>
              </svg>
            </div>

            {/* Canvas Footer Legend */}
            <div className="absolute bottom-3 left-3 bg-industrial-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-industrial-800 text-[11px] font-mono flex items-center gap-4 text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &gt;= 85% Auto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 60-85% Review
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Process Line
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Signal Line
              </span>
            </div>

          </Card>

          {/* Before & After Comparison Split View */}
          {showBeforeAfter && (
            <Card className="p-4 space-y-3 bg-industrial-950 border-cyan-500/30">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <SlidersHorizontal size={14} />
                  Before / After Side-by-Side Comparison
                </h4>
                <span className="text-[11px] text-slate-400">Cluttered Original vs Untangled Process Topology</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-64 overflow-hidden rounded-xl border border-industrial-800">
                {/* Before: Original Drawing Crop */}
                <div className="bg-slate-900 p-3 flex flex-col justify-between border-r border-industrial-800">
                  <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 w-fit">
                    BEFORE: Scanned Drawing Blueprint
                  </span>
                  <div className="my-auto text-center space-y-2 opacity-80">
                    <p className="text-xs text-slate-400 font-mono">Dense overlapping raster lines & scan grain</p>
                    <p className="text-sm font-bold text-slate-300">Raw Read: "PT10l" | "P-101A" | "CV-101"</p>
                  </div>
                  <span className="text-[10px] text-slate-500">DWG-UNT-001 (Rev A, Sheet 1)</span>
                </div>

                {/* After: Clean Operator Topology */}
                <div className="bg-industrial-900 p-3 flex flex-col justify-between">
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 w-fit">
                    AFTER: Cleaned & Cross-Validated Sketch
                  </span>
                  <div className="my-auto text-center space-y-2">
                    <p className="text-xs text-slate-300 font-mono">100% Validated against DCS IO Points</p>
                    <p className="text-sm font-bold text-cyan-400">Normalized: "PT-101" (4-20mA AI)</p>
                  </div>
                  <span className="text-[10px] text-cyan-500">Synthesized Interactive Process Topology</span>
                </div>
              </div>
            </Card>
          )}

        </div>

        {/* Right Sidebar: Visual Traceability Tag Inspector (Task Y9) */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-industrial-800">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Info size={16} className="text-cyan-400" />
                <span>Tag Inspector & Traceability</span>
              </h3>
              {selectedTag && (
                <Badge
                  variant={
                    selectedTag.confidence >= 0.85
                      ? 'high'
                      : selectedTag.confidence >= 0.60
                      ? 'medium'
                      : 'low'
                  }
                  size="sm"
                >
                  {Math.round(selectedTag.confidence * 100)}% Conf
                </Badge>
              )}
            </div>

            {selectedNode && selectedTag ? (
              <div className="space-y-4 text-xs">
                
                {/* Node Tag Header */}
                <div className="p-3 rounded-xl bg-industrial-950 border border-industrial-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-base font-bold text-cyan-300">
                      {selectedTag.normalized_tag}
                    </span>
                    <Badge variant="cyan" size="sm">{selectedTag.category}</Badge>
                  </div>
                  <p className="text-slate-300">{selectedTag.type}</p>
                </div>

                {/* Raw vs Normalized */}
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800">
                    <span className="text-slate-500 block text-[10px]">RAW OCR READ:</span>
                    <span className="text-amber-400 font-bold">{selectedTag.raw_text}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800">
                    <span className="text-slate-500 block text-[10px]">IO LIST MATCH:</span>
                    <span className="text-emerald-400 font-bold">{selectedTag.io_match?.io_tag || 'None'}</span>
                  </div>
                </div>

                {/* Multi-Signal Confidence Breakdown */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">MULTI-SIGNAL BREAKDOWN</span>
                    <span className="text-cyan-400">Score</span>
                  </div>

                  {selectedTag.conf_breakdown && (
                    <div className="space-y-1.5 font-mono text-[11px]">
                      <div>
                        <div className="flex justify-between text-slate-400 text-[10px]">
                          <span>OCR Certainty</span>
                          <span>{Math.round((selectedTag.conf_breakdown.ocr || 0) * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-industrial-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500"
                            style={{ width: `${(selectedTag.conf_breakdown.ocr || 0) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 text-[10px]">
                          <span>Symbol Template IoU</span>
                          <span>{Math.round((selectedTag.conf_breakdown.symbol || 0) * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-industrial-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${(selectedTag.conf_breakdown.symbol || 0) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 text-[10px]">
                          <span>IO Match Distance</span>
                          <span>{Math.round((selectedTag.conf_breakdown.io_match || 0) * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-industrial-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${(selectedTag.conf_breakdown.io_match || 0) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 text-[10px]">
                          <span>ISA-5.1 Grammar</span>
                          <span>{Math.round((selectedTag.conf_breakdown.grammar || 0) * 100)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-industrial-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500"
                            style={{ width: `${(selectedTag.conf_breakdown.grammar || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reasoning Quote */}
                {selectedTag.reasoning && (
                  <div className="p-3 rounded-lg bg-industrial-950 border border-industrial-800 text-[11px] text-slate-300 italic">
                    "{selectedTag.reasoning}"
                  </div>
                )}

                {/* Original Blueprint High-Res Crop Mock */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                    Source Drawing Crop:
                  </span>
                  <div className="h-28 rounded-lg bg-slate-900 border border-industrial-800 flex items-center justify-center relative overflow-hidden p-2">
                    <div className="border-2 border-dashed border-cyan-400 px-4 py-2 rounded bg-cyan-500/10 text-center">
                      <span className="font-mono font-bold text-amber-300 text-sm">{selectedTag.raw_text}</span>
                      <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                        bbox: [{selectedTag.bbox.join(', ')}]
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                Click any equipment or instrument on the canvas to inspect tag confidence & original drawing crops.
              </div>
            )}
          </Card>
        </div>

      </div>

    </div>
  );
};
