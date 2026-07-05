import { IsNotEmpty, IsString, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator';

/**
 * 创建账本DTO
 */
export class CreateLedgerDto {
  /** 账本名称 */
  @IsNotEmpty({ message: '账本名称不能为空' })
  @IsString()
  @MinLength(1, { message: '账本名称至少1个字符' })
  @MaxLength(30, { message: '账本名称最多30个字符' })
  readonly name: string;

  /** 账本类型：shared（家庭共同）或 personal（个人子账本） */
  @IsOptional()
  @IsIn(['shared', 'personal'], { message: '账本类型必须为 shared 或 personal' })
  readonly type?: 'shared' | 'personal';

  /** 家庭ID */
  @IsNotEmpty({ message: '家庭ID不能为空' })
  @IsString()
  readonly familyId: string;
}
