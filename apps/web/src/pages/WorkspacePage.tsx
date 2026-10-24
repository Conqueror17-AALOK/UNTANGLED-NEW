import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  Columns,
  ChevronRight,
  Download
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
  const [inspectorTab, setInspectorTab] = useState<'telemetry' | 'confidence' | 'traceability'>('telemetry');

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

  // Touch Handlers for Mobile & Tablet Viewports
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };

  const handleTouchEnd = () => setIsDragging(false);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-industrial-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white">
            Process Topology
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Job {jobId.slice(0, 8)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/v1/jobs/${jobId}/simplified-diagram/pdf`}
            download={`simplified_diagram_${jobId.slice(0, 8)}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="primary" size="sm" className="font-mono text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white">
              <Download size={13} />
              <span>Download PDF</span>
            </Button>
          </a>

          <Button
            variant={showBeforeAfter ? 'engineering' : 'secondary'}
            size="sm"
            onClick={() => setShowBeforeAfter(!showBeforeAfter)}
            className="font-mono text-xs"
          >
            <Columns size={13} />
            <span>Compare View</span>
          </Button>

          <Link to={`/review/${jobId}`}>
            <Button variant="secondary" size="sm" className="font-mono text-xs">
              <CheckCircle2 size={13} className="text-amber-400" />
              <span>Review Queue</span>
            </Button>
          </Link>

          <Link to={`/report/${jobId}`}>
            <Button variant="secondary" size="sm" className="font-mono text-xs">
              <FileSpreadsheet size={13} className="text-cyan-400" />
              <span>Audit Report</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Workspace Layout (Canvas + Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Canvas Area (Col span 2) */}
        <div className="lg:col-span-2 space-y-3">
          
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-industrial-900/90 border border-industrial-800 text-xs">
            
            {/* Layer Toggles */}
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-mono text-[11px] px-1.5 uppercase font-medium">
                Layers:
              </span>
              {(['all', 'equipment', 'instrument', 'valve'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(layer)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase transition-colors ${
                    activeLayer === layer
                      ? 'bg-industrial-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-white'
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
                className="p-1.5 rounded-lg bg-industrial-800/80 hover:bg-industrial-700 text-slate-300 hover:text-white border border-industrial-700 transition-colors shadow-sm"
                title="Zoom In (+)"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
                className="p-1.5 rounded-lg bg-industrial-800/80 hover:bg-industrial-700 text-slate-300 hover:text-white border border-industrial-700 transition-colors shadow-sm"
                title="Zoom Out (-)"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={resetViewport}
                className="p-1.5 rounded-lg bg-industrial-800/80 hover:bg-industrial-700 text-slate-300 hover:text-white border border-industrial-700 transition-colors shadow-sm"
                title="Reset View (0)"
              >
                <RotateCcw size={14} />
              </button>
              <span className="text-[11px] font-mono text-cyan-400 px-2 font-bold tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
            </div>

          </div>

          {/* SVG CAD Canvas Box */}
          <div className="h-[400px] sm:h-[480px] lg:h-[560px] relative overflow-hidden bg-[#08090d] border border-[#1e222d] rounded-lg select-none">
            {/* Coordinate Grid & Interactive Canvas */}
            <div
              className="absolute inset-0 cursor-grab active:cursor-grabbing bg-cad-grid touch-none z-0"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <svg className="w-full h-full">
                <defs>
                  {/* Process Arrowhead */}
                  <marker
                    id="cad-arrow-process"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                  </marker>

                  {/* Signal Arrowhead */}
                  <marker
                    id="cad-arrow-signal"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#a855f7" />
                  </marker>
                </defs>

                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  
                  {/* Process & Signal Edges */}
                  {visibleEdges.map((edge) => {
                    const src = graph?.nodes.find((n) => n.id === edge.source);
                    const tgt = graph?.nodes.find((n) => n.id === edge.target);
                    if (!src || !tgt) return null;

                    const isProcess = edge.line_type === 'process';
                    const strokeColor = isProcess ? '#38bdf8' : '#a855f7';
                    const marker = isProcess ? 'url(#cad-arrow-process)' : 'url(#cad-arrow-signal)';

                    return (
                      <g key={edge.id}>
                        <line
                          x1={src.x}
                          y1={src.y}
                          x2={tgt.x}
                          y2={tgt.y}
                          stroke={strokeColor}
                          strokeWidth={isProcess ? 2.2 : 1.5}
                          strokeDasharray={isProcess ? undefined : '4,4'}
                          markerEnd={edge.directed ? marker : undefined}
                          opacity={0.85}
                        />
                      </g>
                    );
                  })}

                  {/* Nodes Rendered with Authentic ISA-5.1 Shapes */}
                  {visibleNodes.map((node) => {
                    const isSelected = selectedNode?.id === node.id;
                    const isHighConf = node.confidence >= 0.85;
                    const isMedConf = node.confidence >= 0.60 && node.confidence < 0.85;
                    const haloColor = isHighConf ? '#10b981' : isMedConf ? '#f59e0b' : '#ef4444';

                    // Parse tag prefix and loop number
                    const parts = node.id.split('-');
                    const prefix = parts[0] || node.id;
                    const loopNum = parts.slice(1).join('-') || '';

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
                        {/* Selected Target Ring & Crosshairs */}
                        {isSelected && (
                          <g>
                            <circle
                              r="32"
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth="1.5"
                              strokeDasharray="4,3"
                              className="animate-spin"
                              style={{ animationDuration: '10s' }}
                            />
                            {/* CAD Corner Ticks */}
                            <line x1="-36" y1="0" x2="-28" y2="0" stroke="#3b82f6" strokeWidth="1.5" />
                            <line x1="28" y1="0" x2="36" y2="0" stroke="#3b82f6" strokeWidth="1.5" />
                            <line x1="0" y1="-36" x2="0" y2="-28" stroke="#3b82f6" strokeWidth="1.5" />
                            <line x1="0" y1="28" x2="0" y2="36" stroke="#3b82f6" strokeWidth="1.5" />
                          </g>
                        )}

                        {/* EQUIPMENT SYMBOL: PUMP */}
                        {node.category === 'equipment' && (
                          <g>
                            {/* Pump Circular Body */}
                            <circle
                              r="24"
                              fill="#12141c"
                              stroke={haloColor}
                              strokeWidth={isSelected ? 2.5 : 1.8}
                            />
                            {/* Tangential Nozzle Flange */}
                            <path d="M 12 -20 L 22 -30 L 8 -26 Z" fill="#38bdf8" />
                            {/* Pump Impeller Hub */}
                            <circle r="6" fill="#1e222d" stroke="#64748b" strokeWidth="1" />
                            <text
                              textAnchor="middle"
                              dy="-8"
                              fontSize="9"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#f1f5f9"
                            >
                              {node.id}
                            </text>
                            <text
                              textAnchor="middle"
                              dy="14"
                              fontSize="7.5"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#94a3b8"
                            >
                              PUMP
                            </text>
                          </g>
                        )}

                        {/* VALVE SYMBOL: CONTROL VALVE / MANUAL VALVE */}
                        {node.category === 'valve' && (
                          <g>
                            {/* Double Opposing Triangles (Hourglass) */}
                            <polygon
                              points="-16,-9 16,9 16,-9 -16,9"
                              fill="#12141c"
                              stroke={haloColor}
                              strokeWidth={isSelected ? 2.2 : 1.6}
                            />
                            {/* Stem Line */}
                            <line x1="0" y1="0" x2="0" y2="-12" stroke="#94a3b8" strokeWidth="1.5" />
                            
                            {/* Actuator Dome (Control Valve) vs Handwheel (Manual) */}
                            {node.id.startsWith('CV') || node.id.startsWith('FV') ? (
                              <path d="M -10 -12 Q 0 -22 10 -12 Z" fill="#1e222d" stroke="#38bdf8" strokeWidth="1.5" />
                            ) : (
                              <line x1="-8" y1="-12" x2="8" y2="-12" stroke="#94a3b8" strokeWidth="2" />
                            )}

                            <text
                              textAnchor="middle"
                              dy="20"
                              fontSize="8"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#f1f5f9"
                            >
                              {node.id}
                            </text>
                          </g>
                        )}

                        {/* INSTRUMENT SYMBOL: ISA-5.1 BUBBLE */}
                        {node.category === 'instrument' && (
                          <g>
                            {/* Outer ISA Bubble Circle */}
                            <circle
                              r="23"
                              fill="#12141c"
                              stroke={haloColor}
                              strokeWidth={isSelected ? 2.2 : 1.6}
                            />
                            {/* Horizontal Dividing Line (DCS panel vs field) */}
                            <line
                              x1="-23"
                              y1="0"
                              x2="23"
                              y2="0"
                              stroke="#2b3145"
                              strokeWidth="1"
                            />

                            {/* Function Prefix (Top Half) */}
                            <text
                              textAnchor="middle"
                              dy="-4"
                              fontSize="9.5"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#f1f5f9"
                            >
                              {prefix}
                            </text>

                            {/* Loop Number (Bottom Half) */}
                            <text
                              textAnchor="middle"
                              dy="12"
                              fontSize="8.5"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#94a3b8"
                            >
                              {loopNum || prefix}
                            </text>
                          </g>
                        )}

                        {/* Small Confidence Pill Badge Below Node */}
                        <g transform="translate(0, 27)">
                          <rect
                            x="-14"
                            y="0"
                            width="28"
                            height="11"
                            rx="2"
                            fill="#090a0f"
                            stroke={haloColor}
                            strokeWidth="0.8"
                          />
                          <text
                            x="0"
                            y="8.5"
                            textAnchor="middle"
                            fontSize="7.5"
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight="bold"
                            fill={haloColor}
                          >
                            {Math.round(node.confidence * 100)}%
                          </text>
                        </g>

                      </g>
                    );
                  })}

                </g>
              </svg>
            </div>

            {/* Canvas Footer Legend */}
            <div className="absolute bottom-3 left-3 bg-[#12141c]/95 backdrop-blur-md px-3 py-1.5 rounded border border-[#1e222d] text-[10px] font-mono flex items-center gap-4 text-[#94a3b8]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> ≥85% Auto Validated
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> 60–85% Needs Review
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#38bdf8]" /> Process Piping
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#a855f7] border-b border-dashed" /> Electrical Loop
              </span>
            </div>

          </div>

          {/* Before & After Comparison Split View */}
          {showBeforeAfter && (
            <Card variant="glass" className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Columns size={14} className="text-cyan-400" />
                  <span>Comparison View</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-40 rounded-lg border border-industrial-800 overflow-hidden text-xs">
                {/* Before: Raw Drawing */}
                <div className="bg-industrial-950 p-4 flex flex-col justify-between border-r border-industrial-800">
                  <span className="font-mono text-[10px] text-amber-400">ORIGINAL P&ID</span>
                  <div className="my-auto text-center font-mono">
                    <p className="text-slate-400">Scanned Engineering Drawing</p>
                    <p className="font-bold text-amber-300 mt-1">Raw OCR: PT10l · PCV-101</p>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Unstructured symbols</span>
                </div>

                {/* After: Synthesized Process Topology */}
                <div className="bg-industrial-900/60 p-4 flex flex-col justify-between">
                  <span className="font-mono text-[10px] text-emerald-400">RESOLVED TOPOLOGY</span>
                  <div className="my-auto text-center font-mono">
                    <p className="text-slate-400">Clean Orthogonal Graph</p>
                    <p className="font-bold text-emerald-300 mt-1">PT-101 (Channel AI-01)</p>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-mono">ISA-5.1 Validated</span>
                </div>
              </div>
            </Card>
          )}

        </div>

        {/* Right Sidebar: Tag Details */}
        <div className="space-y-4">
          <Card variant="glass" className="p-4 space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-industrial-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Tag Details
              </h2>
              {selectedTag && (
                <Badge
                  variant={
                    selectedTag.confidence >= 0.85
                      ? 'high'
                      : selectedTag.confidence >= 0.60
                      ? 'medium'
                      : 'low'
                  }
                  size="xs"
                >
                  {Math.round(selectedTag.confidence * 100)}%
                </Badge>
              )}
            </div>

            {selectedNode && selectedTag ? (
              <div className="space-y-4 text-xs font-mono">
                
                {/* Tag Identity Block */}
                <div className="p-3 rounded-lg bg-industrial-950 border border-industrial-800 flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold text-white block">
                      {selectedTag.normalized_tag}
                    </span>
                    <span className="text-[11px] text-slate-400">{selectedTag.type}</span>
                  </div>
                  <Badge variant="neutral" size="xs">
                    {selectedTag.category.toUpperCase()}
                  </Badge>
                </div>

                {/* Tab Selector */}
                <div className="flex rounded-lg bg-industrial-950 p-1 border border-industrial-800 text-[11px]">
                  <button
                    onClick={() => setInspectorTab('telemetry')}
                    className={`flex-1 py-1 rounded transition-colors ${
                      inspectorTab === 'telemetry'
                        ? 'bg-industrial-800 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setInspectorTab('confidence')}
                    className={`flex-1 py-1 rounded transition-colors ${
                      inspectorTab === 'confidence'
                        ? 'bg-industrial-800 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Confidence
                  </button>
                  <button
                    onClick={() => setInspectorTab('traceability')}
                    className={`flex-1 py-1 rounded transition-colors ${
                      inspectorTab === 'traceability'
                        ? 'bg-industrial-800 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Crop
                  </button>
                </div>

                {/* Tab 1: Telemetry */}
                {inspectorTab === 'telemetry' && (
                  <div className="space-y-2 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-industrial-950 border border-industrial-800 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Raw Read:</span>
                        <span className="text-amber-300 font-bold">{selectedTag.raw_text}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">DCS Match:</span>
                        <span className="text-emerald-400 font-bold">{selectedTag.io_match?.io_tag || 'None'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Signal:</span>
                        <span className="text-slate-200">{selectedTag.io_match?.signal_type || '4-20mA'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Status:</span>
                        <span className="text-cyan-400 uppercase">{selectedTag.status}</span>
                      </div>
                    </div>

                    {selectedTag.reasoning && (
                      <div className="p-2.5 rounded-lg bg-industrial-950/60 border border-industrial-800 text-slate-400 text-[11px] leading-relaxed">
                        {selectedTag.reasoning}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Confidence Breakdown */}
                {inspectorTab === 'confidence' && (
                  <div className="space-y-2.5 text-[11px]">
                    {selectedTag.conf_breakdown ? (
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-slate-300 text-[10px] mb-1">
                            <span>OCR Consensus</span>
                            <span className="font-bold text-cyan-400">{Math.round((selectedTag.conf_breakdown.ocr || 0) * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-industrial-950 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${(selectedTag.conf_breakdown.ocr || 0) * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-300 text-[10px] mb-1">
                            <span>Symbol Match</span>
                            <span className="font-bold text-emerald-400">{Math.round((selectedTag.conf_breakdown.symbol || 0) * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-industrial-950 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(selectedTag.conf_breakdown.symbol || 0) * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-300 text-[10px] mb-1">
                            <span>DCS Verification</span>
                            <span className="font-bold text-sky-400">{Math.round((selectedTag.conf_breakdown.io_match || 0) * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-industrial-950 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-400 rounded-full" style={{ width: `${(selectedTag.conf_breakdown.io_match || 0) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-500">No score breakdown</div>
                    )}
                  </div>
                )}

                {/* Tab 3: Traceability Crop */}
                {inspectorTab === 'traceability' && (
                  <div className="space-y-2.5">
                    <div className="h-24 rounded-lg bg-industrial-950 border border-industrial-800 flex items-center justify-center p-3 text-center">
                      <div>
                        <span className="font-mono font-bold text-amber-300 text-sm block">
                          {selectedTag.raw_text}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          [{selectedTag.bbox.join(', ')}]
                        </span>
                      </div>
                    </div>

                    <Link to={`/review/${jobId}`} className="block">
                      <Button variant="secondary" size="xs" className="w-full justify-between">
                        <span>Edit Tag</span>
                        <ChevronRight size={13} />
                      </Button>
                    </Link>
                  </div>
                )}

              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs font-mono">
                Click any node on the canvas to view details.
              </div>
            )}
          </Card>
        </div>

      </div>

    </div>
  );
};
