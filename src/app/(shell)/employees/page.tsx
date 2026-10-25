import EmployeeManager from "@/components/admin/EmployeeManager";
import { getEmployees } from "@/server/data";
import { requirePermission } from "@/server/session";

export const metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const user = await requirePermission("employees.manage");
  const employees = await getEmployees();
  return <EmployeeManager employees={employees} currentUserId={user.id} />;
}
