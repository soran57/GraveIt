import React, { useState, useEffect, useRef } from "react";
import GraveCanvas from "./components/GraveCanvas";
import SidePanel from "./components/SidePanel";
import CoffinModal from "./components/CoffinModal";
import AuthModal from "./components/AuthModal";
import DocModal from "./components/DocModal";
import KeeperPlotsModal from "./components/KeeperPlotsModal";
import StakeContractModal from "./components/StakeContractModal";
import { Grave, UserProfile, SizeCategory } from "./types";
import { ShieldAlert, Skull } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [graves, setGraves] = useState<Grave[]>([]);

  // Theme state
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Camera states
  const [cameraX, setCameraX] = useState(0);
  const [cameraY, setCameraY] = useState(0);
  const [zoom, setZoom] = useState(1.0);

  // Coffin Modal
  const [modalGrave, setModalGrave] = useState<Grave | null>(null);

  // Auth Modal
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Active Document Modal (Terms / Privacy / Refund / Pricing)
  const [activeDoc, setActiveDoc] = useState<"terms" | "privacy" | "refund" | "pricing" | null>(null);

  // Keeper Plots Modal
  const [showKeeperModal, setShowKeeperModal] = useState(false);

  // Placement
  const [placementMode, setPlacementMode] = useState(false);
  const [readyToPlace, setReadyToPlace] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [selectedStyleIdx, setSelectedStyleIdx] = useState(0);
  const [placementSize, setPlacementSize] = useState<SizeCategory>("small");
  const [selectedColor, setSelectedColor] = useState("#4b4b4b");

  const [isLoading, setIsLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<{ x: number; y: number } | null>(null);
  const [paddleConfig, setPaddleConfig] = useState<any>(null);
  const paddleInitializedRef = useRef(false);
  const checkoutCompletedRef = useRef<((transactionId: string) => void) | null>(null);

  const [activeTransactionId, setActiveTransactionId] = useState<string | null>(null);

  // Fetch session and handle deep linking
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});

    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setPaddleConfig(data);
        const storedTx = localStorage.getItem("active_transaction_id");
        if (storedTx) {
          fetch(`/api/payments/status?transaction_id=${storedTx}`)
            .then((res) => res.json())
            .then((statusData) => {
              if (statusData.status === "completed") {
                setActiveTransactionId(storedTx);
                setReadyToPlace(true);
                setPlacementMode(true);
                showNotif("Restored your paid plot placement session. Click a cell on the map!");
              } else if (statusData.status === "placed") {
                localStorage.removeItem("active_transaction_id");
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      showNotif("Session verified. Welcome, Caretaker.");
      window.history.replaceState({}, document.title, "/");
    }

    const graveId = params.get("grave");
    if (graveId) {
      const id = parseInt(graveId, 10);
      if (!isNaN(id)) {
        fetch(`/api/graves/${id}`)
          .then((res) => {
            if (!res.ok) throw new Error("Grave not found");
            return res.json();
          })
          .then((grave: Grave) => {
            handleTeleport(grave.x_coord, grave.y_coord);
            setModalGrave(grave);
            // Silently remove the query parameter
            const paramsCopy = new URLSearchParams(window.location.search);
            paramsCopy.delete("grave");
            const qs = paramsCopy.toString();
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + (qs ? `?${qs}` : "")
            );
          })
          .catch(() => {});
      }
    }
  }, []);

  // Viewport grave fetching (debounced to prevent high-frequency request spam on pan/zoom)
  useEffect(() => {
    const handler = setTimeout(() => {
      const vhw = Math.ceil(40 / zoom);
      const vhh = Math.ceil(30 / zoom);
      const minX = Math.floor(cameraX - vhw);
      const maxX = Math.ceil(cameraX + vhw);
      const minY = Math.floor(cameraY - vhh);
      const maxY = Math.ceil(cameraY + vhh);

      fetch(`/api/graves?min_x=${minX}&max_x=${maxX}&min_y=${minY}&max_y=${maxY}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setGraves(data);
        })
        .catch(() => {});
    }, 150);

    return () => clearTimeout(handler);
  }, [cameraX, cameraY, zoom]);

  const showNotif = (msg: string) => {
    setNotificationMsg(msg);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 4000);
  };


  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST" })
      .then((res) => res.json())
      .then(() => {
        setUser(null);
        showNotif("Logged out from the cemetery ledger.");
      });
  };



  const handleTeleport = (x: number, y: number) => {
    setCameraX(x);
    setCameraY(y);
    setZoom(1.3);
  };

  const handleGraveClick = (grave: Grave) => {
    setModalGrave(grave);
    // Increment visit count on server and update local state
    fetch(`/api/graves/${grave.id}/visit`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (data.views !== undefined) {
          setGraves((prev) =>
            prev.map((g) => (g.id === grave.id ? { ...g, views: data.views } : g))
          );
          setModalGrave((prev) => (prev && prev.id === grave.id ? { ...prev, views: data.views } : prev));
        }
      })
      .catch(() => {});
  };

  const handleSidePanelSubmit = async (formData: { title: string; text: string; imageUrl: string; color?: string; caretakerName?: string }) => {
    localStorage.setItem("temp_grave_title", formData.title);
    localStorage.setItem("temp_grave_text", formData.text);
    localStorage.setItem("temp_grave_img", formData.imageUrl);
    localStorage.setItem("temp_grave_color", formData.color || "#4b4b4b");

    let currentUser = user;
    if (!currentUser) {
      setIsLoading(true);
      try {
        const response = await fetch("/api/auth/anonymous", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_name: formData.caretakerName }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to establish caretaker session.");
        }
        const anonUser = await response.json();
        setUser(anonUser);
        currentUser = anonUser;
      } catch (err: any) {
        setIsLoading(false);
        setAlertBanner(err.message || "Authentication failed.");
        return;
      }
    }

    if (paddleConfig && paddleConfig.paddleClientToken && paddleConfig.paddlePrices[placementSize]) {
      setIsLoading(true);
      const priceId = paddleConfig.paddlePrices[placementSize];
      try {
        const paddle = (window as any).Paddle;
        if (!paddle) {
          setIsLoading(false);
          setAlertBanner("Payment gateway (Paddle) failed to load. Please check your internet connection.");
          return;
        }

        checkoutCompletedRef.current = (transactionId: string) => {
          pollPaymentStatus(transactionId);
        };

        if (!paddleInitializedRef.current) {
          const token = paddleConfig.paddleClientToken;
          if (token.startsWith("test_")) {
            paddle.Environment.set("sandbox");
          }

          paddle.Initialize({
            token: token,
            eventCallback: (event: any) => {
              if (event.name === "checkout.completed") {
                const transactionId = event.data.transaction_id;
                checkoutCompletedRef.current?.(transactionId);
              } else if (event.name === "checkout.closed") {
                setIsLoading(false);
              } else if (event.name === "checkout.error" || event.name?.includes("error")) {
                console.error("Paddle Error Event Details:", event);
              }
            }
          });
          paddleInitializedRef.current = true;
        }

        const customData: Record<string, string> = {
          user_id: String(currentUser?.id || ""),
          size_type: placementSize,
          epitaph_title: formData.title,
          color: formData.color || "#4b4b4b",
          style_index: String(selectedStyleIdx)
        };

        if (formData.text) {
          customData.epitaph_text = formData.text;
        }
        if (formData.imageUrl) {
          customData.image_url = formData.imageUrl;
        }

        paddle.Checkout.open({
          items: [{ priceId, quantity: 1 }],
          customData,
          settings: {
            theme: theme
          }
        });
      } catch (err: any) {
        setIsLoading(false);
        setAlertBanner("Failed to open checkout: " + err.message);
      }
    } else {
      setIsLoading(false);
      setReadyToPlace(true);
      setShowStakeModal(false);
      showNotif("Details confirmed! Click a vacant cell on the map.");
    }
  };


  const handlePlaceConfirm = (gridX: number, gridY: number) => {
    if (!readyToPlace) {
      showNotif("Please click 'BUY GRAVE' in the sidebar first.");
      return;
    }
    // Show confirmation instead of placing immediately
    setPendingPlacement({ x: gridX, y: gridY });
  };

  const pollPaymentStatus = (transactionId: string) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (attempts > 30) {
        clearInterval(interval);
        setIsLoading(false);
        setAlertBanner("Payment processing timed out. Please refresh the page or contact support if your payment was deducted.");
        return;
      }

      fetch(`/api/payments/status?transaction_id=${transactionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "completed") {
            clearInterval(interval);
            setIsLoading(false);
            
            localStorage.setItem("active_transaction_id", transactionId);
            setActiveTransactionId(transactionId);
            setReadyToPlace(true);
            setShowStakeModal(false);
            showNotif("Payment verified! Click a vacant cell on the map.");
          }
        })
        .catch(() => {});
    }, 2000);
  };

  const confirmPlacement = () => {
    if (!pendingPlacement) return;
    const { x: gridX, y: gridY } = pendingPlacement;
    setPendingPlacement(null);
    setIsLoading(true);
    setAlertBanner(null);

    const title = localStorage.getItem("temp_grave_title") || "Unknown";
    const text = localStorage.getItem("temp_grave_text") || "";
    const imageUrl = localStorage.getItem("temp_grave_img") || "";
    const color = localStorage.getItem("temp_grave_color") || "#4b4b4b";

    fetch("/api/graves/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x_coord: gridX,
        y_coord: gridY,
        size_type: placementSize,
        epitaph_title: title,
        epitaph_text: text,
        image_url: imageUrl,
        style_index: selectedStyleIdx,
        color: color,
        transaction_id: activeTransactionId,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        setIsLoading(false);
        if (!res.ok) { setAlertBanner(data.error || "Failed to place grave."); return; }
        showNotif("Grave eternally placed! ⚰");
        setPlacementMode(false);
        setReadyToPlace(false);
        setActiveTransactionId(null);
        localStorage.removeItem("active_transaction_id");

        // Fetch newly created grave details and open modal
        if (data.grave_id) {
          fetch(`/api/graves/${data.grave_id}`)
            .then((r) => r.json())
            .then((newGrave) => {
              setModalGrave(newGrave);
              handleTeleport(newGrave.x_coord, newGrave.y_coord);
            })
            .catch(() => {});
        }

        ["temp_grave_title","temp_grave_text","temp_grave_img","temp_grave_color"].forEach(k => localStorage.removeItem(k));
        setCameraX((x) => x + 0.0001);
      })
      .catch(() => { setIsLoading(false); setAlertBanner("Network error during placement."); });
  };

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] relative">
        {/* Notification */}
        {showNotification && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[var(--bg-secondary)] border-2 border-[var(--border-primary)] px-4 py-2.5 z-50 flex items-center gap-2.5 max-w-sm animate-slide-down select-none text-[7px]">
            <Skull className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
            <span className="text-[var(--text-secondary)]">{notificationMsg}</span>
          </div>
        )}

        {/* Alert */}
        {alertBanner && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[var(--danger-bg)] border-2 border-[var(--danger)] text-[var(--danger-text)] px-4 py-2.5 z-50 flex items-start gap-2 w-full max-w-md animate-slide-down text-[6px]">
            <ShieldAlert className="h-3.5 w-3.5 text-[var(--danger)] shrink-0 mt-0.5" />
            <div className="flex-1 text-left">
              <span className="font-bold">COLLISION: </span>
              {alertBanner}
            </div>
            <button
              onClick={() => setAlertBanner(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-[6px]"
            >
              ×
            </button>
          </div>
        )}

        {/* Sidebar */}
        <div className="w-[360px] shrink-0 h-full">
          <SidePanel
            graves={graves}
            onTeleport={handleTeleport}
            placementMode={placementMode}
            setPlacementMode={(active) => {
              setPlacementMode(active);
              if (active) setShowStakeModal(true);
              else { setReadyToPlace(false); setShowStakeModal(false); }
            }}
            readyToPlace={readyToPlace}
            onOpenContract={() => setShowStakeModal(true)}
            user={user}
            onAuthPrompt={() => setShowAuthModal(true)}
            onGraveClick={handleGraveClick}
            onLogout={handleLogout}
            onDocOpen={(type) => setActiveDoc(type)}
            onOpenKeeperPlots={() => setShowKeeperModal(true)}
            theme={theme}
            onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          />
        </div>

        {/* Canvas */}
        <div className="flex-1 h-full relative">
          <GraveCanvas
            graves={graves}
            cameraX={cameraX}
            cameraY={cameraY}
            zoom={zoom}
            setCameraX={setCameraX}
            setCameraY={setCameraY}
            setZoom={setZoom}
            placementMode={placementMode}
            selectedStyleIdx={selectedStyleIdx}
            placementSize={placementSize}
            onPlaceConfirm={handlePlaceConfirm}
            onHoverCell={() => {}}
            onGraveClick={handleGraveClick}
            selectedColor={selectedColor}
            theme={theme}
          />

          {/* Placement Confirmation Dialog */}
          {pendingPlacement && (
            <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}>
              <div className="bg-[var(--bg-primary)] border-2 border-[var(--border-secondary)] p-6 max-w-xs w-full mx-4 animate-slide-up shadow-2xl">
                <div className="text-center space-y-4">
                  <div className="text-2xl">⚰</div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-primary)]">Confirm Placement</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Place your grave at coordinates
                    </p>
                    <p className="text-sm font-mono font-bold text-[var(--text-primary)] mt-1">
                      ({pendingPlacement.x}, {pendingPlacement.y})
                    </p>
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                    This action is permanent. Your grave will be etched into the digital cemetery forever.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setPendingPlacement(null)}
                      className="pixel-btn flex-1 py-2.5 text-xs font-bold"
                    >
                      CANCEL
                    </button>
                    <button
                      onClick={confirmPlacement}
                      disabled={isLoading}
                      className="pixel-btn-primary flex-1 py-2.5 text-xs font-bold"
                    >
                      {isLoading ? "PLACING..." : "⚰ CONFIRM"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      {/* Coffin Modal */}
      {modalGrave && (
        <CoffinModal
          grave={modalGrave}
          onClose={() => setModalGrave(null)}
          onGraveUpdate={(updated) => {
            setModalGrave(updated);
            setGraves((prev) =>
              prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g))
            );
          }}
          onAuthPrompt={() => setShowAuthModal(true)}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* Doc Modal */}
      {activeDoc && (
        <DocModal
          docType={activeDoc}
          onClose={() => setActiveDoc(null)}
        />
      )}

      {/* Stake Contract Modal */}
      {showStakeModal && (
        <StakeContractModal
          user={user}
          selectedStyleIdx={selectedStyleIdx}
          setSelectedStyleIdx={setSelectedStyleIdx}
          placementSize={placementSize}
          setPlacementSize={setPlacementSize}
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
          isLoading={isLoading}
          onSubmit={handleSidePanelSubmit}
          onClose={() => {
            setShowStakeModal(false);
            setPlacementMode(false);
            setReadyToPlace(false);
          }}
          onAuthPrompt={() => setShowAuthModal(true)}
        />
      )}

      {/* Keeper Plots Modal */}
      {showKeeperModal && user && (
        <KeeperPlotsModal
          user={user}
          onClose={() => setShowKeeperModal(false)}
          onTeleport={handleTeleport}
          onGraveClick={handleGraveClick}
          onGraveDeleted={() => {
            // Nudge camera state to re-trigger viewport fetch after a plot is deleted
            setCameraX((x) => x + 0.0001);
          }}
        />
      )}
    </div>
  );
}
