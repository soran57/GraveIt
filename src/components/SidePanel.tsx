import React, { useState } from "react";
import { Grave, UserProfile } from "../types";
import { Search, Compass, Scroll, UserCheck, LogOut, Github, Sun, Moon } from "lucide-react";



interface SidePanelProps {
  graves: Grave[];
  onTeleport: (x: number, y: number) => void;
  placementMode: boolean;
  setPlacementMode: (active: boolean) => void;
  readyToPlace: boolean;
  onOpenContract: () => void;
  user: UserProfile | null;
  onAuthPrompt: () => void;
  onGraveClick: (grave: Grave) => void;
  onLogout: () => void;
  onDocOpen: (type: "terms" | "privacy" | "refund" | "pricing") => void;
  onOpenKeeperPlots: () => void;
  theme: "dark" | "light";
  onThemeToggle: () => void;
}

export default function SidePanel({
  graves,
  onTeleport,
  placementMode,
  setPlacementMode,
  readyToPlace,
  onOpenContract,
  user,
  onAuthPrompt,
  onGraveClick,
  onLogout,
  onDocOpen,
  onOpenKeeperPlots,
  theme,
  onThemeToggle,
}: SidePanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGraves = graves.filter(
    (g) =>
      g.owner_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.epitaph_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedGraves = [...filteredGraves].sort(
    (a, b) => (b.views || 0) - (a.views || 0) || b.id - a.id
  );

  return (
    <div className="flex flex-col h-full border-r-2 border-[var(--border-secondary)] bg-[var(--bg-primary)] text-[var(--text-secondary)] w-[360px] shrink-0 font-sans">
      {/* Branding */}
      <div className="p-4 border-b-2 border-[var(--border-secondary)] flex items-center justify-between bg-[var(--bg-primary)] select-none">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="GraveIt Logo"
            className="h-10 w-10 border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] object-cover shrink-0"
            style={{ imageRendering: "pixelated" }}
          />
          <div className="text-left">
            <h1 className="text-base font-bold uppercase tracking-[0.2em] text-[var(--text-primary)] leading-none">
              GraveIt
            </h1>
            <p className="text-[10px] mt-1 text-[var(--text-muted)] tracking-wider uppercase font-bold">
              DIGITAL CEMETERY
            </p>
          </div>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={onThemeToggle}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1.5 border border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)] shrink-0 cursor-pointer flex items-center justify-center"
          title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
        {/* Placement Active Hint */}
        {placementMode && (
          <div className="pixel-card p-4 text-left animate-slide-up shrink-0 space-y-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full opacity-75" style={{ background: "var(--border-focus)" }} />
                <span className="relative inline-flex h-2.5 w-2.5" style={{ background: "var(--border-focus)" }} />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Placement active
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {readyToPlace
                ? "✓ Payment verified! Click any vacant cell on the map to place your grave."
                : "Fill in the details first, then purchase your grave."}
            </p>
            {!readyToPlace && (
              <button
                type="button"
                onClick={() => onOpenContract()}
                className="pixel-btn-primary w-full py-2 text-xs font-bold"
              >
                ⚰ BUY GRAVE
              </button>
            )}
            <button
              type="button"
              onClick={() => setPlacementMode(false)}
              className="pixel-btn w-full py-2 text-xs font-bold"
            >
              CANCEL
            </button>
          </div>
        )}
 
        {/* Registry */}
        {!placementMode && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-[var(--text-secondary)]">
                <Scroll className="h-4 w-4 text-[var(--text-muted)]" />
                <span>REGISTRY</span>
              </h3>
              <span className="text-[10px] bg-[var(--bg-secondary)] border border-[var(--border-secondary)] px-2 py-0.5 text-[var(--text-muted)] font-mono">
                {graves.length} PLOTS
              </span>
            </div>
 
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search by name or epitaph..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-input)] border-2 border-[var(--border-primary)] focus:border-[var(--border-focus)] text-[var(--text-primary)] placeholder-[var(--text-dim)] rounded-none py-2.5 pl-10 pr-4 text-sm font-sans outline-none transition-colors"
              />
              <Search className="absolute left-3.5 h-4 w-4 text-[var(--text-dim)]" />
            </div>
 
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 no-scrollbar">
              {sortedGraves.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-dim)] italic">No plots found.</div>
              ) : (
                sortedGraves.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { onGraveClick(g); onTeleport(g.x_coord, g.y_coord); }}
                    className="w-full p-3 text-left text-xs flex items-center justify-between border-2 border-[var(--border-secondary)] bg-[var(--bg-input)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-hover)] hover:text-[var(--text-bright)] transition-colors text-[var(--text-secondary)]"
                  >
                    <div className="truncate min-w-0 pr-2">
                      <div className="font-bold flex items-center gap-1.5 leading-none text-[var(--text-primary)]">
                        <span className="h-1.5 w-1.5 bg-[var(--text-muted)] shrink-0" />
                        <span className="truncate">{g.epitaph_title}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-1.5 flex items-center gap-2">
                        <span>by: {g.owner_name}</span>
                        <span className="text-[var(--text-dim)]">•</span>
                        <span className="text-[var(--text-muted)] font-mono flex items-center gap-0.5">👁 {g.views || 0}</span>
                      </div>
                    </div>
                    <div className="text-xs text-right font-bold shrink-0 text-[var(--text-muted)] font-mono">({g.x_coord},{g.y_coord})</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
 
      {/* Action button */}
      <div className="p-4 border-t-2 border-[var(--border-secondary)] bg-[var(--bg-secondary)] shrink-0">
        {!placementMode ? (
          <button
            onClick={() => setPlacementMode(true)}
            id="btn-trigger-placement"
            className="pixel-btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 font-mono"
          >
            <span>⚒</span>
            <span>BUY GRAVE</span>
          </button>
        ) : (
          <button
            onClick={() => setPlacementMode(false)}
            id="btn-cancel-placement"
            className="pixel-btn w-full py-2.5 text-xs font-bold font-mono"
          >
            CANCEL
          </button>
        )}
      </div>

      {/* Caretaker / User Section */}
      <div className="p-4 border-t-2 border-[var(--border-secondary)] bg-[var(--bg-secondary)] relative shrink-0">
        {user ? (
          <div
            onClick={onOpenKeeperPlots}
            className="flex items-center justify-between gap-3 pixel-card p-3 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={user.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.display_name}`}
                alt={user.display_name}
                className="h-8 w-8 border-2 border-[var(--border-primary)] bg-[var(--bg-secondary)] shrink-0"
                style={{ imageRendering: "pixelated" }}
                referrerPolicy="no-referrer"
              />
              <div className="min-w-0">
                <div className="text-[9px] text-[var(--text-muted)] leading-none uppercase font-bold">KEEPER</div>
                <div className="text-xs mt-1 text-[var(--text-primary)] flex items-center gap-1 font-medium truncate">
                  <UserCheck className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
                  <span className="truncate max-w-[120px]">{user.display_name}</span>
                </div>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onLogout(); }}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1.5 border border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--border-hover)] shrink-0"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <a
              href="/api/auth/google/login"
              className="pixel-btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12.545 10.239v3.821h5.448c-.712 3.815-4.264 5.483-7.505 5.483-4.664 0-8.47-3.83-8.47-8.543s3.806-8.543 8.47-8.543c2.316 0 4.269 1.054 5.584 2.597l2.846-2.846C18.666 0.94 16.326 0 12.545 0 5.617 0 0 5.617 0 12.545s5.617 12.545 12.545 12.545c7.228 0 12.046-5.084 12.046-12.261 0-1.121-.122-1.768-.239-2.79H12.545z" />
              </svg>
              <span>SIGN IN WITH GOOGLE</span>
            </a>
          </div>
        )}
      </div>

      {/* Terms & Links Footer */}
      <div className="p-3.5 border-t-2 border-[var(--border-secondary)] flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-[9px] text-[var(--text-dim)] font-mono bg-[var(--bg-secondary)] select-none shrink-0">
        <button onClick={() => onDocOpen("terms")} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">TERMS</button>
        <span>•</span>
        <button onClick={() => onDocOpen("privacy")} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">PRIVACY</button>
        <span>•</span>
        <button onClick={() => onDocOpen("refund")} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">REFUND</button>
        <span>•</span>
        <button onClick={() => onDocOpen("pricing")} className="hover:text-[var(--text-primary)] transition-colors cursor-pointer">PRICING</button>
        <span>•</span>
        <a 
          href="https://github.com/soran57/GraveIt" 
          target="_blank" 
          rel="noreferrer" 
          className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-0.5"
        >
          <Github className="h-3 w-3" /> GITHUB
        </a>
      </div>
    </div>
  );
}
