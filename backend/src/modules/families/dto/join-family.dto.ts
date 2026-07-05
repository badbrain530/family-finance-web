import { IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * 加入家庭DTO
 */
export class JoinFamilyDto {
  /** 家庭邀请码（6位） */
  @IsNotEmpty({ message: '邀请码不能为空' })
  @IsString()
  @Length(6, 6, { message: '邀请码为6位字符' })
  readonly inviteCode: string;
}
