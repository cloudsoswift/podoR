import { ReactNode } from "react";
import AdminGuard from "@/components/admin/AdminGuard";
import Sidebar from "@/components/admin/Sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-gray-50 text-gray-800">
        <Sidebar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </AdminGuard>
  );
}
