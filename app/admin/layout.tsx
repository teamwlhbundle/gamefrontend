import { AdminAuthProvider } from "@/lib/admin-auth-context";
import { AdminRouteGuard } from "./AdminRouteGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <AdminRouteGuard>{children}</AdminRouteGuard>
    </AdminAuthProvider>
  );
}
