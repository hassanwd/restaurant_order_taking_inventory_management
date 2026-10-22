"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/primitives";

/** Asks for a written reason before a cancellation, return or other consequential change. */
export default function ReasonModal({
  open,
  title,
  subtitle,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  confirmLabel: string;
  pending: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Keep order
          </Button>
          <Button
            variant="danger"
            disabled={pending || reason.trim().length < 3}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? "Saving…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <Field label="Reason" required hint="Recorded with your name in the activity log.">
        <Textarea
          rows={3}
          autoFocus
          maxLength={200}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. guest changed their mind, dish sent back"
        />
      </Field>
      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
