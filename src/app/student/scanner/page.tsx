"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { useAuth } from "@/lib/auth-context";
import styles from "./page.module.css";

interface ScanRecord {
  id: string;
  sessionId: string;
  status: string;
  scannedAt: string | null;
}

interface ScanResponse {
  status?: string;
  record?: ScanRecord;
  error?: string;
}

interface Feedback {
  kind: "error" | "success" | "info";
  message: string;
}

const SCAN_ERROR_MESSAGES: Record<string, string> = {
  invalid_payload: "That code is not a valid attendance QR code.",
  session_not_found: "This code refers to a session that no longer exists.",
  session_not_active:
    "This session is not active right now. Scans are only accepted during the class window.",
  forbidden: "Only students can record attendance.",
  unauthorized: "You are not signed in.",
};

export default function StudentScanner() {
  const { user, token, loading: authLoading } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [manualCode, setManualCode] = useState("");

  const showFeedback = useCallback((next: Feedback | null, autoHideMs = 4000) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setFeedback(next);
    if (next && autoHideMs > 0) {
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), autoHideMs);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  const submitScan = useCallback(
    async (payload: string) => {
      if (!token) {
        showFeedback({ kind: "error", message: "You are not signed in." }, 0);
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/qr/scan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          // The server derives the student identity from the token; the body
          // only carries the scanned payload.
          body: JSON.stringify({ payload, action: "attend" }),
        });

        const data: ScanResponse = await res.json().catch(() => ({}));

        if (!res.ok) {
          const message =
            (data.error && SCAN_ERROR_MESSAGES[data.error]) ||
            data.error ||
            "Failed to record attendance.";
          showFeedback({ kind: "error", message }, 0);
          return;
        }

        const record = data.record;
        if (data.status === "already_recorded" && record) {
          setRecentScans((prev) =>
            [record, ...prev.filter((r) => r.id !== record.id)].slice(0, 10)
          );
          showFeedback({ kind: "info", message: "You already checked in to this session." });
          return;
        }

        if (record) {
          setRecentScans((prev) => [record, ...prev].slice(0, 10));
          showFeedback({ kind: "success", message: "Attendance recorded. You are checked in!" });
        }
      } catch {
        showFeedback({ kind: "error", message: "Network error. Please try again." }, 0);
      } finally {
        setSubmitting(false);
      }
    },
    [token, showFeedback]
  );

  // Decode loop: draw the live video frame onto a hidden canvas and try to read
  // a QR code. On the first successful decode the camera stops and the payload
  // is submitted.
  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState >= video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });
        if (code?.data) {
          stopCamera();
          void submitScan(code.data);
          return;
        }
      }
    }
    frameRef.current = requestAnimationFrame(scanFrame);
  };

  const startCamera = async () => {
    showFeedback(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setScanning(true);
      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      showFeedback(
        {
          kind: "error",
          message:
            "Could not access the camera. Check browser permissions, or use manual entry below.",
        },
        0
      );
    }
  };

  // Release the camera and timers when the page unmounts.
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) {
      showFeedback({ kind: "error", message: "Enter the code shown on the class QR." }, 0);
      return;
    }
    setManualCode("");
    void submitScan(trimmed);
  };

  const formatScanTime = (scannedAt: string | null) =>
    scannedAt ? new Date(scannedAt).toLocaleTimeString() : "—";

  if (authLoading) {
    return (
      <div className={styles.container}>
        <h1>QR Code Scanner</h1>
        <p className={styles.emptyMessage}>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.container}>
        <h1>QR Code Scanner</h1>
        <div className={`${styles.alert} ${styles.alertError}`}>
          Please sign in as a student to record attendance.
        </div>
      </div>
    );
  }

  if (user.role !== "STUDENT") {
    return (
      <div className={styles.container}>
        <h1>QR Code Scanner</h1>
        <div className={`${styles.alert} ${styles.alertError}`}>
          Only students can access the attendance scanner.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>QR Code Scanner</h1>
      <p className={styles.subtitle}>
        Scan the class QR code shown by your lecturer to check in, or enter the code manually
        below.
      </p>

      {feedback && (
        <div
          aria-live="polite"
          role="status"
          className={`${styles.alert} ${
            feedback.kind === "error"
              ? styles.alertError
              : feedback.kind === "success"
                ? styles.alertSuccess
                : styles.alertInfo
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className={styles.mainContent}>
        <section className={styles.scanSection}>
          <div className={styles.cameraContainer}>
            <video ref={videoRef} autoPlay playsInline muted className={styles.video} />
            {!scanning && (
              <div className={styles.cameraPlaceholder}>
                <p>📷 Camera not active</p>
                <p>Click “Start scanning”, or use manual entry below.</p>
              </div>
            )}
            <canvas ref={canvasRef} className={styles.hiddenCanvas} />
          </div>

          <div className={styles.controls}>
            {scanning ? (
              <button type="button" onClick={stopCamera} className={styles.dangerBtn}>
                Stop scanning
              </button>
            ) : (
              <button type="button" onClick={startCamera} className={styles.primaryBtn}>
                Start scanning
              </button>
            )}
          </div>

          <div className={styles.divider}>
            <span>OR</span>
          </div>

          <form onSubmit={handleManualSubmit} className={styles.manualForm}>
            <div className={styles.formGroup}>
              <label htmlFor="manualCode">Enter code manually</label>
              <input
                id="manualCode"
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Paste the QR code content"
                className={styles.codeInput}
                disabled={submitting}
                autoComplete="off"
              />
            </div>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit code"}
            </button>
          </form>
        </section>

        <section className={styles.historySection}>
          <h2>Recent check-ins</h2>
          {recentScans.length === 0 ? (
            <p className={styles.emptyMessage}>No scans recorded yet.</p>
          ) : (
            <div className={styles.scansList}>
              {recentScans.map((scan) => (
                <div key={scan.id} className={styles.scanItem}>
                  <div>
                    <strong>Session:</strong> {scan.sessionId}
                  </div>
                  <div>
                    <strong>Status:</strong> {scan.status}
                  </div>
                  <div>
                    <strong>Time:</strong> {formatScanTime(scan.scannedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

