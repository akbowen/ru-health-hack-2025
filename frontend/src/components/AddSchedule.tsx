import React, { useState } from "react";
import { Upload, File, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import "./AddSchedule.css";

export default function AddSchedule() {
  const [providerAvailability, setProviderAvailability] = useState<File | null>(
    null
  );
  const [providerContract, setProviderContract] = useState<File | null>(null);
  const [providerCredentialing, setProviderCredentialing] =
    useState<File | null>(null);
  const [facilityVolume, setFacilityVolume] = useState<File | null>(null);
  const [facilityCoverage, setFacilityCoverage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });

  const fileInputs = [
    {
      label: "Provider Availability",
      file: providerAvailability,
      setter: setProviderAvailability,
      key: "providerAvailability",
    },
    {
      label: "Provider Contract",
      file: providerContract,
      setter: setProviderContract,
      key: "providerContract",
    },
    {
      label: "Provider Credentialing",
      file: providerCredentialing,
      setter: setProviderCredentialing,
      key: "providerCredentialing",
    },
    {
      label: "Facility Volume",
      file: facilityVolume,
      setter: setFacilityVolume,
      key: "facilityVolume",
    },
    {
      label: "Facility Coverage",
      file: facilityCoverage,
      setter: setFacilityCoverage,
      key: "facilityCoverage",
    },
  ];

  // ---------- Helpers ----------
  function parseFilenameFromContentDisposition(
    cd: string | null
  ): string | null {
    if (!cd) return null;
    // try filename*= (RFC5987) first
    const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(cd);
    if (star?.[2]) return decodeURIComponent(star[2].trim());
    // fallback to filename=
    const plain = /filename\s*=\s*"?([^"]+)"?/i.exec(cd);
    return plain?.[1] ?? null;
  }

  function isExcelContentType(ct: string | null): boolean {
    if (!ct) return false;
    const xlsx =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return ct.includes(xlsx) || ct.includes("application/octet-stream");
  }

  const handleSubmit = async () => {
    setLoading(true);
    setMessage({ type: null, text: "" });

    const formData = new FormData();
    if (providerAvailability)
      formData.append("providerAvailability", providerAvailability);
    if (providerContract) formData.append("providerContract", providerContract);
    if (providerCredentialing)
      formData.append("providerCredentialing", providerCredentialing);
    if (facilityVolume) formData.append("facilityVolume", facilityVolume);
    if (facilityCoverage) formData.append("facilityCoverage", facilityCoverage);

    // 15-minute timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000);

    try {
      const res = await fetch("http://localhost:4000/api/schedule/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      // Try to detect Excel response
      const ct = res.headers.get("content-type");
      const cd = res.headers.get("content-disposition");
      const looksLikeExcel =
        isExcelContentType(ct) || (cd && /filename=.*\.xlsx/i.test(cd));

      if (!res.ok) {
        // try to surface error JSON/text
        let errText = "Upload failed. Please try again.";
        try {
          const txt = await res.text();
          try {
            const j = JSON.parse(txt);
            errText = j?.error || JSON.stringify(j) || errText;
          } catch {
            errText = txt || errText;
          }
        } catch {}
        setMessage({ type: "error", text: errText });
        return;
      }

      if (looksLikeExcel) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        // choose filename from header or fallback
        const filename =
          parseFilenameFromContentDisposition(cd) || "rank2.xlsx";

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        setMessage({
          type: "success",
          text: `Schedule generated. Downloaded ${filename}`,
        });

        // Clear files after successful upload
        setProviderAvailability(null);
        setProviderContract(null);
        setProviderCredentialing(null);
        setFacilityVolume(null);
        setFacilityCoverage(null);
        return;
      }

      // If not Excel, assume JSON success payload
      const j = await res.json().catch(() => ({}));
      const successMsg = j?.counts
        ? `Upload successful! Records processed: ${JSON.stringify(j.counts)}`
        : "Upload successful!";
      setMessage({ type: "success", text: successMsg });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setMessage({
          type: "error",
          text: "Request aborted after 15 minutes without a response.",
        });
      } else {
        setMessage({
          type: "error",
          text: "An error occurred during upload. Please check your connection and try again.",
        });
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    setProviderAvailability(null);
    setProviderContract(null);
    setProviderCredentialing(null);
    setFacilityVolume(null);
    setFacilityCoverage(null);
    setMessage({ type: null, text: "" });
  };

  const hasFiles =
    providerAvailability ||
    providerContract ||
    providerCredentialing ||
    facilityVolume ||
    facilityCoverage;

  return (
    <div className="schedule-container">
      <div className="schedule-card">
        <div className="schedule-header">
          <h2 className="schedule-title">Upload Schedule Files</h2>
          <p className="schedule-subtitle">
            Upload .xlsx files for provider and facility data
          </p>
        </div>

        <div className="schedule-content">
          {message.type && (
            <div
              className={`message-alert ${
                message.type === "success" ? "message-success" : "message-error"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle className={`message-icon message-icon-success`} />
              ) : (
                <AlertCircle className={`message-icon message-icon-error`} />
              )}
              <p
                className={`message-text ${
                  message.type === "success"
                    ? "message-text-success"
                    : "message-text-error"
                }`}
              >
                {message.text}
              </p>
            </div>
          )}

          <div className="file-input-grid">
            {fileInputs.map((input) => (
              <div key={input.key} className="file-input-wrapper">
                <label className="file-input-label">{input.label}</label>
                <div className="file-input-container">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) =>
                      input.setter(e.target.files ? e.target.files[0] : null)
                    }
                    className="file-input-hidden"
                    id={input.key}
                    disabled={loading}
                  />
                  <label
                    htmlFor={input.key}
                    className={`file-input-button ${
                      input.file ? "file-input-button-active" : ""
                    } ${loading ? "file-input-button-disabled" : ""}`}
                  >
                    <div className="file-input-content">
                      {input.file ? (
                        <File className="file-input-icon file-input-icon-filled" />
                      ) : (
                        <Upload className="file-input-icon file-input-icon-empty" />
                      )}
                      <span
                        className={`file-input-text ${
                          input.file
                            ? "file-input-text-filled"
                            : "file-input-text-empty"
                        }`}
                      >
                        {input.file ? input.file.name : "Choose file..."}
                      </span>
                    </div>
                    {input.file && <CheckCircle className="file-input-check" />}
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="action-buttons">
            <button
              onClick={handleClearAll}
              disabled={loading || !hasFiles}
              className="clear-button"
            >
              Clear All
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !hasFiles}
              className="upload-button"
            >
              {loading ? (
                <>
                  <Loader2 className="button-icon button-spinner" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="button-icon" />
                  Upload Files
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
