import React, { useEffect, useRef, useState, useCallback } from "react";
import { Grave, UserProfile, TOMBSTONE_STYLES } from "../types";
import { X, MapPin, Ruler, Trash2, Loader2 } from "lucide-react";
import { drawTombstone } from "../lib/tombstoneRenderer";
import { apiFetch, ApiError } from "../lib/api";

function GraveMiniPreview({ styleIdx, color }: { styleIdx: number; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const SIZE = 88;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = SIZE;
    canvas.height = SIZE;

    const isLightTheme = document.documentElement.getAttribute("data-theme") === "light";
    ctx.fillStyle = isLightTheme ? "#fafafa" : "#0d0d0d";
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = isLightTheme ? "#eaeaea" : "#141414";
    ctx.fillRect(0, SIZE - 8, SIZE, 8);

    const pad = 4;
    drawTombstone(ctx, pad, pad, SIZE - pad * 2, SIZE - pad * 2 - 6, styleIdx, 1, color);
  }, [styleIdx, color]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      className="block shrink-0"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

interface KeeperPlotsModalProps {
  user: UserProfile;
  onClose: () => void;
  onTeleport: (x: number, y: number) => void;
  onGraveClick: (grave: Grave) => void;
  onGraveDeleted?: () => void; // optional callback to refresh parent
}

export default function KeeperPlotsModal({
  user,
  onClose,
  onTeleport,
  onGraveClick,
  onGraveDeleted,
}: KeeperPlotsModalProps) {
  const [myGraves, setMyGraves] = useState<Grave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Fetch ALL user graves from server (not limited to viewport)
  const fetchMyGraves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Grave[]>("/api/graves/mine");
      setMyGraves(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load your plots.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyGraves();
  }, [fetchMyGraves]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmDeleteId !== null) {
          setConfirmDeleteId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, confirmDeleteId]);

  const handleDelete = async (graveId: number) => {
    setDeletingId(graveId);
    setConfirmDeleteId(null);
    try {
      await apiFetch(`/api/graves/${graveId}`, { method: "DELETE" });
      setMyGraves((prev) => prev.filter((g) => g.id !== graveId));
      onGraveDeleted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete plot.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center font-sans"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/90 animate-fade-in" />

      {/* Confirm Delete Dialog */}
      {confirmDeleteId !== null && (
        <div
          className="relative z-[110] bg-[var(--bg-primary)] border-2 border-[var(--danger)] p-6 max-w-xs w-full mx-4 animate-slide-up shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest mb-1">⚰ Release this plot?</p>
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mb-4">
            This action is permanent. The coordinates will be freed for others to claim.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="pixel-btn flex-1 py-2 text-xs font-bold"
            >
              CANCEL
            </button>
            <button
              onClick={() => handleDelete(confirmDeleteId)}
              className="pixel-btn flex-1 py-2 text-xs font-bold bg-[var(--danger-bg)] border-[var(--danger)] text-[var(--danger-text)]"
            >
              RELEASE
            </button>
          </div>
        </div>
      )}

      {/* Main Modal Shape */}
      {confirmDeleteId === null && (
        <div
          className="relative animate-coffin-open border border-[var(--border-primary)] p-8 max-w-3xl w-full bg-[var(--bg-secondary)]"
          onClick={(e) => e.stopPropagation()}
          style={{
            height: "640px",
            clipPath: "polygon(5% 0%, 95% 0%, 100% 8%, 100% 92%, 95% 100%, 5% 100%, 0% 92%, 0% 8%)",
            background: "var(--bg-secondary)",
          }}
        >
          <div
            className="absolute inset-[4px] bg-[var(--bg-primary)] p-8 flex flex-col justify-between"
            style={{
              clipPath: "polygon(5% 0%, 95% 0%, 100% 8%, 100% 92%, 95% 100%, 5% 100%, 0% 92%, 0% 8%)",
            }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-16 text-[var(--text-muted)] hover:text-[var(--text-bright)] transition-colors cursor-pointer"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-4 border-b-2 border-[var(--border-secondary)] pb-4 select-none shrink-0">
              <div className="text-left">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] leading-none">
                  Keeper Ledger
                </h2>
                <p className="text-[9px] mt-1 text-[var(--text-muted)] tracking-wider uppercase font-bold">
                  Plots eternally staked under the key of {user.display_name}
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mt-3 p-2 bg-[var(--danger-bg)] border border-[var(--danger)] text-[var(--danger-text)] text-[10px] shrink-0">
                {error}
              </div>
            )}

            {/* Plots Grid */}
            <div className="flex-1 overflow-y-auto my-4 pr-2 no-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-full gap-2 text-[var(--text-muted)]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs">Loading your plots...</span>
                </div>
              ) : myGraves.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-10">
                  <span className="text-3xl">⚰️</span>
                  <p className="text-xs text-[var(--text-muted)] italic">
                    No plots have been staked by this account yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myGraves.map((g) => {
                    const style = TOMBSTONE_STYLES[g.style_index] || TOMBSTONE_STYLES[0];
                    const isDeleting = deletingId === g.id;
                    return (
                      <div
                        key={g.id}
                        className="pixel-card p-4 flex gap-4 hover:border-[var(--border-hover)] hover:bg-[var(--bg-tertiary)] transition-all text-left relative group"
                      >
                        {/* Grave Canvas Preview */}
                        <div
                          className="w-24 h-24 border-2 border-[var(--border-secondary)] bg-[var(--bg-input)] shrink-0 flex items-center justify-center overflow-hidden relative select-none cursor-pointer"
                          onClick={() => {
                            onGraveClick(g);
                            onTeleport(g.x_coord, g.y_coord);
                            onClose();
                          }}
                        >
                          <GraveMiniPreview styleIdx={g.style_index} color={g.color || style.color} />
                          <span className="absolute bottom-1 right-1 text-[8px] bg-black/75 px-1 font-mono text-[var(--text-muted)]">
                            #{g.id}
                          </span>
                        </div>

                        {/* Info details */}
                        <div
                          className="flex-1 min-w-0 flex flex-col justify-between cursor-pointer"
                          onClick={() => {
                            onGraveClick(g);
                            onTeleport(g.x_coord, g.y_coord);
                            onClose();
                          }}
                        >
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-[var(--text-primary)] truncate leading-snug">
                              {g.epitaph_title}
                            </h4>
                            <p className="text-[10px] text-[var(--text-muted)] line-clamp-2 italic leading-relaxed">
                              "{g.epitaph_text || "No inscription."}"
                            </p>
                          </div>

                          <div className="space-y-1 text-[9px] font-mono mt-2 border-t border-[var(--border-secondary)] pt-1.5 text-[var(--text-muted)]">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-[var(--text-dim)] font-sans"><MapPin className="h-3 w-3" /> PLOT</span>
                              <span className="text-[var(--text-secondary)]">({g.x_coord}, {g.y_coord})</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-[var(--text-dim)] font-sans"><Ruler className="h-3 w-3" /> SIZE</span>
                              <span className="text-[var(--text-secondary)] uppercase">{g.size_type}</span>
                            </div>
                          </div>
                        </div>

                        {/* Delete button — visible on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(g.id);
                          }}
                          disabled={isDeleting}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[var(--text-dim)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] cursor-pointer"
                          title="Release this plot"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border-secondary)] pt-4 select-none shrink-0 flex items-center justify-between">
              <span className="text-[9px] text-[var(--text-dim)] font-mono">
                {myGraves.length} plot{myGraves.length !== 1 ? "s" : ""} staked
              </span>
              <button
                onClick={onClose}
                className="pixel-btn px-6 py-2 text-xs font-bold font-mono"
              >
                CLOSE LEDGER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
