import React, { useState, useEffect, useRef } from "react";
import "../../../stylesheet/retailer/dashboard/ChatbotWhatsApp.css";

/**
 * Props:
 *  - phone (string) : international phone number WITHOUT "+" (e.g. "9779843714188")
 *  - placeholder (string) : input placeholder
 */
export default function ChatbotWhatsApp({
  phone = "9779843714188",
  placeholder = "Type a message..."
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hi 👋 — how can I help you today?" }
  ]);
  const [text, setText] = useState("");
  const [lastMessageForWA, setLastMessageForWA] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    // rough mobile detection
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    setIsMobile(/android|iphone|ipad|iPod/i.test(ua));
  }, []);

  useEffect(() => {
    // if modal opens, reset iframeBlocked because user might retry
    if (open) setIframeBlocked(false);
  }, [open]);

  function addMessage(from, text) {
    setMessages((m) => [...m, { from, text }]);
  }

  function handleSend(e) {
    e?.preventDefault?.();
    const trimmed = text.trim();
    if (!trimmed) return;
    addMessage("user", trimmed);
    setLastMessageForWA(trimmed);
    setText("");
    // open modal if not open
    if (!open) setOpen(true);
    // small delay to show user's message
    setTimeout(() => {
      // focus on iframe area or show loader / attempt to load WA
      // we set iframe src below by updating lastMessageForWA which is used in iframe src
    }, 50);
  }

  // whatsapp link builders
  function waLinkForMobile(message) {
    const encoded = encodeURIComponent(message || "");
    return `https://wa.me/${phone}?text=${encoded}`;
  }
  function waWebLink(message) {
    const encoded = encodeURIComponent(message || "");
    // web.whatsapp.com works on desktop; using /send path with phone param
    return `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;
  }

  // iframe src (attempt)
  const iframeSrc = isMobile ? waLinkForMobile(lastMessageForWA || "") : waWebLink(lastMessageForWA || "");

  return (
    <>
      {/* Floating button */}
      <button
        className="wa-floating-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open WhatsApp chat"
      >
        💬
      </button>

      {/* Modal */}
      {open && (
        <div className="wa-modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="wa-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()} // prevent backdrop close
          >
            <header className="wa-modal-header">
              <div>
                <strong>Chat on WhatsApp</strong>
                <div className="wa-sub">Phone: +{phone}</div>
              </div>
              <button className="wa-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </header>

            <main className="wa-chat-area">
              <div className="wa-messages">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`wa-msg ${m.from === "user" ? "wa-msg-user" : "wa-msg-bot"}`}
                  >
                    {m.text}
                  </div>
                ))}
              </div>

              {/* If user has sent at least one message and iframe not blocked, show iframe */}
              {lastMessageForWA ? (
                <div className="wa-iframe-wrapper">
                  <div className="wa-iframe-actions">
                    <div className="wa-iframe-note">
                      {isMobile
                        ? "Opening WhatsApp app (mobile) — if it doesn't open automatically, tap the button."
                        : "Attempting to load WhatsApp Web here. If it doesn't display below, use the 'Open in new tab' button."}
                    </div>

                    <div>
                      <a
                        className="wa-open-tab"
                        href={isMobile ? waLinkForMobile(lastMessageForWA) : waWebLink(lastMessageForWA)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>

                  {/* iframe for desktop attempt; on mobile this will open wa.me url but embedding mobile links rarely works */}
                  {!isMobile && !iframeBlocked ? (
                    <iframe
                      ref={iframeRef}
                      title="WhatsApp Web"
                      src={iframeSrc}
                      className="wa-iframe"
                      onLoad={() => {
                        // iframe loaded — but may still be blocked by headers; we can't reliably detect X-Frame via JS,
                        // so we keep a manual button. Optionally we could set a timeout and mark blocked if not interactive.
                      }}
                      // allow attributes to help if embedding is allowed
                      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                    />
                  ) : null}

                  {/* If we suspect iframe is blocked or on mobile, show fallback message */}
                  {(iframeBlocked || isMobile) && (
                    <div className="wa-iframe-fallback">
                      WhatsApp couldn't be embedded here — please open it in a new tab or on your phone.
                    </div>
                  )}
                </div>
              ) : (
                <div className="wa-welcome-hint">
                  Type a message and hit send — we'll open WhatsApp with your message so you can continue the chat.
                </div>
              )}
            </main>

            <form className="wa-input-area" onSubmit={handleSend}>
              <input
                className="wa-input"
                placeholder={placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                aria-label="Message"
              />
              <button type="submit" className="wa-send-btn">
                Send ↗
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
