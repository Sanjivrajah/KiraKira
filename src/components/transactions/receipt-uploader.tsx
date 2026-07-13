"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, UploadCloud, X } from "lucide-react";

export function ReceiptUploader({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const chooseFile = (selected?: File) => {
    if (selected?.type.startsWith("image/")) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="capture-input-card" aria-labelledby="receipt-upload-title">
      <p className="section-kicker">Receipt photo · Step 1 of 3</p>
      <h2 id="receipt-upload-title">Add a clear receipt image</h2>
      <p className="capture-help">We’ll use representative demo values. The image stays in this browser and is not uploaded.</p>

      {preview ? (
        <div className="receipt-preview">
          <Image alt="Selected receipt preview" fill sizes="(max-width: 700px) 90vw, 560px" src={preview} unoptimized />
          <button aria-label="Remove selected receipt" className="remove-upload" onClick={removeFile} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
      ) : (
        <button
          className="upload-dropzone"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}
          type="button"
        >
          <span className="upload-icon"><UploadCloud aria-hidden="true" size={26} /></span>
          <strong>Select or drop a receipt</strong>
          <small>PNG, JPG, or WEBP · demo preview only</small>
        </button>
      )}
      <input accept="image/*" className="visually-hidden" onChange={(event) => chooseFile(event.target.files?.[0])} ref={inputRef} type="file" />

      {file ? <p className="selected-file"><ImagePlus aria-hidden="true" size={16} />{file.name}</p> : null}
      <div className="capture-actions">
        <button className="button button-secondary" onClick={onBack} type="button">Back</button>
        <button className="button button-primary" disabled={!file} onClick={onContinue} type="button">Prepare demo extraction</button>
      </div>
    </section>
  );
}
