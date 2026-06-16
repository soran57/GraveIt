import React, { useEffect } from "react";
import { X, ShieldAlert } from "lucide-react";

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center font-sans"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/85 animate-fade-in" />

      {/* Main Modal Shape */}
      <div
        className="relative animate-coffin-open border border-[var(--border-primary)] p-8 max-w-sm w-full bg-[var(--bg-secondary)]"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "460px",
          height: "400px",
          clipPath: "polygon(15% 0%, 85% 0%, 100% 12%, 100% 88%, 85% 100%, 15% 100%, 0% 88%, 0% 12%)",
          background: "var(--bg-secondary)",
        }}
      >
        <div
          className="absolute inset-[4px] bg-[var(--bg-primary)] p-6 flex flex-col items-center text-center justify-between"
          style={{
            clipPath: "polygon(15% 0%, 85% 0%, 100% 12%, 100% 88%, 85% 100%, 15% 100%, 0% 88%, 0% 12%)",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-20 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="space-y-5 my-auto">
            {/* Warning Header */}
            <div className="flex flex-col items-center space-y-2">
              <div className="p-2.5 bg-[var(--danger-bg)] border-2 border-[var(--danger)] text-[var(--danger-text)] inline-block">
                <ShieldAlert className="h-7 w-7 text-[var(--danger-text)]" />
              </div>
              <h2 className="text-[var(--text-primary)] text-xs font-bold uppercase tracking-wider mt-2">
                Authentication Required
              </h2>
            </div>

            {/* Inscription description */}
            <p className="text-[var(--text-secondary)] text-xs leading-relaxed max-w-[260px] mx-auto font-sans">
              To stake a plot in the digital cemetery, you must verify your identity. This prevents coordinate hijackings and claims on other keepers' ground.
            </p>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1.5 w-full">
              <a
                href="/api/auth/google/login"
                className="pixel-btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 font-mono"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.545 10.239v3.821h5.448c-.712 3.815-4.264 5.483-7.505 5.483-4.664 0-8.47-3.83-8.47-8.543s3.806-8.543 8.47-8.543c2.316 0 4.269 1.054 5.584 2.597l2.846-2.846C18.666 0.94 16.326 0 12.545 0 5.617 0 0 5.617 0 12.545s5.617 12.545 12.545 12.545c7.228 0 12.046-5.084 12.046-12.261 0-1.121-.122-1.768-.239-2.79H12.545z" />
                </svg>
                <span>SIGN IN WITH GOOGLE</span>
              </a>
              <button
                onClick={onClose}
                className="pixel-btn w-full py-2 text-xs font-bold"
              >
                RETURN TO CEMETERY
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
