"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRAttendancePanel() {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    const payload =
      "smart-university:session=CS101;room=R-204;lecturer=LC-12;student=ST-3501;time=2026-08-30T09:00Z";

    QRCode.toDataURL(payload, { width: 180, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(""));
  }, []);

  return (
    <div className="panel qr-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">QR Attendance</p>
          <h3>Live check-in</h3>
        </div>
        <span className="status-pill success">Active</span>
      </div>

      <div className="qr-body">
        <div className="qr-box">
          {qrDataUrl ? <img src={qrDataUrl} alt="Attendance QR code" /> : <div className="qr-placeholder">QR</div>}
        </div>

        <div className="qr-meta">
          <p><strong>Course:</strong> Computer Science 101</p>
          <p><strong>Room:</strong> R-204</p>
          <p><strong>Lecturer:</strong> Dr. M. Kibet</p>
          <p><strong>Window:</strong> 09:00 - 11:00</p>
          <button type="button" className="primary-button">Generate new QR</button>
        </div>
      </div>
    </div>
  );
}
