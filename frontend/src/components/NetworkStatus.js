import React, { useEffect, useState, useRef } from "react";
import "../stylesheet/NetworkStatus.css";

export default function NetworkStatus({
  pingUrl = "/api/ping",
  pingInterval = 10000,
  showStatusPill = true,
  showNotifications = true
}) {
  const [navigatorOnline, setNavigatorOnline] = useState(navigator.onLine);
  const [serverReachable, setServerReachable] = useState(true);
  const [status, setStatus] = useState("online"); // "online" | "offline" | "poor" | "degraded"
  const [message, setMessage] = useState("");
  const [latency, setLatency] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const backoffRef = useRef({ attempts: 0, timeoutId: null });
  const mounted = useRef(true);
  const [showBanner, setShowBanner] = useState(true);

  const POOR_THRESHOLD = 1000; // ms (set threshold for "poor network")
  const DEGRADED_THRESHOLD = 2000; // ms (set threshold for "degraded network")

  useEffect(() => {
    mounted.current = true;

    const onOnline = () => {
      setNavigatorOnline(true);
      setMessage("Connection restored — checking server connectivity...");
      immediatePing();
    };

    const onOffline = () => {
      setNavigatorOnline(false);
      setServerReachable(false);
      setStatus("offline");
      setMessage("No internet connection detected. Please check your network settings.");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // initial ping
    immediatePing();
    const intervalId = setInterval(immediatePing, pingInterval);

    return () => {
      mounted.current = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(intervalId);
      if (backoffRef.current.timeoutId) clearTimeout(backoffRef.current.timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pingServer() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const start = performance.now();

    try {
      const res = await fetch(pingUrl, {
        method: "GET",
        cache: "no-cache",
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const end = performance.now();
      clearTimeout(timer);

      if (res.ok) {
        const latency = end - start;
        return { ok: true, latency };
      }
      return { ok: false };
    } catch (err) {
      clearTimeout(timer);
      return { ok: false };
    }
  }

  function immediatePing() {
    if (!navigator.onLine) {
      setServerReachable(false);
      setStatus("offline");
      setMessage("No internet connection detected. Please check your network settings.");
      return;
    }

    pingServer().then((result) => {
      if (!mounted.current) return;

      if (result.ok) {
        backoffRef.current.attempts = 0;
        setServerReachable(true);
        setLatency(result.latency);

        if (result.latency > DEGRADED_THRESHOLD) {
          setStatus("degraded");
          setMessage(`Network connection is degraded (latency: ${Math.round(result.latency)}ms)`);
        } else if (result.latency > POOR_THRESHOLD) {
          setStatus("poor");
          setMessage(`Network performance is poor (latency: ${Math.round(result.latency)}ms)`);
        } else {
          setStatus("online");
          setMessage("Connection stable and healthy");
        }
      } else {
        backoffRef.current.attempts += 1;
        const attempts = backoffRef.current.attempts;
        setServerReachable(false);
        setStatus("degraded");
        setMessage(`Cannot reach server (attempt ${attempts}). Retrying...`);

        const delay = Math.min(30000, 1000 * 2 ** Math.min(6, attempts));
        if (backoffRef.current.timeoutId) clearTimeout(backoffRef.current.timeoutId);
        backoffRef.current.timeoutId = setTimeout(() => {
          if (!mounted.current) return;
          immediatePing();
        }, delay);
      }
    });
  }

  // Color & label based on status
  const statusConfig = {
    online: {
      label: "Online",
      color: "#10B981",
      bg: "#ECFDF5",
      icon: "✓",
      description: "Connection is stable and healthy"
    },
    poor: {
      label: "Poor Connection",
      color: "#F59E0B",
      bg: "#FFFBEB",
      icon: "⚠️",
      description: "Network performance is degraded"
    },
    degraded: {
      label: "Unstable",
      color: "#F59E0B",
      bg: "#FFFBEB",
      icon: "⚠️",
      description: "Experiencing connection issues"
    },
    offline: {
      label: "Offline",
      color: "#EF4444",
      bg: "#FEF2F2",
      icon: "❌",
      description: "No internet connection"
    },
  };

  const cfg = statusConfig[status];

  return (
    <>
      {/* Top banner - only shows when not online */}
      {showNotifications && status !== "online" && showBanner && (
        <div
          aria-live="polite"
          style={{
            transition: "all 0.3s ease-in-out",
            transform: status === "online" ? "translateY(-120%)" : "translateY(0)",
            opacity: status === "online" ? 0 : 1
          }}
          className="network-status-banner position-fixed top-0 start-0 end-0 d-flex justify-content-center"
        >
          <div
            className="alert d-flex align-items-center mb-0 shadow-sm justify-content-between py-3"
            role="alert"
            style={{
              maxWidth: 900,
              borderRadius: "0 0 8px 8px",
              background: cfg.bg,
              color: "#1F2937",
              border: `1px solid ${cfg.color}20`,
              borderTop: 'none',
              width: '100%'
            }}
          >
            <div className="d-flex align-items-center">
              <div
                className="status-indicator me-3 rounded-circle d-flex align-items-center justify-content-center"
                style={{
                  background: cfg.color,
                  width: 24,
                  height: 24,
                  fontSize: 12,
                  color: 'white'
                }}
              >
                {cfg.icon}
              </div>
              <div>
                <div className="fw-semibold">{cfg.label}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>{message}</div>
              </div>
            </div>
            <button
              className="btn-close"
              onClick={() => setShowBanner(false)}
              aria-label="Close notification"
            />
          </div>
        </div>
      )}

      {/* Details panel */}
      {showDetails && (
        <div
          className="position-fixed start-0 end-0 bg-white shadow-lg rounded mt-2 mx-auto p-3"
          style={{
            top: '60px',
            maxWidth: 900,
            zIndex: 1049,
            border: '1px solid #E5E7EB'
          }}
        >
          <h6 className="fw-semibold mb-3">Connection Details</h6>
          <div className="row">
            <div className="col-md-6">
              <div className="mb-2">
                <span className="text-muted">Status:</span>
                <span className="ms-2 fw-medium" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
              <div className="mb-2">
                <span className="text-muted">Browser Connection:</span>
                <span className="ms-2 fw-medium">{navigatorOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-2">
                <span className="text-muted">Server Reachable:</span>
                <span className="ms-2 fw-medium">{serverReachable ? 'Yes' : 'No'}</span>
              </div>
              <div className="mb-2">
                <span className="text-muted">Latency:</span>
                <span className="ms-2 fw-medium">{latency ? `${Math.round(latency)}ms` : 'N/A'}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-top">
            <small className="text-muted">Last checked: {new Date().toLocaleTimeString()}</small>
          </div>
        </div>
      )}

      {/* Bottom status pill */}
      {showStatusPill && (
        <div
          className="position-fixed network-status-pill"
          style={{ left: 16, bottom: 16, zIndex: 1050 }}
          onClick={() => setShowDetails(!showDetails)}
        >
          <div
            className="d-flex align-items-center shadow-sm p-2 rounded-pill"
            style={{
              background: '#FFFFFF',
              minWidth: 140,
              cursor: 'pointer',
              border: `1px solid ${cfg.color}30`,
              transition: 'all 0.2s ease'
            }}
          >
            <span
              className="me-2 rounded-circle status-dot"
              style={{
                width: 10,
                height: 10,
                display: "inline-block",
                background: cfg.color,
                boxShadow: `0 0 0 ${status === 'online' ? 4 : 0}px ${cfg.color}20`,
                animation: status !== 'online' ? 'pulse 2s infinite' : 'none'
              }}
            />
            <small className="m-0 fw-medium" style={{ fontSize: 13, color: "#374151" }}>
              {cfg.label}
            </small>
          </div>
        </div>
      )}
    </>
  );
}