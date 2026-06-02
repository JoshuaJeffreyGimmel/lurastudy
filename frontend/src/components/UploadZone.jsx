import React, { useRef, useState } from "react";
import "./UploadZone.css";

const ACCEPTED = ".pdf,.txt,.md";

export default function UploadZone({ onUpload, uploading }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    onUpload(files[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleChange(e) {
    handleFiles(e.target.files);
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  }

  return (
    <div
      className={`upload-zone ${dragOver ? "drag-over" : ""} ${uploading ? "uploading" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && !uploading && inputRef.current?.click()}
      aria-label="Upload document"
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        style={{ display: "none" }}
        onChange={handleChange}
        disabled={uploading}
      />
      {uploading ? (
        <>
          <span className="spinner" />
          <span>Processing document…</span>
        </>
      ) : (
        <>
          <div className="upload-icon">📄</div>
          <div className="upload-label">
            <strong>Drop a file here</strong> or click to browse
          </div>
          <div className="upload-hint">Supports PDF, TXT, Markdown</div>
        </>
      )}
    </div>
  );
}
