import apiClient from "@/lib/axios";
import { Page, PageParams } from "./types";

export interface AdminUserListItem {
  seq: number;
  email: string;
  nickname: string;
  role: string;
  provider: string;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  phone: string | null;
  birthday: string | null;
  profileImage: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListUsersParams extends PageParams {
  keyword?: string;
}

export async function listUsers(params: ListUsersParams): Promise<Page<AdminUserListItem>> {
  const { data } = await apiClient.get<Page<AdminUserListItem>>("/admin/users", { params });
  return data;
}

export async function getUser(seq: number): Promise<AdminUserDetail> {
  const { data } = await apiClient.get<AdminUserDetail>(`/admin/users/${seq}`);
  return data;
}

export async function deleteUser(seq: number): Promise<void> {
  await apiClient.delete(`/admin/users/${seq}`);
}
