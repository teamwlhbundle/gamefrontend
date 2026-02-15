import { AdminLayout } from "@/components/admin";

export default function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout logoutHref="/login">{children}</AdminLayout>;
}
