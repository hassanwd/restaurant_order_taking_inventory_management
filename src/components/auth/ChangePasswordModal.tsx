"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/primitives";
import { useServerAction } from "@/lib/useServerAction";
import { changePasswordAction } from "@/server/actions/auth";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/slices/uiSlice";

export default function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { call, pending } = useServerAction();

  const close = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setError(null);
    const result = await call(() => changePasswordAction({ current, next }));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    dispatch(showToast({ message: "Password changed — other devices were signed out" }));
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Change password"
      subtitle="Other devices signed in to your account will be signed out."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !current || !next || !confirm}>
            {pending ? "Saving…" : "Update password"}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Current password">
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </Field>
        <Field label="New password" hint="At least 10 characters, with a letter and a number.">
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger"
          >
            {error}
          </p>
        ) : null}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
