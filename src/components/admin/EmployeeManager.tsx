"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, KeyRound, Snowflake, Sun, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Modal from "@/components/ui/Modal";
import { Card, EmptyState, Field, Input, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDateTime, initials } from "@/lib/format";
import { ROLE_LABEL, ROLES } from "@/lib/permissions";
import type { EmployeeView, Role } from "@/lib/types";
import { useServerAction } from "@/lib/useServerAction";
import {
  createEmployeeAction,
  deleteEmployeeAction,
  resetEmployeePasswordAction,
  setEmployeeFrozenAction,
} from "@/server/actions/employees";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/slices/uiSlice";

const ROLE_TONE: Record<Role, string> = {
  worker: "bg-surface-3 text-fg-muted",
  admin: "bg-info-soft text-info",
  super_admin: "bg-accent-soft text-accent",
};

const PASSWORD_HINT = "At least 10 characters, with a letter and a number.";

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { call, pending } = useServerAction();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("worker");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const result = await call(() => createEmployeeAction({ name, username, role, password }));
    if (!result.ok) return setError(result.error);
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add employee"
      subtitle="Share the starting password with them in person — they can change it from their account menu."
      footer={
        <div className="flex items-center justify-between gap-3">
          {error ? (
            <p role="alert" className="text-xs font-semibold text-danger">
              {error}
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !name.trim() || !username.trim() || !password}>
              {pending ? "Saving…" : "Add employee"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" required>
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" />
        </Field>
        <Field label="Username" required hint="Lowercase letters, numbers, . _ -">
          <Input value={username} maxLength={32} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" spellCheck={false} autoComplete="off" />
        </Field>
        <Field label="Role" required>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((entry) => (
              <option key={entry} value={entry}>
                {ROLE_LABEL[entry]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Starting password" required hint={PASSWORD_HINT}>
          <Input type="text" value={password} maxLength={128} onChange={(e) => setPassword(e.target.value)} autoComplete="off" spellCheck={false} />
        </Field>
      </div>
    </Modal>
  );
}

function ResetModal({ employee, onClose, onDone }: { employee: EmployeeView; onClose: () => void; onDone: () => void }) {
  const { call, pending } = useServerAction();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const result = await call(() => resetEmployeePasswordAction({ id: employee.id, password }));
    if (!result.ok) return setError(result.error);
    onDone();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reset password for ${employee.name}`}
      subtitle="They are signed out everywhere and any lockout is cleared."
      footer={
        <div className="flex items-center justify-between gap-3">
          {error ? (
            <p role="alert" className="text-xs font-semibold text-danger">
              {error}
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !password}>
              {pending ? "Saving…" : "Reset password"}
            </Button>
          </div>
        </div>
      }
    >
      <Field label="New password" required hint={PASSWORD_HINT}>
        <Input type="text" value={password} maxLength={128} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="off" spellCheck={false} />
      </Field>
    </Modal>
  );
}

type Pending =
  | { kind: "freeze"; employee: EmployeeView }
  | { kind: "unfreeze"; employee: EmployeeView }
  | { kind: "delete"; employee: EmployeeView };

export default function EmployeeManager({
  employees,
  currentUserId,
}: {
  employees: EmployeeView[];
  currentUserId: string;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { call, pending } = useServerAction();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<EmployeeView | null>(null);
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = (message: string) => {
    dispatch(showToast({ message }));
    router.refresh();
  };

  const confirmed = async () => {
    if (!confirm) return;
    const { kind, employee } = confirm;
    const result = await call(() =>
      kind === "delete"
        ? deleteEmployeeAction(employee.id)
        : setEmployeeFrozenAction(employee.id, kind === "freeze"),
    );
    if (!result.ok) return setError(result.error);
    setConfirm(null);
    setError(null);
    done(
      kind === "delete"
        ? `${employee.name} deleted`
        : kind === "freeze"
          ? `${employee.name} frozen and signed out`
          : `${employee.name} unfrozen`,
    );
  };

  const active = employees.filter((employee) => !employee.frozen).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg">Employees</h2>
          <p className="text-xs text-fg-muted">
            {employees.length} accounts · {active} active · {employees.length - active} frozen
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <UserPlus className="size-4" aria-hidden />
          Add employee
        </Button>
      </div>

      {employees.length === 0 ? (
        <EmptyState icon={Users} title="No employees" description="Add the first employee account." />
      ) : (
        <Card className="overflow-hidden">
          <div className="scroll-slim overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">Employee</th>
                  <th className="px-3 py-3 font-bold">Role</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 text-right font-bold">Orders</th>
                  <th className="px-3 py-3 font-bold">Last sign-in</th>
                  <th className="px-5 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {employees.map((employee) => {
                  const self = employee.id === currentUserId;
                  return (
                    <tr key={employee.id} className={cn("transition-colors hover:bg-surface-2", employee.frozen && "opacity-75")}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-900 text-xs font-bold text-white dark:bg-white dark:text-ink-900">
                            {initials(employee.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-fg">
                              {employee.name}
                              {self ? <span className="ml-2 text-[11px] font-semibold text-fg-subtle">(you)</span> : null}
                            </p>
                            <p className="truncate text-[11px] text-fg-muted">@{employee.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide", ROLE_TONE[employee.role])}>
                          {ROLE_LABEL[employee.role]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {employee.frozen ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-info-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-info">
                            <Snowflake className="size-3" aria-hidden />
                            Frozen
                          </span>
                        ) : employee.locked ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-warning">
                            <Lock className="size-3" aria-hidden />
                            Locked out
                          </span>
                        ) : (
                          <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-success">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-fg-muted">{employee.ordersPlaced}</td>
                      <td className="px-3 py-3 text-xs text-fg-muted">
                        {employee.lastLoginAt ? `${formatDateTime(employee.lastLoginAt)} UTC` : "Never"}
                        {employee.lastActiveAt ? <p className="text-[11px] text-success">Signed in now</p> : null}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setResetting(employee)}>
                            <KeyRound className="size-3.5" aria-hidden />
                            Reset
                          </Button>
                          {!self ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setError(null);
                                  setConfirm({ kind: employee.frozen ? "unfreeze" : "freeze", employee });
                                }}
                              >
                                {employee.frozen ? <Sun className="size-3.5" aria-hidden /> : <Snowflake className="size-3.5" aria-hidden />}
                                {employee.frozen ? "Unfreeze" : "Freeze"}
                              </Button>
                              <button
                                type="button"
                                onClick={() => {
                                  setError(null);
                                  setConfirm({ kind: "delete", employee });
                                }}
                                aria-label={`Delete ${employee.name}`}
                                className="grid size-9 cursor-pointer place-items-center rounded-lg text-fg-muted transition-all duration-150 hover:bg-danger-soft hover:text-danger active:scale-90"
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {creating ? (
        <CreateModal
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            done("Employee added");
          }}
        />
      ) : null}
      {resetting ? (
        <ResetModal
          employee={resetting}
          onClose={() => setResetting(null)}
          onDone={() => {
            const name = resetting.name;
            setResetting(null);
            done(`Password reset for ${name}`);
          }}
        />
      ) : null}
      {confirm ? (
        <ConfirmModal
          title={
            confirm.kind === "delete"
              ? `Delete ${confirm.employee.name}?`
              : confirm.kind === "freeze"
                ? `Freeze ${confirm.employee.name}?`
                : `Unfreeze ${confirm.employee.name}?`
          }
          message={
            confirm.kind === "delete"
              ? "The account is removed and they are signed out immediately. Orders they took stay in the records."
              : confirm.kind === "freeze"
                ? "They are signed out immediately and cannot sign in until you unfreeze the account."
                : "They will be able to sign in again."
          }
          confirmLabel={confirm.kind === "delete" ? "Delete" : confirm.kind === "freeze" ? "Freeze" : "Unfreeze"}
          tone={confirm.kind === "unfreeze" ? "primary" : "danger"}
          pending={pending}
          error={error}
          onConfirm={() => void confirmed()}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
