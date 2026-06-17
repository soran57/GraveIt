import React, { useRef, useEffect, useState } from "react";
import { Grave, SizeCategory } from "../types";
import { ZoomIn, ZoomOut, Crosshair } from "lucide-react";
import { drawTombstone } from "../lib/tombstoneRenderer";

interface GraveCanvasProps {
  graves: Grave[];
  cameraX: number;
  cameraY: number;
  zoom: number;
  setCameraX: (x: number) => void;
  setCameraY: (y: number) => void;
  setZoom: (z: number) => void;
  placementMode: boolean;
  selectedStyleIdx: number;
  placementSize: SizeCategory;
  onPlaceConfirm: (x: number, y: number) => void;
  onHoverCell: (x: number, y: number, occupied: boolean) => void;
  onGraveClick: (grave: Grave) => void;
  selectedColor?: string;
  theme?: "dark" | "light";
}

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  speedY: number;
  speedX: number;
  life: number;
}

export default function GraveCanvas({
  graves,
  cameraX,
  cameraY,
  zoom,
  setCameraX,
  setCameraY,
  setZoom,
  placementMode,
  selectedStyleIdx,
  placementSize,
  onPlaceConfirm,
  onHoverCell,
  onGraveClick,
  selectedColor,
  theme = "dark",
}: GraveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [dimensions, setDimensions] = useState(() => ({
    width: typeof window !== "undefined" ? Math.max(window.innerWidth - 360, 200) : 600,
    height: typeof window !== "undefined" ? window.innerHeight : 400,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragCameraStart, setDragCameraStart] = useState({ x: 0, y: 0 });
  const [currentGridPos, setCurrentGridPos] = useState({ x: 0, y: 0 });
  const [isHoverOccupied, setIsHoverOccupied] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [activeTooltipGrave, setActiveTooltipGrave] = useState<Grave | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const particlesRef = useRef<Particle[]>([]);
  const TILE_SIZE = 32;

  // Initialize particles once on mount with distinct size and opacity ranges (in grid coordinates)
  useEffect(() => {
    const list: Particle[] = [];
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    const vhw = Math.ceil(w / (2 * TILE_SIZE * zoom));
    const vhh = Math.ceil(h / (2 * TILE_SIZE * zoom));
    const minX = cameraX - vhw;
    const maxX = cameraX + vhw;
    const minY = cameraY - vhh;
    const maxY = cameraY + vhh;

    for (let i = 0; i < 180; i++) { // 180 particles for a rich, dense ambient atmosphere across large screens
      list.push({
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
        size: Math.random() * 3.0 + 1.5, // base size in pixels
        opacity: Math.random() * 0.4 + 0.3, // opacity range (0.3 - 0.7)
        speedX: (Math.random() - 0.5) * 0.004, // slow drift in grid coordinates
        speedY: -Math.random() * 0.006 - 0.002, // rising upwards in grid coordinates
        life: Math.random() * 200,
      });
    }
    particlesRef.current = list;
  }, []);

  // Handle Wheel Zoom (centered to cursor)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const oldZoom = zoom;
      let newZoom = oldZoom;
      if (e.deltaY < 0) {
        newZoom = Math.min(zoom + 0.15, 2.5);
      } else {
        newZoom = Math.max(zoom - 0.15, 0.5);
      }

      if (newZoom !== oldZoom) {
        const dx = (mouseX - dimensions.width / 2) / TILE_SIZE;
        const dy = (mouseY - dimensions.height / 2) / TILE_SIZE;
        const newCameraX = cameraX + dx * (1 / oldZoom - 1 / newZoom);
        const newCameraY = cameraY + dy * (1 / oldZoom - 1 / newZoom);

        setZoom(newZoom);
        setCameraX(newCameraX);
        setCameraY(newCameraY);
      }
    };
    canvas.addEventListener("wheel", handleWheelEvent, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheelEvent);
  }, [zoom, setZoom, cameraX, cameraY, setCameraX, setCameraY, dimensions]);

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(width, 200), height: Math.max(height, 200) });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const pixelToGrid = (pxX: number, pxY: number) => {
    const gridX = Math.floor((pxX - dimensions.width / 2) / (TILE_SIZE * zoom) + cameraX);
    const gridY = Math.floor((pxY - dimensions.height / 2) / (TILE_SIZE * zoom) + cameraY);
    return { x: gridX, y: gridY };
  };

  const gridToPixel = (gX: number, gY: number) => {
    const x = (gX - cameraX) * TILE_SIZE * zoom + dimensions.width / 2;
    const y = (gY - cameraY) * TILE_SIZE * zoom + dimensions.height / 2;
    return { x, y };
  };

  const checkOverlap = (colX: number, colY: number, sizeType: SizeCategory) => {
    let w = 1, h = 1;
    if (sizeType === "medium") { w = 2; h = 2; }
    else if (sizeType === "large") { w = 3; h = 3; }
    return graves.some((g) =>
      g.x_coord < colX + w && colX < g.x_coord + g.width &&
      g.y_coord < colY + h && colY < g.y_coord + g.height
    );
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    if (placementMode) {
      const grid = pixelToGrid(clickX, clickY);
      onPlaceConfirm(grid.x, grid.y);
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragCameraStart({ x: cameraX, y: cameraY });
      setActiveTooltipGrave(null);
      setTooltipPos(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const grid = pixelToGrid(curX, curY);
    setCurrentGridPos(grid);
    const occupied = checkOverlap(grid.x, grid.y, placementMode ? placementSize : "small");
    setIsHoverOccupied(occupied);
    onHoverCell(grid.x, grid.y, occupied);
    if (isDragging && !placementMode) {
      const dx = (e.clientX - dragStart.x) / (TILE_SIZE * zoom);
      const dy = (e.clientY - dragStart.y) / (TILE_SIZE * zoom);
      setCameraX(dragCameraStart.x - dx);
      setCameraY(dragCameraStart.y - dy);
      setActiveTooltipGrave(null);
      setTooltipPos(null);
    } else {
      const hovered = graves.find((g) =>
        grid.x >= g.x_coord && grid.x < g.x_coord + g.width &&
        grid.y >= g.y_coord && grid.y < g.y_coord + g.height
      );
      if (hovered && !placementMode) {
        setActiveTooltipGrave(hovered);
        setTooltipPos({ x: curX + 16, y: curY + 16 });
      } else {
        setActiveTooltipGrave(null);
        setTooltipPos(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      const dist = Math.sqrt(Math.pow(e.clientX - dragStart.x, 2) + Math.pow(e.clientY - dragStart.y, 2));
      if (dist < 4) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          const grid = pixelToGrid(clickX, clickY);
          const clickedGrave = graves.find((g) =>
            grid.x >= g.x_coord && grid.x < g.x_coord + g.width &&
            grid.y >= g.y_coord && grid.y < g.y_coord + g.height
          );
          if (clickedGrave) {
            onGraveClick(clickedGrave);
          }
        }
      }
    }
  };

  // Main Render Loop with requestAnimationFrame for smooth, continuous ambient particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      // Synchronize dimensions
      if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
      }

      // Background — dark space/earth (theme-aware)
      ctx.fillStyle = theme === "light" ? "#f5f5f5" : "#0a0a0a";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      const visibleMinY = Math.floor(cameraY - (dimensions.height / (2 * TILE_SIZE * zoom))) - 2;
      const visibleMaxY = Math.ceil(cameraY + (dimensions.height / (2 * TILE_SIZE * zoom))) + 2;
      const visibleMinX = Math.floor(cameraX - (dimensions.width / (2 * TILE_SIZE * zoom))) - 2;
      const visibleMaxX = Math.ceil(cameraX + (dimensions.width / (2 * TILE_SIZE * zoom))) + 2;

      const cellSize = TILE_SIZE * zoom;

      // 1. Draw Checkerboard Ground
      for (let y = visibleMinY; y <= visibleMaxY; y++) {
        for (let x = visibleMinX; x <= visibleMaxX; x++) {
          const pp = gridToPixel(x, y);
          const isAlt = (Math.abs(x) + Math.abs(y)) % 2 === 0;
          ctx.fillStyle = theme === "light" ? (isAlt ? "#eeeeee" : "#e8e8e8") : (isAlt ? "#0c0c0c" : "#0f0f0f");
          ctx.fillRect(pp.x, pp.y, cellSize + 0.5, cellSize + 0.5);

          if (showGrid) {
            ctx.strokeStyle = theme === "light" ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.025)";
            ctx.lineWidth = 1;
            ctx.strokeRect(pp.x, pp.y, cellSize, cellSize);
          }



          // Dirt details
          const dotSeed = Math.abs((x * 7919 + y * 5113) % 30);
          if (dotSeed < 2) {
            ctx.fillStyle = theme === "light"
              ? (dotSeed === 0 ? "rgba(0,0,0,0.03)" : "rgba(0,0,0,0.015)")
              : (dotSeed === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)");
            const dotSize = Math.max(1, zoom);
            ctx.fillRect(
              pp.x + cellSize / 4 + (dotSeed * 4 * zoom),
              pp.y + cellSize / 3 + (dotSeed * 2 * zoom),
              dotSize, dotSize
            );
          }
        }
      }

      // 3. Draw Placed Graves
      const visibleGraves = graves
        .filter((g) => {
          const gR = g.x_coord + g.width;
          const gB = g.y_coord + g.height;
          return gR >= visibleMinX && g.x_coord <= visibleMaxX &&
            gB >= visibleMinY && g.y_coord <= visibleMaxY;
        })
        .sort((a, b) => a.y_coord !== b.y_coord ? a.y_coord - b.y_coord : a.x_coord - b.x_coord);

      visibleGraves.forEach((g) => {
        const pp = gridToPixel(g.x_coord, g.y_coord);
        const wPx = g.width * TILE_SIZE * zoom;
        const hPx = g.height * TILE_SIZE * zoom;

        // Draw tombstone pixel art
        drawTombstone(ctx, pp.x, pp.y, wPx, hPx, g.style_index, zoom, g.color || "#4b4b4b", g.flowers || 0);
      });

      // Draw Hover Highlight
      if (activeTooltipGrave && !placementMode) {
        const hg = activeTooltipGrave;
        const pp = gridToPixel(hg.x_coord, hg.y_coord);
        const wPx = hg.width * TILE_SIZE * zoom;
        const hPx = hg.height * TILE_SIZE * zoom;

        ctx.strokeStyle = theme === "light" ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.55)";
        ctx.lineWidth = Math.max(1.5, 1.5 * zoom);
        ctx.setLineDash([4 * zoom, 4 * zoom]);
        ctx.strokeRect(pp.x, pp.y, wPx, hPx);
        ctx.setLineDash([]);

        ctx.fillStyle = theme === "light" ? "rgba(0, 0, 0, 0.025)" : "rgba(255, 255, 255, 0.03)";
        ctx.fillRect(pp.x, pp.y, wPx, hPx);
      }

      // 4. Draw Placement Ghost
      if (placementMode) {
        const snap = gridToPixel(currentGridPos.x, currentGridPos.y);
        let pW = 1, pH = 1;
        if (placementSize === "medium") { pW = 2; pH = 2; }
        else if (placementSize === "large") { pW = 3; pH = 3; }
        const wG = pW * TILE_SIZE * zoom;
        const hG = pH * TILE_SIZE * zoom;

        ctx.fillStyle = isHoverOccupied ? "rgba(139, 32, 32, 0.15)" : (theme === "light" ? "rgba(0, 0, 0, 0.03)" : "rgba(255, 255, 255, 0.05)");
        ctx.fillRect(snap.x, snap.y, wG, hG);
        ctx.strokeStyle = isHoverOccupied ? "#8b2020" : (theme === "light" ? "#999" : "#666");
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(snap.x, snap.y, wG, hG);
        ctx.setLineDash([]);

        ctx.globalAlpha = 0.35;
        drawTombstone(ctx, snap.x, snap.y, wG, hG, selectedStyleIdx, zoom, selectedColor || "#4b4b4b");
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = isHoverOccupied ? "#8b2020" : (theme === "light" ? "#555" : "#888");
        ctx.font = `bold ${Math.max(9, 10 * zoom)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.fillText(
          isHoverOccupied ? "OCCUPIED" : "VACANT",
          snap.x + wG / 2, snap.y - 6
        );
      }

      // 5. Draw Floating Dust Particles (world-space/grid coordinates)
      // Light theme: dark sage forest green ("62, 95, 72") that clearly contrasts with light background
      // Dark theme: soft minty fireflies ("175, 225, 190") that glow beautifully
      const particleColor = theme === "light" ? "62, 95, 72" : "175, 225, 190";
      particlesRef.current.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.life += 0.5;

        // Reset logic
        if (p.y < visibleMinY) {
          // 1. Natural drift off the top -> spawn at the bottom of the viewport
          p.x = visibleMinX + Math.random() * (visibleMaxX - visibleMinX);
          p.y = visibleMaxY + Math.random() * 2;
          p.speedX = (Math.random() - 0.5) * 0.004;
          p.speedY = -Math.random() * 0.006 - 0.002;
          p.life = Math.random() * 100;
        } else if (p.x < visibleMinX - 2 || p.x > visibleMaxX + 2 || p.y > visibleMaxY + 2) {
          // 2. Camera panned / zoomed out-of-bounds -> redistribute evenly across the active screen
          p.x = visibleMinX + Math.random() * (visibleMaxX - visibleMinX);
          p.y = visibleMinY + Math.random() * (visibleMaxY - visibleMinY);
          p.speedX = (Math.random() - 0.5) * 0.004;
          p.speedY = -Math.random() * 0.006 - 0.002;
          p.life = Math.random() * 200;
        }

        const pp = gridToPixel(p.x, p.y);
        const visibility = theme === "light" ? 0.95 : 0.75;
        const alpha = p.opacity * Math.sin(p.life / 25) * visibility;
        if (alpha > 0) {
          ctx.fillStyle = `rgba(${particleColor}, ${alpha})`;
          // Draw round firefly/spore particles, scaling their size with zoom
          ctx.beginPath();
          const pSize = Math.max(1, p.size * zoom);
          ctx.arc(pp.x, pp.y, pSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [graves, cameraX, cameraY, zoom, dimensions, placementMode, selectedStyleIdx, placementSize, currentGridPos, isHoverOccupied, showGrid, selectedColor, theme, activeTooltipGrave]);


  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* HUD */}
      <div
        className="absolute top-3 left-3 px-3 py-2 border-2 text-[10px] font-mono select-none pointer-events-none flex items-center gap-2 z-10"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-primary)",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ color: "var(--text-dim)" }}>CAM:</span>
        <span style={{ color: "var(--text-primary)" }}>{Math.round(cameraX)},{Math.round(cameraY)}</span>
        <span style={{ color: "var(--border-primary)" }}>|</span>
        <span style={{ color: "var(--text-dim)" }}>POS:</span>
        <span style={{ color: "var(--text-primary)" }}>{currentGridPos.x},{currentGridPos.y}</span>
      </div>

      {/* Top right controls */}
      <div className="absolute top-3 right-3 flex items-center gap-2 select-none z-10">
        {placementMode && (
          <div
            className="border-2 text-[10px] font-mono px-3 py-2 animate-pulse-dim flex items-center gap-1.5"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--border-primary)",
              color: "var(--text-secondary)",
            }}
          >
            <span>⚰</span>
            <span>PLACEMENT MODE</span>
          </div>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDragging(false); setActiveTooltipGrave(null); setTooltipPos(null); }}
        className={`w-full h-full block touch-none ${activeTooltipGrave && !placementMode ? "cursor-pointer" : "cursor-crosshair"}`}
      />

      {/* Informational Hover Tooltip */}
      {activeTooltipGrave && tooltipPos && (
        <div
          className="absolute z-50 border-2 pointer-events-none select-none font-mono text-[10px] p-3 shadow-lg flex flex-col gap-1.5"
          style={{
            left: `${Math.min(tooltipPos.x, dimensions.width - 210)}px`,
            top: `${Math.min(tooltipPos.y, dimensions.height - 130)}px`,
            background: "var(--bg-card)",
            borderColor: "var(--border-primary)",
            width: "190px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.6)"
          }}
        >
          {/* Header */}
          <div className="border-b border-[var(--border-secondary)] pb-1 mb-0.5">
            <div className="text-[var(--text-bright)] font-bold truncate">
              {activeTooltipGrave.epitaph_title}
            </div>
            <div className="text-[8px] text-[var(--text-dim)] uppercase tracking-wider mt-0.5">
              By {activeTooltipGrave.owner_name}
            </div>
          </div>

          {/* Inscription preview */}
          {activeTooltipGrave.epitaph_text && (
            <div className="text-[9px] text-[var(--text-muted)] italic leading-snug break-words">
              "{activeTooltipGrave.epitaph_text.slice(0, 80)}{activeTooltipGrave.epitaph_text.length > 80 ? "..." : ""}"
            </div>
          )}

          {/* Metadata */}
          <div className="text-[8px] border-t border-[var(--border-secondary)] pt-1.5 mt-0.5 space-y-1 text-[var(--text-dim)]">
            <div className="flex justify-between">
              <span>COORDS</span>
              <span className="text-[var(--text-secondary)]">({activeTooltipGrave.x_coord}, {activeTooltipGrave.y_coord})</span>
            </div>
            <div className="flex justify-between">
              <span>SIZE</span>
              <span className="text-[var(--text-secondary)] uppercase">{activeTooltipGrave.size_type}</span>
            </div>

            <div className="flex justify-between">
              <span>VIEWS</span>
              <span className="text-[var(--text-secondary)]">{activeTooltipGrave.views || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>FLOWERS</span>
              <span className="text-[var(--text-secondary)]">✿ {activeTooltipGrave.flowers || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div
        className="absolute bottom-4 right-4 border-2 p-1 flex flex-col gap-1 z-10"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border-primary)",
        }}
      >
        <button
          onClick={() => setZoom(Math.min(zoom + 0.25, 2.5))}
          className="pixel-btn p-2"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => setZoom(Math.max(zoom - 0.25, 0.5))}
          className="pixel-btn p-2"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={() => { setCameraX(0); setCameraY(0); setZoom(1.0); }}
          className="pixel-btn p-2 flex items-center justify-center"
          title="Recenter"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>

      {/* Placement hint */}
      {placementMode && (
        <div
          className="absolute bottom-4 left-4 border-2 px-4 py-3 max-w-[250px] font-mono text-left pointer-events-none select-none z-10"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-primary)",
          }}
        >
          <div className="text-[10px] font-bold" style={{ color: "var(--text-secondary)" }}>PLACE MODE</div>
          <div className="text-[9px] mt-1.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            Click vacant cell to place your grave
          </div>
        </div>
      )}
    </div>
  );
}
