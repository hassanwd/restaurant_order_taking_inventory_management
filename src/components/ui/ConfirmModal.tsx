"use client";

import Modal from "./Modal";
import { Button } from "./Button";

/** A yes/no gate for destructive actions — delete, freeze — so none of them fires from a single stray click. */
export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  tone = "danger",
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} disabled={pending} onClick={onConfirm}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-fg-muted">{message}</p>
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
