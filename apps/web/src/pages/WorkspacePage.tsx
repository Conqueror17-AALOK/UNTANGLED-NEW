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

  const rafPanRef = React.useRef<number | null>(null);

  // Pan & Zoom Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    if (rafPanRef.current) cancelAnimationFrame(rafPanRef.current);
    rafPanRef.current = requestAnimationFrame(() => {
      setPan({ x: newX, y: newY });
      rafPanRef.current = null;
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (rafPanRef.current) {
      cancelAnimationFrame(rafPanRef.current);
      rafPanRef.current = null;
    }
  };

  // Touch Handlers for Mobile & Tablet Viewports
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const newX = e.touches[0].clientX - dragStart.x;
    const newY = e.touches[0].clientY - dragStart.y;
    if (rafPanRef.current) cancelAnimationFrame(rafPanRef.current);
    rafPanRef.current = requestAnimationFrame(() => {
      setPan({ x: newX, y: newY });
      rafPanRef.current = null;
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (rafPanRef.current) {
      cancelAnimationFrame(rafPanRef.current);
      rafPanRef.current = null;
    }
  };

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

  // Memoize node lookup map for O(1) edge target rendering
  const nodeMap = React.useMemo(() => {
    const map = new Map<string, GraphNode>();
    if (graph?.nodes) {
      for (const node of graph.nodes) {
        map.set(node.id, node);
      }
    }
    return map;
  }, [graph?.nodes]);

  // Filter nodes based on layer with useMemo
  const visibleNodes = React.useMemo(() => {
    if (!graph?.nodes) return [];
    if (activeLayer === 'all') return graph.nodes;
    return graph.nodes.filter((node) => node.category === activeLayer);
  }, [graph?.nodes, activeLayer]);

  const visibleEdges = React.useMemo(() => {
    if (!graph?.edges) return [];
    const idSet = new Set(visibleNodes.map((n) => n.id));
    return graph.edges.filter(
      (e) => idSet.has(e.source) && idSet.has(e.target)
    );
  }, [graph?.edges, visibleNodes]);

  return (
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 h-full flex flex-col min-h-0 space-y-3 animate-fade-in font-sans">
      
      {/* Refined Engineering Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#434856] shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-100 tracking-tight mb-0.5">
            Process Topology
          </h1>
          <p className="text-xs text-slate-400 font-normal">
            Interactive ISA-5.1 verified process diagram with live telemetry & cross-validation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/v1/jobs/${jobId}/simplified-diagram/pdf`}
            download={`simplified_diagram_${jobId.slice(0, 8)}.pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <button className="bg-slate-100 text-slate-900 font-medium h-8 px-3 rounded-lg flex items-center gap-2 hover:bg-white transition-all text-xs">
              <Download size={13} />
              <span>Download PDF</span>
            </button>
          </a>

          <button
            onClick={() => setShowBeforeAfter(!showBeforeAfter)}
            className={`h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
              showBeforeAfter
                ? 'bg-[#3f4554] text-white border-[#525869]'
                : 'bg-[#323642] text-slate-300 border-[#434856] hover:bg-[#3b404d]'
            }`}
          >
            <Columns size={13} />
            <span>Compare</span>
          </button>

          <Link to={`/review/${jobId}`}>
            <button className="h-8 px-3 rounded-lg border border-[#434856] bg-[#323642] text-slate-300 hover:text-white hover:bg-[#3b404d] flex items-center gap-1.5 transition-all text-xs font-medium">
              <CheckCircle2 size={13} className="text-amber-400" />
              <span>Review Queue</span>
            </button>
          </Link>

          <Link to={`/report/${jobId}`}>
            <button className="h-8 px-3 rounded-lg border border-[#434856] bg-[#323642] text-slate-300 hover:text-white hover:bg-[#3b404d] flex items-center gap-1.5 transition-all text-xs font-medium">
              <FileSpreadsheet size={13} className="text-blue-400" />
              <span>Audit Report</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Main Workspace Layout (Canvas + Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 h-full">
        
        {/* Canvas Area (Col span 2) */}
        <div className="lg:col-span-2 flex flex-col h-full min-h-0 space-y-2.5">
          
          {/* Controls Bar with Frosted Glassmorphism */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-xl bg-[#323642]/70 backdrop-blur-xl border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_20px_rgba(0,0,0,0.2)] text-xs shrink-0">
            
            {/* Layer Toggles */}
            <div className="flex items-center gap-1 bg-[#24272f]/70 backdrop-blur-md p-1 rounded-lg border border-white/[0.1]">
              <span className="text-slate-400 text-xs px-2 font-medium">
                Layers:
              </span>
              {(['all', 'equipment', 'instrument', 'valve'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setActiveLayer(layer)}
                  className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-all ${
                    activeLayer === layer
                      ? 'bg-white/[0.16] backdrop-blur-md text-white font-medium shadow-sm border border-white/[0.2]'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>

            {/* Pan & Zoom Controls */}
            <div className="flex items-center gap-1 pr-1">
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
                className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.1] backdrop-blur-md transition-all flex items-center justify-center shadow-sm"
                title="Zoom In (+)"
              >
                <ZoomIn size={13} />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
                className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.1] backdrop-blur-md transition-all flex items-center justify-center shadow-sm"
                title="Zoom Out (-)"
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={resetViewport}
                className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.1] backdrop-blur-md transition-all flex items-center justify-center shadow-sm"
                title="Reset View (0)"
              >
                <RotateCcw size={13} />
              </button>
              <span className="text-xs font-mono text-slate-200 px-2 font-medium tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
            </div>

          </div>

          {/* SVG CAD Canvas Box - Fits remaining height with glass border */}
          <div className="flex-1 min-h-[400px] h-full relative overflow-hidden bg-[#2b2e37]/95 border border-white/[0.12] rounded-xl select-none shadow-inner">
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
                    const src = nodeMap.get(edge.source);
                    const tgt = nodeMap.get(edge.target);
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
                    const haloColor = isHighConf ? '#10b981' : isMedConf ? '#f59e0b' : '#eb1000';

                    // Parse ISA-5.1 tag prefix and loop number accurately
                    let prefix = node.id;
                    let loopNum = '';
                    const parts = node.id.split('-');
                    if (parts.length >= 3) {
                      prefix = `${parts[0]}-${parts[1]}`;
                      loopNum = parts.slice(2).join('-');
                    } else if (parts.length === 2) {
                      prefix = parts[0];
                      loopNum = parts[1];
                    } else {
                      const m = node.id.match(/^(\d*[A-Za-z]+)(\d+.*)$/);
                      if (m) {
                        prefix = m[1];
                        loopNum = m[2];
                      }
                    }

                    const ntype = node.type.toLowerCase();
                    const tagUpper = node.id.toUpperCase();
                    const isVessel = tagUpper.startsWith('V-') || tagUpper.startsWith('C-') || tagUpper.startsWith('D-') || ntype.includes('vessel') || ntype.includes('column') || ntype.includes('separator');
                    const isTank = tagUpper.startsWith('TK-') || ntype.includes('tank');
                    const isExchanger = tagUpper.startsWith('E-') || ntype.includes('exchanger') || ntype.includes('cooler') || ntype.includes('reboiler');

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
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              strokeDasharray="4,3"
                              className="animate-spin"
                              style={{ animationDuration: '10s' }}
                            />
                            {/* Corner Ticks */}
                            <line x1="-36" y1="0" x2="-28" y2="0" stroke="#ffffff" strokeWidth="1.5" />
                            <line x1="28" y1="0" x2="36" y2="0" stroke="#ffffff" strokeWidth="1.5" />
                            <line x1="0" y1="-36" x2="0" y2="-28" stroke="#ffffff" strokeWidth="1.5" />
                            <line x1="0" y1="28" x2="0" y2="36" stroke="#ffffff" strokeWidth="1.5" />
                          </g>
                        )}

                        {/* EQUIPMENT SYMBOL: VESSEL / COLUMN / SEPARATOR */}
                        {node.category === 'equipment' && isVessel && (
                          <g>
                            <path
                              d="M -22 -20 C -22 -35, 22 -35, 22 -20 L 22 20 C 22 35, -22 35, -22 20 Z"
                              fill="#12141c"
                              stroke={haloColor}
                              strokeWidth={isSelected ? 2.5 : 1.8}
                            />
                            <line x1="-16" y1="-5" x2="16" y2="-5" stroke="#334155" strokeDasharray="3,3" />
                            <line x1="-16" y1="5" x2="16" y2="5" stroke="#334155" strokeDasharray="3,3" />
                            <text textAnchor="middle" dy="-8" fontSize="8.5" fontWeight="bold" fontFamily="JetBrains Mono, monospace" fill="#f1f5f9">
                              {node.id}
                            </text>
                            <text textAnchor="middle" dy="14" fontSize="7" fontFamily="JetBrains Mono, monospace" fill="#94a3b8">
                              VESSEL
                            </text>
                          </g>
                        )}

                        {/* EQUIPMENT SYMBOL: STORAGE TANK */}
                        {node.category === 'equipment' && isTank && !isVessel && (
                          <g>
                            <path
                              d="M -24 -15 C -12 -28, 12 -28, 24 -15 L 24 25 L -24 25 Z"
                              fill="#12141c"
                              stroke={haloColor}
                              strokeWidth={isSelected ? 2.5 : 1.8}
                            />
                            <line x1="-18" y1="0" x2="18" y2="0" stroke="#38bdf8" strokeDasharray="3,3" strokeWidth="1" opacity="0.6" />
                            <text textAnchor="middle" dy="5" fontSize="8.5" fontWeight="bold" fontFamily="JetBrains Mono, monospace" fill="#f1f5f9">
                              {node.id}
                            </text>
                            <text textAnchor="middle" dy="16" fontSize="7" fontFamily="JetBrains Mono, monospace" fill="#94a3b8">
                              TANK
                            </text>
                          </g>
                        )}

                        {/* EQUIPMENT SYMBOL: HEAT EXCHANGER */}
                        {node.category === 'equipment' && isExchanger && !isVessel && !isTank && (
                          <g>
                            <rect x="-26" y="-16" width="52" height="32" rx="16" fill="#12141c" stroke={haloColor} strokeWidth={isSelected ? 2.5 : 1.8} />
                            <line x1="-16" y1="-3" x2="16" y2="-3" stroke="#475569" strokeDasharray="2,2" />
                            <line x1="-16" y1="3" x2="16" y2="3" stroke="#475569" strokeDasharray="2,2" />
                            <text textAnchor="middle" dy="-4" fontSize="8" fontWeight="bold" fontFamily="JetBrains Mono, monospace" fill="#f1f5f9">
                              {node.id}
                            </text>
                            <text textAnchor="middle" dy="8" fontSize="6.5" fontFamily="JetBrains Mono, monospace" fill="#94a3b8">
                              HEX
                            </text>
                          </g>
                        )}

                        {/* EQUIPMENT SYMBOL: PUMP */}
                        {node.category === 'equipment' && !isVessel && !isTank && !isExchanger && (
                          <g>
                            <circle
                              r="24"
                              fill="#141414"
                              stroke={haloColor}
                              strokeWidth={isSelected ? 2.5 : 1.8}
                            />
                            <path d="M 12 -20 L 22 -30 L 8 -26 Z" fill="#38bdf8" />
                            <circle r="6" fill="#1e1e1e" stroke="#64748b" strokeWidth="1" />
                            <text
                              textAnchor="middle"
                              dy="-8"
                              fontSize="9"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#ffffff"
                            >
                              {node.id}
                            </text>
                            <text
                              textAnchor="middle"
                              dy="14"
                              fontSize="7.5"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#a3a3a3"
                            >
                              PUMP
                            </text>
                          </g>
                        )}

                        {/* VALVE SYMBOL */}
                        {node.category === 'valve' && (
                          <g>
                            <polygon
                              points="-16,-9 16,9 16,-9 -16,9"
                              fill="#141414"
                              stroke={haloColor}
                              strokeWidth={isSelected ? 2.2 : 1.6}
                            />
                            <line x1="0" y1="0" x2="0" y2="-12" stroke="#a3a3a3" strokeWidth="1.5" />
                            {/* Actuator Dome (Control Valve) vs Handwheel (Manual) */}
                            {node.id.startsWith('CV') || node.id.startsWith('FV') || node.id.startsWith('LV') || node.id.startsWith('PV') || node.id.startsWith('TV') ? (
                              <path d="M -10 -12 Q 0 -22 10 -12 Z" fill="#1e1e1e" stroke="#38bdf8" strokeWidth="1.5" />
                            ) : (
                              <line x1="-8" y1="-12" x2="8" y2="-12" stroke="#a3a3a3" strokeWidth="2" />
                            )}

                            <text
                              textAnchor="middle"
                              dy="20"
                              fontSize="8"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#ffffff"
                            >
                              {node.id}
                            </text>
                          </g>
                        )}

                        {/* INSTRUMENT SYMBOL: ISA-5.1 BUBBLE */}
                        {node.category === 'instrument' && (
                          <g>
                            <circle
                              r="23"
                              fill="#141414"
                              stroke={haloColor}
                              strokeWidth={isSelected ? 2.2 : 1.6}
                            />
                            <line
                              x1="-23"
                              y1="0"
                              x2="23"
                              y2="0"
                              stroke="#2b3145"
                              strokeWidth="1"
                            />

                            <text
                              textAnchor="middle"
                              dy="-4"
                              fontSize="9.5"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#ffffff"
                            >
                              {prefix}
                            </text>

                            <text
                              textAnchor="middle"
                              dy="12"
                              fontSize="8.5"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                              fill="#a3a3a3"
                            >
                              {loopNum || prefix}
                            </text>
                          </g>
                        )}

                        {/* Confidence Pill Badge Below Node */}
                        <g transform="translate(0, 27)">
                          <rect
                            x="-14"
                            y="0"
                            width="28"
                            height="11"
                            rx="5.5"
                            fill="#24272f"
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

            {/* Canvas Footer Legend - Docked Frosted Glass Pill Strip */}
            <div className="absolute bottom-3 left-3 bg-[#282b33]/80 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/[0.15] shadow-lg shadow-black/25 text-xs font-medium flex items-center gap-4 text-slate-200">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" /> ≥85% Validated
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" /> 60–85% Needs Review
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#38bdf8]" /> Process Piping
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#a855f7] border-b border-dashed" /> Electrical Loop
              </span>
            </div>

          </div>

          {/* Before & After Comparison Split View with Glassmorphism */}
          {showBeforeAfter && (
            <div className="adobe-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Columns size={15} className="text-white" />
                  <span>Before & After Comparison</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-36 rounded-xl border border-white/[0.1] overflow-hidden text-xs">
                {/* Before: Raw Drawing */}
                <div className="bg-[#24272f]/60 backdrop-blur-md p-3.5 flex flex-col justify-between border-r border-white/[0.08]">
                  <span className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">ORIGINAL P&ID DRAWING</span>
                  <div className="my-auto text-center font-mono">
                    <p className="text-slate-400 font-medium">Scanned Legacy Drawing</p>
                    <p className="font-semibold text-amber-300 mt-1">Raw OCR: PT10l · PCV-101</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">Unstructured symbols & scan skew</span>
                </div>

                {/* After: Synthesized Process Topology */}
                <div className="bg-[#24272f]/60 backdrop-blur-md p-3.5 flex flex-col justify-between">
                  <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">RESOLVED TOPOLOGY</span>
                  <div className="my-auto text-center font-mono">
                    <p className="text-slate-400 font-medium">Orthogonal ISA-5.1 Graph</p>
                    <p className="font-semibold text-emerald-300 mt-1">PT-101 (Channel AI-01)</p>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-normal">ISA-5.1 & DCS Cross-Validated</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar: Tag Details / Inspector */}
        <div className="h-full min-h-0 flex flex-col">
          <div className="adobe-card p-4 h-full flex flex-col min-h-0">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#434856] shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Tag Inspector
              </h2>
              {selectedTag && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                  selectedTag.confidence >= 0.85
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                    : selectedTag.confidence >= 0.60
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-400/30'
                }`}>
                  {Math.round(selectedTag.confidence * 100)}%
                </span>
              )}
            </div>

            {selectedNode && selectedTag ? (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 text-xs">
                
                {/* Tag Identity Block */}
                <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] flex items-center justify-between">
                  <div>
                    <span className="text-lg font-semibold text-slate-100 block tracking-tight font-mono">
                      {selectedTag.normalized_tag}
                    </span>
                    <span className="text-xs text-slate-400 font-normal">{selectedTag.type}</span>
                  </div>
                  <span className="adobe-chip text-xs">
                    {selectedTag.category.toUpperCase()}
                  </span>
                </div>

                {/* Tab Selector - Docked Pill Strip */}
                <div className="flex rounded-lg bg-[#24272f] p-1 border border-[#434856] text-xs">
                  <button
                    onClick={() => setInspectorTab('telemetry')}
                    className={`flex-1 py-1 rounded-md transition-all text-xs ${
                      inspectorTab === 'telemetry'
                        ? 'bg-[#3f4554] text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-white font-medium'
                    }`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setInspectorTab('confidence')}
                    className={`flex-1 py-1 rounded-md transition-all text-xs ${
                      inspectorTab === 'confidence'
                        ? 'bg-[#3f4554] text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-white font-medium'
                    }`}
                  >
                    Confidence
                  </button>
                  <button
                    onClick={() => setInspectorTab('traceability')}
                    className={`flex-1 py-1 rounded-md transition-all text-xs ${
                      inspectorTab === 'traceability'
                        ? 'bg-[#3f4554] text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-white font-medium'
                    }`}
                  >
                    Crop
                  </button>
                </div>

                {/* Tab 1: Telemetry */}
                {inspectorTab === 'telemetry' && (
                  <div className="space-y-2 text-xs font-mono">
                    <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans font-medium">Raw Read:</span>
                        <span className="text-amber-300 font-medium">{selectedTag.raw_text}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans font-medium">DCS Match:</span>
                        <span className="text-emerald-400 font-medium">{selectedTag.io_match?.io_tag || 'None'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans font-medium">Signal:</span>
                        <span className="text-slate-200 font-medium">{selectedTag.io_match?.signal_type || '4-20mA'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans font-medium">Status:</span>
                        <span className="text-emerald-400 uppercase font-medium">{selectedTag.status}</span>
                      </div>
                    </div>

                    {selectedTag.reasoning && (
                      <div className="p-3 rounded-lg bg-[#24272f] border border-[#434856] text-slate-300 text-xs leading-relaxed font-sans font-normal">
                        {selectedTag.reasoning}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Confidence Breakdown */}
                {inspectorTab === 'confidence' && (
                  <div className="space-y-3 text-xs">
                    {selectedTag.conf_breakdown ? (
                      <div className="space-y-3 p-3 rounded-lg bg-[#24272f] border border-[#434856]">
                        <div>
                          <div className="flex justify-between text-slate-300 text-xs mb-1 font-medium">
                            <span>OCR Consensus</span>
                            <span className="font-medium text-slate-100">{Math.round((selectedTag.conf_breakdown.ocr || 0) * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1e2026] rounded-full overflow-hidden">
                            <div className="h-full bg-slate-200 rounded-full" style={{ width: `${(selectedTag.conf_breakdown.ocr || 0) * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-300 text-xs mb-1 font-medium">
                            <span>Symbol Match</span>
                            <span className="font-medium text-emerald-400">{Math.round((selectedTag.conf_breakdown.symbol || 0) * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1e2026] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(selectedTag.conf_breakdown.symbol || 0) * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-300 text-xs mb-1 font-medium">
                            <span>DCS Verification</span>
                            <span className="font-medium text-blue-400">{Math.round((selectedTag.conf_breakdown.io_match || 0) * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1e2026] rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(selectedTag.conf_breakdown.io_match || 0) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-500 font-normal">No score breakdown</div>
                    )}
                  </div>
                )}

                {/* Tab 3: Traceability Crop */}
                {inspectorTab === 'traceability' && (
                  <div className="space-y-3">
                    <div className="h-28 rounded-lg bg-[#24272f] border border-[#434856] flex items-center justify-center p-3 text-center">
                      <div>
                        <span className="font-mono font-medium text-amber-300 text-sm block">
                          {selectedTag.raw_text}
                        </span>
                        <span className="text-xs text-slate-500 font-mono block mt-1">
                          [{selectedTag.bbox.join(', ')}]
                        </span>
                      </div>
                    </div>

                    <Link to={`/review/${jobId}`} className="block">
                      <button className="w-full h-8 rounded-lg border border-[#434856] bg-[#24272f] text-slate-200 font-medium hover:bg-[#323642] flex items-center justify-between px-3 transition-all text-xs">
                        <span>Edit Tag</span>
                        <ChevronRight size={14} />
                      </button>
                    </Link>
                  </div>
                )}

              </div>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs font-normal">
                Click any node on the canvas to view details.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

