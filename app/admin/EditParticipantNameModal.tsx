"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";

interface EditParticipantNameModalProps {
  open: boolean;
  participantName: string;
  saving: boolean;
  error?: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export function EditParticipantNameModal({
  open,
  participantName,
  saving,
  error = "",
  onClose,
  onSave,
}: EditParticipantNameModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(participantName);

  useEffect(() => {
    if (!open) return;
    setName(participantName);
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);
    return () => window.clearTimeout(t);
  }, [open, participantName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    await onSave(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#001426] p-5 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-white">
          Edit participant name
        </h2>
        <form className="mt-4 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="register-input w-full"
            placeholder="Full name"
            disabled={saving}
            autoComplete="name"
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:border-white/30 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="cta-button-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save name"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
