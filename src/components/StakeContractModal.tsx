import React, { useState, useRef, useEffect, useCallback } from "react";
import { SizeCategory, TOMBSTONE_STYLES, SIZE_PRICES, UserProfile } from "../types";
import { Skull, Upload, AlertTriangle, X } from "lucide-react";
import { drawTombstone, adjustColor } from "../lib/tombstoneRenderer";

// Preview Canvas
function TombstonePreview({
  styleIdx,
  color,
  imageUrl,
}: { styleIdx: number; color: string; imageUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = 220;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = SIZE;
    canvas.height = SIZE;

    const isLightTheme = document.documentElement.getAttribute("data-theme") === "light";

    // Background
    ctx.fillStyle = isLightTheme ? "#fafafa" : "#0d0d0d";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Subtle ground line
    ctx.fillStyle = isLightTheme ? "#eaeaea" : "#141414";
    ctx.fillRect(0, SIZE - 18, SIZE, 18);

    // Draw tombstone centered with small padding
    const pad = 12;
    drawTombstone(ctx, pad, pad, SIZE - pad * 2, SIZE - pad * 2 - 14, styleIdx, 1, color);
  }, [styleIdx, color]);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Canvas tombstone */}
      <div className="border-2 border-[var(--border-secondary)] overflow-hidden shrink-0" style={{ width: SIZE, height: SIZE }}>
        <canvas ref={canvasRef} width={SIZE} height={SIZE} style={{ imageRendering: "pixelated", display: "block" }} />
      </div>

      {/* Epitaph name as HTML — clean, no canvas text artifacts */}

      {/* Uploaded image preview */}
      {imageUrl && (
        <div className="border-2 border-[var(--border-secondary)] overflow-hidden w-full">
          <div className="text-[9px] text-[var(--text-dim)] px-2 pt-1.5 pb-0.5 uppercase tracking-wider font-mono">Image</div>
          <img src={imageUrl} alt="Uploaded" className="w-full object-cover max-h-[120px]" />
        </div>
      )}

      {/* Style info */}
      <p className="text-[10px] text-[var(--text-dim)] font-mono uppercase tracking-wider text-center">
        {TOMBSTONE_STYLES[styleIdx]?.name || "Style"} · {color}
      </p>
    </div>
  );
}

// Main Modal
interface StakeContractModalProps {
  user: UserProfile | null;
  selectedStyleIdx: number;
  setSelectedStyleIdx: (idx: number) => void;
  placementSize: SizeCategory;
  setPlacementSize: (size: SizeCategory) => void;
  selectedColor: string;
  setSelectedColor: (color: string) => void;
  isLoading: boolean;
  onSubmit: (formData: { title: string; text: string; imageUrl: string; color?: string }) => void;
  onClose: () => void;
  onAuthPrompt: () => void;
}

export default function StakeContractModal({
  user,
  selectedStyleIdx,
  setSelectedStyleIdx,
  placementSize,
  setPlacementSize,
  selectedColor,
  setSelectedColor,
  isLoading,
  onSubmit,
  onClose,
  onAuthPrompt,
}: StakeContractModalProps) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [localColor, setLocalColor] = useState(selectedColor);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalColor(selectedColor); }, [selectedColor]);

  const handleColorChange = useCallback((value: string) => {
    setLocalColor(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSelectedColor(value), 40);
  }, [setSelectedColor]);

  const sizePrice = SIZE_PRICES[placementSize];

  // Upload: send raw binary (server uses express.raw)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) { setFormError("Invalid file type. Use JPG, PNG, GIF or WEBP."); return; }
    if (file.size > 5 * 1024 * 1024) { setFormError("File too large. Max 5MB."); return; }
    setIsUploading(true);
    setFormError(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) setFormError(data.error || "Upload failed.");
      else { setImageUrl(data.url); setUploadedFileName(file.name); }
    } catch { setFormError("Upload network error."); }
    finally { setIsUploading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) { setFormError("Epitaph name is required."); return; }
    if (!user) { onAuthPrompt(); return; }
    onSubmit({ title: title.trim(), text: text.trim(), imageUrl, color: selectedColor });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-[var(--bg-primary)] border-2 border-[var(--border-secondary)] w-full max-w-3xl max-h-[92vh] flex flex-col animate-slide-up overflow-hidden"
        style={{ boxShadow: "0 0 80px rgba(0,0,0,0.9)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[var(--border-secondary)] bg-[var(--bg-secondary)] shrink-0">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2">
            <Skull className="h-4 w-4 text-[var(--text-muted)]" />
            BUY GRAVE
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 cursor-pointer" title="Cancel">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: form (left) + preview (right) */}
        <div className="flex flex-1 min-h-0">
          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-5 border-r-2 border-[var(--border-secondary)]">
            {formError && (
              <div className="p-3 bg-[var(--danger-bg)] border-2 border-[var(--danger)] text-[var(--danger-text)] text-xs leading-relaxed flex items-start gap-1.5">
                <AlertTriangle className="h-4 w-4 text-[var(--danger)] shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* 1. Plot Size */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold block">1. PLOT SIZE</label>
              <div className="grid grid-cols-3 gap-2">
                {(["small", "medium", "large"] as SizeCategory[]).map((sz) => {
                  const dims = sz === "small" ? "1×1" : sz === "medium" ? "2×2" : "3×3";
                  return (
                    <button key={sz} type="button" onClick={() => setPlacementSize(sz)}
                      className={`p-3 border-2 text-xs flex flex-col items-center justify-center text-center transition-colors ${placementSize === sz ? "bg-[var(--bg-tertiary)] border-[var(--border-focus)] text-[var(--text-bright)]" : "bg-[var(--bg-input)] border-[var(--border-secondary)] text-[var(--text-muted)] hover:border-[var(--border-primary)]"}`}
                    >
                      <span className="capitalize font-bold">{sz}</span>
                      <span className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">{dims}</span>
                      <span className="text-xs text-[var(--text-secondary)] mt-1 font-bold font-mono">${SIZE_PRICES[sz]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Tombstone Style */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold block">2. TOMBSTONE STYLE</label>
              <div className="grid grid-cols-2 gap-2">
                {TOMBSTONE_STYLES.map((style) => (
                  <button key={style.index} type="button" onClick={() => setSelectedStyleIdx(style.index)}
                    className={`p-2.5 border-2 text-left flex items-center gap-2 transition-colors ${selectedStyleIdx === style.index ? "bg-[var(--bg-tertiary)] border-[var(--border-focus)] text-[var(--text-bright)]" : "bg-[var(--bg-input)] border-[var(--border-secondary)] text-[var(--text-muted)] hover:border-[var(--border-primary)]"}`}
                  >
                    <span className="w-5 h-5 border border-[var(--border-primary)] flex-shrink-0" style={{ backgroundColor: style.color }} />
                    <div className="truncate min-w-0"><div className="text-xs font-bold leading-none truncate">{style.name}</div></div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Custom Shade */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold block">3. CUSTOM SHADE</label>
              <div className="flex items-center gap-2 flex-wrap">
                {["#4b4b4b", "#3a3a3a", "#606060", "#888888", "#2d4a2d", "#4a2d2d", "#2d3a4a"].map((color) => (
                  <button key={color} type="button" onClick={() => { setSelectedColor(color); setLocalColor(color); }}
                    className={`w-7 h-7 border-2 transition-transform hover:scale-110 ${selectedColor === color ? "border-[var(--text-bright)] scale-110" : "border-[var(--border-primary)]"}`}
                    style={{ backgroundColor: color }} title={color}
                  />
                ))}
                {/* Color picker */}
                <div className="relative w-7 h-7 border-2 border-[var(--border-primary)] hover:border-[var(--border-hover)] bg-[var(--bg-input)] flex items-center justify-center cursor-pointer shrink-0">
                  <input type="color" value={localColor} onChange={(e) => handleColorChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <span className="text-sm pointer-events-none">🎨</span>
                </div>
                {/* Preview swatch */}
                <div className="w-7 h-7 border-2 border-[var(--border-focus)] shrink-0" style={{ backgroundColor: selectedColor }} title={`Current: ${selectedColor}`} />
              </div>
            </div>



            {/* 4. Epitaph Name */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold block">
                  4. EPITAPH NAME <span className="text-[var(--danger)]">*</span>
                </label>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">{title.length} / 50</span>
              </div>
              <input type="text" placeholder="e.g. Alan Turing" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={50}
                className="w-full bg-[var(--bg-input)] border-2 border-[var(--border-primary)] focus:border-[var(--border-focus)] text-[var(--text-primary)] placeholder-[var(--text-dim)] rounded-none py-2.5 px-3 text-sm font-sans outline-none transition-colors"
              />
            </div>

            {/* 5. Inscription */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold block">5. INSCRIPTION (OPTIONAL)</label>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">{text.length} / 1000</span>
              </div>
              <textarea placeholder="Words carved in stone..." value={text} onChange={(e) => setText(e.target.value)} maxLength={1000}
                className="w-full bg-[var(--bg-input)] border-2 border-[var(--border-primary)] focus:border-[var(--border-focus)] text-[var(--text-primary)] placeholder-[var(--text-dim)] rounded-none py-2.5 px-3 text-sm font-sans h-24 resize-none outline-none transition-colors"
              />
            </div>

            {/* 6. Image */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold block">6. IMAGE (OPTIONAL)</label>
                <span className="text-[10px] font-mono text-[var(--text-dim)]">MAX 5MB (JPG, PNG, GIF, WEBP)</span>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFileUpload} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                className="pixel-btn w-full px-4 py-2.5 text-xs flex items-center justify-center gap-2">
                <Upload className="h-4 w-4" />
                <span>{isUploading ? "UPLOADING..." : uploadedFileName ? uploadedFileName.slice(0, 28) : "UPLOAD IMAGE"}</span>
              </button>
            </div>

            {/* Total + CTA */}
            <div className="border-t-2 border-[var(--border-secondary)] pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--text-muted)] font-sans">PLOT ({placementSize.toUpperCase()})</span>
                <span className="text-[var(--text-secondary)]">${sizePrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold border-t border-[var(--border-secondary)] pt-2 font-mono">
                <span className="text-[var(--text-secondary)] font-sans">TOTAL</span>
                <span className="text-[var(--text-primary)]">${sizePrice.toFixed(2)}</span>
              </div>
              <button type="submit" disabled={isLoading} id="btn-buy-grave"
                className="pixel-btn-primary w-full py-3 text-xs font-bold flex items-center justify-center gap-2 font-mono">
                {isLoading ? <span className="animate-pulse-dim font-sans">PROCESSING...</span> : <><span className="font-sans">⚰</span><span>BUY GRAVE — ${sizePrice.toFixed(2)}</span></>}
              </button>
            </div>
          </form>

          {/* Live Preview */}
          <div className="w-[260px] shrink-0 flex flex-col items-center justify-start p-5 space-y-4 bg-[var(--bg-secondary)] overflow-y-auto no-scrollbar">
            <div className="w-full">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--text-muted)] mb-3 text-center">PREVIEW</p>
              <TombstonePreview
                styleIdx={selectedStyleIdx}
                color={selectedColor}
                imageUrl={imageUrl}
              />
              {/* Epitaph name rendered as HTML below the canvas */}
              {title && (
                <p className="text-xs font-bold font-mono text-center tracking-wide mt-1" style={{ color: adjustColor(selectedColor, 50) }}>
                  {title.slice(0, 28)}
                </p>
              )}
            </div>

            {/* Inscription preview */}
            {text && (
              <div className="w-full border-t border-[var(--border-secondary)] pt-3 space-y-1">
                <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] font-mono">INSCRIPTION</p>
                <p className="text-[11px] text-[var(--text-muted)] italic leading-relaxed break-words">&ldquo;{text}&rdquo;</p>
              </div>
            )}

            {/* Size summary */}
            <div className="w-full border-t border-[var(--border-secondary)] pt-3 space-y-1.5 text-[10px] font-mono text-[var(--text-dim)]">
              <div className="flex justify-between">
                <span>STYLE</span>
                <span className="text-[var(--text-muted)]">{TOMBSTONE_STYLES[selectedStyleIdx]?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>SIZE</span>
                <span className="text-[var(--text-muted)] uppercase">{placementSize}</span>
              </div>
              <div className="flex justify-between">
                <span>SHADE</span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 border border-[var(--border-primary)] inline-block" style={{ backgroundColor: selectedColor }} />
                  <span className="text-[var(--text-muted)]">{selectedColor}</span>
                </span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
