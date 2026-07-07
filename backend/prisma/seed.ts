import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Prisma 数据库种子脚本
 * 初始化默认分类数据（对齐国标8大类 + 收入分类）
 * 运行命令：npm run seed
 *
 * 图标字段说明：icon 存储的是「图标 key」（见前端 features/categories/categoryIconMeta.ts
 * 的 CategoryIconKey，例如 'dining' / 'transport' / 'other'），而非旧版 lucide 图标名；
 * color 为对应设计 token 十六进制色。结构与前端 categories.ts 保持一致。
 */

const prisma = new PrismaClient();

// 默认支出分类（国标8大类）
const defaultExpenseCategories = [
  {
    name: '食品烟酒',
    icon: 'dining',
    color: '#F97316',
    sortOrder: 1,
    children: [
      { name: '米面粮油', icon: 'dining', color: '#F97316' },
      { name: '蔬菜水果', icon: 'dining', color: '#F97316' },
      { name: '肉禽蛋奶', icon: 'dining', color: '#F97316' },
      { name: '在外就餐', icon: 'dining', color: '#F97316' },
      { name: '零食饮料', icon: 'dining', color: '#F97316' },
      { name: '烟酒', icon: 'dining', color: '#F97316' },
    ],
  },
  {
    name: '衣着',
    icon: 'clothing',
    color: '#A855F7',
    sortOrder: 2,
    children: [
      { name: '服装', icon: 'clothing', color: '#A855F7' },
      { name: '鞋帽', icon: 'clothing', color: '#A855F7' },
      { name: '配饰', icon: 'clothing', color: '#A855F7' },
    ],
  },
  {
    name: '居住',
    icon: 'home',
    color: '#8B5CF6',
    sortOrder: 3,
    children: [
      { name: '房租', icon: 'home', color: '#8B5CF6' },
      { name: '水电燃气', icon: 'home', color: '#8B5CF6' },
      { name: '物业费', icon: 'home', color: '#8B5CF6' },
      { name: '房屋维修', icon: 'home', color: '#8B5CF6' },
    ],
  },
  {
    name: '生活用品及服务',
    icon: 'shopping',
    color: '#EC4899',
    sortOrder: 4,
    children: [
      { name: '日用杂品', icon: 'shopping', color: '#EC4899' },
      { name: '个人护理', icon: 'beauty', color: '#DB2777' },
      { name: '家居装饰', icon: 'home', color: '#8B5CF6' },
    ],
  },
  {
    name: '交通通信',
    icon: 'transport',
    color: '#0EA5E9',
    sortOrder: 5,
    children: [
      { name: '公共交通', icon: 'transport', color: '#0EA5E9' },
      { name: '出租车/网约车', icon: 'transport', color: '#0EA5E9' },
      { name: '私家车', icon: 'transport', color: '#0EA5E9' },
      { name: '通讯费', icon: 'communication', color: '#6366F1' },
      { name: '邮递', icon: 'communication', color: '#6366F1' },
    ],
  },
  {
    name: '教育文化娱乐',
    icon: 'education',
    color: '#14B8A6',
    sortOrder: 6,
    children: [
      { name: '教育', icon: 'education', color: '#14B8A6' },
      { name: '文化娱乐', icon: 'entertainment', color: '#F43F5E' },
      { name: '旅游', icon: 'travel', color: '#06B6D4' },
      { name: '体育', icon: 'sports', color: '#16A34A' },
    ],
  },
  {
    name: '医疗保健',
    icon: 'medical',
    color: '#10B981',
    sortOrder: 7,
    children: [
      { name: '门诊', icon: 'medical', color: '#10B981' },
      { name: '药品', icon: 'medical', color: '#10B981' },
      { name: '保健', icon: 'medical', color: '#10B981' },
    ],
  },
  {
    name: '其他用品和服务',
    icon: 'other',
    color: '#94A3B8',
    sortOrder: 8,
    children: [
      { name: '转账', icon: 'other', color: '#94A3B8' },
      { name: '红包礼金', icon: 'other', color: '#94A3B8' },
      { name: '其他', icon: 'other', color: '#94A3B8' },
    ],
  },
];

// 默认收入分类
const defaultIncomeCategories = [
  {
    name: '工资收入',
    icon: 'salary',
    color: '#22C55E',
    sortOrder: 1,
    children: [
      { name: '基本工资', icon: 'salary', color: '#22C55E' },
      { name: '奖金', icon: 'bonus', color: '#EAB308' },
      { name: '加班费', icon: 'salary', color: '#22C55E' },
    ],
  },
  {
    name: '经营收入',
    icon: 'other',
    color: '#94A3B8',
    sortOrder: 2,
    children: [
      { name: '销售收入', icon: 'other', color: '#94A3B8' },
      { name: '服务收入', icon: 'other', color: '#94A3B8' },
    ],
  },
  {
    name: '投资收益',
    icon: 'investment',
    color: '#3B82F6',
    sortOrder: 3,
    children: [
      { name: '利息', icon: 'investment', color: '#3B82F6' },
      { name: '股息', icon: 'investment', color: '#3B82F6' },
      { name: '基金收益', icon: 'finance', color: '#2563EB' },
    ],
  },
  {
    name: '其他收入',
    icon: 'other',
    color: '#94A3B8',
    sortOrder: 4,
    children: [
      { name: '退款', icon: 'other', color: '#94A3B8' },
      { name: '红包', icon: 'redpacket', color: '#EF4444' },
      { name: '其他', icon: 'other', color: '#94A3B8' },
    ],
  },
];

async function main(): Promise<void> {
  console.log('开始种子数据初始化...');

  // 1. 创建测试用户
  const passwordHash = await bcrypt.hash('test123456', 10);
  const testUser = await prisma.user.upsert({
    where: { phone: '13800138000' },
    update: {},
    create: {
      phone: '13800138000',
      passwordHash,
      nickname: '测试用户',
    },
  });
  console.log(`创建测试用户: ${testUser.nickname} (${testUser.phone})`);

  // 2. 创建测试家庭
  const testFamily = await prisma.family.upsert({
    where: { inviteCode: 'TEST01' },
    update: {},
    create: {
      name: '测试家庭',
      ownerId: testUser.id,
      inviteCode: 'TEST01',
      inviteCodeExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
    },
  });
  console.log(`创建测试家庭: ${testFamily.name}`);

  // 3. 创建家庭成员关系
  await prisma.familyMember.upsert({
    where: {
      familyId_userId: {
        familyId: testFamily.id,
        userId: testUser.id,
      },
    },
    update: {},
    create: {
      familyId: testFamily.id,
      userId: testUser.id,
      role: 'OWNER',
    },
  });
  console.log('创建家庭成员关系: OWNER');

  // 4. 创建家庭共同账本
  await prisma.ledger.upsert({
    where: {
      id: 'shared-ledger-001',
    },
    update: {},
    create: {
      id: 'shared-ledger-001',
      familyId: testFamily.id,
      type: 'SHARED',
      name: '家庭共同账本',
    },
  });
  console.log('创建家庭共同账本');

  // 5. 创建默认分类（支出+收入）
  console.log('创建默认分类...');

  // 先清除旧分类（如果存在）
  await prisma.category.deleteMany({
    where: { familyId: testFamily.id, isSystem: true },
  });

  // 创建支出分类
  for (const cat of defaultExpenseCategories) {
    const parent = await prisma.category.create({
      data: {
        familyId: testFamily.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cat.sortOrder,
        isSystem: true,
      },
    });

    for (const child of cat.children) {
      await prisma.category.create({
        data: {
          familyId: testFamily.id,
          parentId: parent.id,
          name: child.name,
          icon: child.icon,
          color: child.color,
          sortOrder: 0,
          isSystem: true,
        },
      });
    }
  }
  console.log(`创建 ${defaultExpenseCategories.length} 个支出一级分类`);

  // 创建收入分类
  for (const cat of defaultIncomeCategories) {
    const parent = await prisma.category.create({
      data: {
        familyId: testFamily.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        sortOrder: cat.sortOrder + 100, // 收入分类排序从101开始
        isSystem: true,
      },
    });

    for (const child of cat.children) {
      await prisma.category.create({
        data: {
          familyId: testFamily.id,
          parentId: parent.id,
          name: child.name,
          icon: child.icon,
          color: child.color,
          sortOrder: 0,
          isSystem: true,
        },
      });
    }
  }
  console.log(`创建 ${defaultIncomeCategories.length} 个收入一级分类`);

  console.log('种子数据初始化完成！');
  console.log('---');
  console.log('测试账号信息：');
  console.log(`  手机号: ${testUser.phone}`);
  console.log('  密码: test123456');
  console.log(`  家庭: ${testFamily.name}`);
  console.log(`  邀请码: ${testFamily.inviteCode}`);
}

main()
  .catch((error) => {
    console.error('种子数据初始化失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
