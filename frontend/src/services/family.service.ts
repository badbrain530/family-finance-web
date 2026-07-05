import { get, post, put, del } from './api';
import type {
  Family,
  FamilyMember,
  CreateFamilyRequest,
  UpdateFamilyRequest,
  JoinFamilyRequest,
  InviteResponse,
  OnlineMember,
  MemberRole,
} from '@/types/family';

/**
 * 家庭/成员API服务
 */

/** 创建家庭 */
export function createFamily(data: CreateFamilyRequest): Promise<Family> {
  return post<Family>('/families', data);
}

/** 获取当前家庭 */
export function getCurrentFamily(): Promise<Family> {
  return get<Family>('/families/current');
}

/** 更新家庭信息 */
export function updateFamily(id: string, data: UpdateFamilyRequest): Promise<Family> {
  return put<Family>(`/families/${id}`, data);
}

/** 生成邀请码 */
export function generateInviteCode(familyId: string): Promise<InviteResponse> {
  return post<InviteResponse>(`/families/${familyId}/invite`);
}

/** 通过邀请码加入家庭 */
export function joinFamily(data: JoinFamilyRequest): Promise<FamilyMember> {
  return post<FamilyMember>('/families/join', data);
}

/** 获取成员列表 */
export function getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  return get<FamilyMember[]>(`/families/${familyId}/members`);
}

/** 更新成员角色 */
export function updateMemberRole(familyId: string, userId: string, role: MemberRole): Promise<FamilyMember> {
  return put<FamilyMember>(`/families/${familyId}/members/${userId}`, { role });
}

/** 移除成员 */
export function removeMember(familyId: string, userId: string): Promise<{ success: boolean }> {
  return del(`/families/${familyId}/members/${userId}`);
}

/** 获取在线成员 */
export function getOnlineMembers(familyId: string): Promise<OnlineMember[]> {
  return get<OnlineMember[]>(`/families/${familyId}/members/online`);
}
