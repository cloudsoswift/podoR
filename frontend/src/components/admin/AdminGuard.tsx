"use client";

import { ReactNode } from "react";
import RoleGuard from "@/components/auth/RoleGuard";

export default function AdminGuard({ children }: { children: ReactNode }) {
  return <RoleGuard roles={["ADMIN"]}>{children}</RoleGuard>;
}
