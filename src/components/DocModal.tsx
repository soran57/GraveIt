import React, { useEffect } from "react";
import { X, ShieldCheck, FileText, DollarSign, RefreshCw } from "lucide-react";

interface DocModalProps {
  docType: "terms" | "privacy" | "refund" | "pricing";
  onClose: () => void;
}

export default function DocModal({ docType, onClose }: DocModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  let title = "";
  let subtitle = "";
  let icon: React.ReactNode = null;

  if (docType === "terms") {
    title = "Terms of Use";
    subtitle = "Terms of service and liability waiver";
    icon = <FileText className="h-4 w-4" />;
  } else if (docType === "privacy") {
    title = "Privacy Policy";
    subtitle = "Privacy rules and data handling";
    icon = <ShieldCheck className="h-4 w-4" />;
  } else if (docType === "pricing") {
    title = "Plot Pricing";
    subtitle = "Staking tariff options and size details";
    icon = <DollarSign className="h-4 w-4" />;
  } else if (docType === "refund") {
    title = "Refund Policy";
    subtitle = "Voluntary donations and return rules";
    icon = <RefreshCw className="h-4 w-4" />;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center font-sans"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/90 animate-fade-in" />

      {/* Main Modal Shape */}
      <div
        className="relative animate-coffin-open border border-[var(--border-primary)] p-8 max-w-2xl w-full bg-[var(--bg-secondary)]"
        onClick={(e) => e.stopPropagation()}
        style={{
          height: "580px",
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
            className="absolute top-6 right-16 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 border-b-2 border-[var(--border-secondary)] pb-4 select-none shrink-0">
            <div className="h-9 w-9 border-2 border-[var(--border-primary)] bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)]">
              {icon}
            </div>
            <div className="text-left">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] leading-none">
                {title}
              </h2>
              <p className="text-[9px] mt-1 text-[var(--text-muted)] tracking-wider uppercase font-bold">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Document Content (Scrollable text area) */}
          <div className="flex-1 overflow-y-auto my-5 pr-2 text-left space-y-4 text-xs text-[var(--text-secondary)] leading-relaxed no-scrollbar">
            {docType === "terms" && (
              <>
                <h3 className="text-[var(--text-primary)] font-bold font-mono">1. Virtual Services & Voluntary Donations</h3>
                <p>
                  All transactions made on the GraveIt platform (including payment for virtual cemetery plots, tombstone styles, and custom shades) are considered voluntary, non-refundable donations supporting my project's development and hosting. They do not constitute the purchase of physical land, legal property, or any guaranteed ongoing services.
                </p>

                <h3 className="text-[var(--text-primary)] font-bold font-mono">2. Full Disclaimer of Warranties & Liability ("AS IS")</h3>
                <p>
                  The platform is provided on an "AS IS" and "AS AVAILABLE" basis. I assume no responsibility and provide no warranties regarding server uptime, database persistence, domain availability, malicious attacks, force majeure events, or the continuous operation of the digital cemetery.
                </p>
                <p>
                  In the event of data loss, database corruption, or project closure, your virtual plots and epitaphs may disappear permanently. You agree that I am not liable for restoring your virtual graves or compensating any virtual or real-world losses.
                </p>

                <h3 className="text-[var(--text-primary)] font-bold font-mono">3. Strict No-Refund Policy</h3>
                <p>
                  Because all transactions are classified as voluntary, non-refundable donations, refunds are technically and legally unavailable under any circumstances.
                </p>

                <h3 className="text-[var(--text-primary)] font-bold font-mono">4. Content & Moderation</h3>
                <p>
                  I reserve the right, at my sole discretion and without prior notice, to edit or delete virtual graves, epitaphs, images, or keeper avatars that contain offensive material, spam, copyright violations, or violate any internal guidelines.
                </p>
              </>
            )}

            {docType === "privacy" && (
              <>
                <h3 className="text-[var(--text-primary)] font-bold font-mono">1. Collection of Personal Information</h3>
                <p>
                  I only collect public, basic details from your Google Account during login (specifically your email address, display name, and profile avatar). This information is used solely to authenticate your session and link your created virtual graves to your account.
                </p>

                <h3 className="text-[var(--text-primary)] font-bold font-mono">2. Payment Processing</h3>
                <p>
                  I do not collect, process, or store your credit card details or financial information. All transaction processing is securely handled by third-party processors (such as Stripe, Paddle, Lemon Squeezy, or crypto payment processors).
                </p>

                <h3 className="text-[var(--text-primary)] font-bold font-mono">3. Third-Party Data Sharing</h3>
                <p>
                  Your personal details are strictly confidential. I do not sell, trade, or transfer your authentication details to any external third parties.
                </p>

                <h3 className="text-[var(--text-primary)] font-bold font-mono">4. Security & Session Management</h3>
                <p>
                  User sessions are secured using cryptographically signed JSON Web Tokens (JWT). While I implement security measures to protect my project, you acknowledge that no method of online transmission or storage is completely bulletproof.
                </p>
              </>
            )}

            {docType === "pricing" && (
              <>
                <h3 className="text-[var(--text-primary)] font-bold font-mono">1. Plot Staking Tariffs</h3>
                <p>
                  Staking a plot in the digital cemetery is a one-time donation to secure coordinate ground. All standard features (including pixel shades, custom inscription, and style categories) are fully included.
                </p>
                <div className="border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3 space-y-2 font-mono text-[11px] text-[var(--text-secondary)]">
                  <div className="flex justify-between font-bold border-b border-[var(--border-primary)] pb-1.5 text-[var(--text-primary)]">
                    <span>DIMENSIONS</span>
                    <span>SIZE TYPE</span>
                    <span>ONE-TIME FEE</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1 × 1 tile</span>
                    <span className="uppercase">Small</span>
                    <span className="font-bold text-[var(--text-primary)]">$4.99</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2 × 2 tiles</span>
                    <span className="uppercase">Medium</span>
                    <span className="font-bold text-[var(--text-primary)]">$9.99</span>
                  </div>
                  <div className="flex justify-between">
                    <span>3 × 3 tiles</span>
                    <span className="uppercase">Large</span>
                    <span className="font-bold text-[var(--text-primary)]">$14.99</span>
                  </div>
                </div>
                <h3 className="text-[var(--text-primary)] font-bold font-mono">2. Plot Constraints & Limits</h3>
                <p>
                  To prevent ledger bloat and ensure beautiful rendering, the following limits are strictly enforced:
                </p>
                <div className="border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-3 space-y-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
                  <div>• <strong>Epitaph Title:</strong> Max 50 characters.</div>
                  <div>• <strong>Inscription Text:</strong> Max 1000 characters.</div>
                  <div>• <strong>Image Uploads:</strong> Max 5MB file size (JPG, PNG, GIF, WEBP).</div>
                </div>

                <h3 className="text-[var(--text-primary)] font-bold font-mono">3. Hosting & Maintenance</h3>
                <p>
                  There are no hidden recurring hosting fees or subscription plans. Once a grave is sealed, it remains staked eternally as long as the digital cemetery exists.
                </p>
              </>
            )}

            {docType === "refund" && (
              <>
                <h3 className="text-[var(--text-primary)] font-bold font-mono">1. Voluntary Donations</h3>
                <p>
                  All payments made on the GraveIt platform (including payment for virtual cemetery plots, tombstone styles, and custom shades) are considered voluntary donations supporting my project's ongoing development, maintenance, and hosting costs. They do not constitute purchases of real-world land or guaranteed assets.
                </p>

                <h3 className="text-[var(--text-primary)] font-bold font-mono">2. Strict No-Refund Policy</h3>
                <p>
                  Because all transactions are processed as voluntary, non-refundable donations, refunds are completely unavailable under any circumstances. By staking a plot and confirming your transaction, you acknowledge and agree to this policy.
                </p>

                <h3 className="text-[var(--text-primary)] font-bold font-mono">3. Account or Content Removal</h3>
                <p>
                  In the event that a user's grave or account is edited or deleted due to terms violations (such as posting offensive, hateful, or copyrighted material), the donor is not entitled to a refund or compensation of any kind.
                </p>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
