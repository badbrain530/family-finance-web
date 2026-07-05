/**
 * 家庭/账本/成员类型定义
 */

/** 家庭成员角色枚举 */
export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

/** 家庭信息 */
export interface Family {
  id: string;
  name: string;
  ownerId: string;
  avatar: string | null;
  inviteCode: string;
  inviteCodeExpiry: string;
  createdAt: string;
  updatedAt: string;
}

/** 家庭成员 */
export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  family?: Family;
  user?: import('./user').User;
}

/** 账本类型枚举 */
export enum LedgerType {
  SHARED = 'shared',
  PERSONAL = 'personal',
}

/** 账本 */
export interface Ledger {
  id: string;
  familyId: string;
  ownerId: string | null;
  type: LedgerType;
  name: string;
  createdAt: string;
}

/** 创建家庭请求 */
export interface CreateFamilyRequest {
  name: string;
}

/** 更新家庭信息请求 */
export interface UpdateFamilyRequest {
  name?: string;
  avatar?: string;
}

/** 邀请成员响应 */
export interface InviteResponse {
  inviteCode: string;
  expireAt: string;
}

/** 加入家庭请求 */
export interface JoinFamilyRequest {
  inviteCode: string;
}

/** 更新成员角色请求 */
export interface UpdateMemberRoleRequest {
  role: MemberRole;
}

/** 在线成员信息 */
export interface OnlineMember {
  userId: string;
  nickname: string;
  avatar: string | null;
}
