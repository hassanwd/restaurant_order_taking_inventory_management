import EmployeeManager from "@/components/admin/EmployeeManager";
import { getAuditLog, getEmployees } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const user = await requirePermission("employees.manage");
  const [employees, audit] = await Promise.all([getEmployees(), getAuditLog(60)]);
  return <EmployeeManager employees={employees} audit={audit} currentUserId={user.id} />;
}
