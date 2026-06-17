import React, { useEffect, useState } from "react";
import { Grave, TOMBSTONE_STYLES } from "../types";
import { X, MapPin, Calendar, User, Ruler, Eye, Flower, Share2 } from "lucide-react";

interface CoffinModalProps {
  grave: Grave;
  onClose: () => void;
  onGraveUpdate?: (updatedGrave: Grave) => void;
  onAuthPrompt?: () => void;
}

export default function CoffinModal({ grave, onClose, onGraveUpdate, onAuthPrompt }: CoffinModalProps) {
  const [isTogglingFlower, setIsTogglingFlower] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleToggleFlower = async () => {
    if (isTogglingFlower) return;
    setIsTogglingFlower(true);
    try {
      const res = await fetch(`/api/graves/${grave.id}/flower`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) {
        if (onAuthPrompt) onAuthPrompt();
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        console.error("Failed to flower grave:", errData.error || "Unknown error");
        return;
      }

      const data = await res.json();
      if (data.status === "success" && onGraveUpdate) {
        onGraveUpdate({
          ...grave,
          flowers: data.flowers,
          has_flowered: data.has_flowered,
        });
      }
    } catch (err) {
      console.error("Failed to flower grave:", err);
    } finally {
      setIsTogglingFlower(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${window.location.origin}/?grave=${grave.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const style = TOMBSTONE_STYLES[grave.style_index] || TOMBSTONE_STYLES[0];

  const isHorizontal = grave.style_index === 4;
  const modalWidth = isHorizontal ? "800px" : "580px";
  const modalMinHeight = isHorizontal ? "540px" : "720px";

  const clipPathStyle = "polygon(20% 0%, 80% 0%, 100% 10%, 100% 100%, 0% 100%, 0% 10%)";

  const metaRow = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between text-xs font-mono">
      <span className="flex items-center gap-2 text-[var(--text-dim)] font-sans">{icon}{label}</span>
      <span className="text-[var(--text-secondary)]">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-y-0 right-0 left-[360px] z-[100] flex items-center justify-center font-sans" onClick={onClose}>
      <div className="absolute inset-0 bg-black/85 animate-fade-in" />

      <div
        className="relative animate-coffin-open border border-[var(--border-secondary)]"
        onClick={(e) => e.stopPropagation()}
        style={{ width: modalWidth, minHeight: modalMinHeight, clipPath: clipPathStyle, background: "var(--bg-secondary)" }}
      >
        <div
          className="absolute inset-[4px]"
          style={{ clipPath: clipPathStyle, background: "var(--bg-primary)" }}
        >
          {/* Scrollable viewport (no clip-path itself to keep scrolling working correctly) */}
          <div className="absolute inset-0 overflow-y-auto no-scrollbar">
            <button
              onClick={onClose}
              className="absolute top-8 right-24 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors z-10 cursor-pointer"
              title="Close"
            >
              <X className="h-6 w-6" />
            </button>

            {isHorizontal ? (
              /* Sarcophagus horizontal */
              <div className="pt-10 px-10 pb-16 flex gap-8 items-center h-full min-h-[492px]">
                <div className="w-1/2 flex flex-col items-center justify-center space-y-4">
                  <div className="text-[var(--text-dim)] text-xs tracking-[0.4em] uppercase">Rest In Peace</div>
                  <h2 className="text-[var(--text-primary)] text-xl font-bold text-center leading-snug break-words max-w-[280px]">
                    {grave.epitaph_title}
                  </h2>
                  {grave.image_url && (
                    <div className="w-full max-w-[280px] border-2 border-[var(--border-secondary)] overflow-hidden shadow-lg shadow-black/50 flex items-center justify-center"
                      style={{ background: "var(--bg-tertiary)" }}>
                      <img src={grave.image_url} alt={grave.epitaph_title} className="w-full max-h-[170px] object-contain"
                        style={{ imageRendering: "pixelated" }} referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                </div>

                <div className="w-[2px] h-[340px] self-center shrink-0" style={{ background: "var(--border-secondary)" }} />

                <div className="w-1/2 flex flex-col justify-between space-y-5 h-full">
                  <div className="space-y-4">
                    <h4 className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider font-bold">INSCRIPTION</h4>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed italic break-words">
                      &ldquo;{grave.epitaph_text || "No inscription was carved upon this stone."}&rdquo;
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-[var(--border-secondary)]">
                    {metaRow(<User className="h-4 w-4" />, "CARETAKER",
                      <span className="font-semibold text-[var(--text-secondary)]">
                        {grave.owner_name}
                      </span>
                    )}
                    {metaRow(<Calendar className="h-4 w-4" />, "SEALED", new Date(grave.created_at).toLocaleDateString())}
                    {metaRow(<Eye className="h-4 w-4" />, "VISITS", <span className="font-bold">{grave.views || 0}</span>)}
                    {metaRow(<Flower className="h-4 w-4" />, "FLOWERS", <span className="font-bold">✿ {grave.flowers || 0}</span>)}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleToggleFlower}
                      disabled={isTogglingFlower}
                      className="pixel-btn flex-1 py-2 text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors duration-200"
                      style={{
                        borderColor: grave.has_flowered ? "#e91e63" : "",
                        color: grave.has_flowered ? "#e91e63" : "",
                        background: grave.has_flowered ? "rgba(233, 30, 99, 0.08)" : "",
                      }}
                    >
                      <Flower className={`h-3.5 w-3.5 ${grave.has_flowered ? "fill-current" : ""}`} />
                      {grave.has_flowered ? "REMOVE FLOWER" : "LAY FLOWER"}
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="pixel-btn flex-1 py-2 text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      {copied ? "COPIED!" : "SHARE GRAVE"}
                    </button>
                  </div>

                  <div className="text-[10px] text-[var(--text-dim)] tracking-wider text-right font-mono">
                    {style.name.toUpperCase()} • #{grave.id}
                  </div>
                </div>
              </div>
            ) : (
              /* Vertical standard layout */
              <div className="px-12 pt-14 pb-8 flex flex-col items-center text-center justify-between min-h-[712px] w-full">
                <div className="flex flex-col items-center space-y-6 w-full flex-1 min-h-[300px]">
                  <div className="space-y-2">
                    <div className="text-[var(--text-dim)] text-xs tracking-[0.4em] uppercase">Rest In Peace</div>
                    <h2 className="text-[var(--text-primary)] text-2xl font-bold leading-normal break-words max-w-[360px]">
                      {grave.epitaph_title}
                    </h2>
                  </div>

                  <div className="w-28 h-[2px]" style={{ background: "var(--border-secondary)" }} />

                  <p className="my-auto py-4 text-[var(--text-muted)] text-[13px] leading-relaxed italic max-w-[340px] break-words">
                    &ldquo;{grave.epitaph_text || "No inscription was carved upon this stone."}&rdquo;
                  </p>

                  {grave.image_url && (
                    <div className="w-full max-w-[320px] border-2 border-[var(--border-secondary)] overflow-hidden shadow-lg shadow-black/50 flex items-center justify-center"
                      style={{ background: "var(--bg-tertiary)" }}>
                      <img src={grave.image_url} alt={grave.epitaph_title} className="w-full max-h-[220px] object-contain"
                        style={{ imageRendering: "pixelated" }} referrerPolicy="no-referrer"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center w-full space-y-6 pt-4">
                  <div className="w-20 h-[2px]" style={{ background: "var(--border-secondary)" }} />

                  <div className="space-y-3.5 w-full max-w-[340px] text-left">
                    {metaRow(<User className="h-4 w-4" />, "CARETAKER",
                      <span className="font-semibold text-[var(--text-secondary)]">
                        {grave.owner_name}
                      </span>
                    )}
                    {metaRow(<Calendar className="h-4 w-4" />, "SEALED", new Date(grave.created_at).toLocaleDateString())}
                    {metaRow(<Eye className="h-4 w-4" />, "VISITS", <span className="font-bold">{grave.views || 0}</span>)}
                    {metaRow(<Flower className="h-4 w-4" />, "FLOWERS", <span className="font-bold">✿ {grave.flowers || 0}</span>)}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2.5 w-full max-w-[340px] pt-1">
                    <button
                      onClick={handleToggleFlower}
                      disabled={isTogglingFlower}
                      className="pixel-btn flex-1 py-2.5 text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors duration-200"
                      style={{
                        borderColor: grave.has_flowered ? "#e91e63" : "",
                        color: grave.has_flowered ? "#e91e63" : "",
                        background: grave.has_flowered ? "rgba(233, 30, 99, 0.08)" : "",
                      }}
                    >
                      <Flower className={`h-3.5 w-3.5 ${grave.has_flowered ? "fill-current" : ""}`} />
                      {grave.has_flowered ? "REMOVE FLOWER" : "LAY FLOWER"}
                    </button>
                    <button
                      onClick={handleCopyLink}
                      className="pixel-btn flex-1 py-2.5 text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      {copied ? "COPIED!" : "SHARE GRAVE"}
                    </button>
                  </div>

                  <div className="text-[10px] text-[var(--text-dim)] tracking-wider font-mono">
                    {style.name.toUpperCase()} • #{grave.id}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Decorative lines at fixed top/bottom bounds */}
          <div className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none" style={{ background: "var(--border-secondary)" }} />
          <div className="absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none" style={{ background: "var(--border-secondary)" }} />
        </div>
      </div>
    </div>
  );
}
