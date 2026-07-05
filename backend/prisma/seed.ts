import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Prisma 数据库种子脚本
 * 初始化默认分类数据（对齐国标8大类 + 收入分类）
 * 运行命令：npm run seed
 */

const prisma = new PrismaClient();

// 默认支出分类（国标8大类）
const defaultExpenseCategories = [
  {
    name: '食品烟酒',
    icon: 'Utensils',
    color: '#FF6B6B',
    sortOrder: 1,
    children: [
      { name: '米面粮油', icon: 'Wheat', color: '#FF6B6B' },
      { name: '蔬菜水果', icon: 'Apple', color: '#FF8E8E' },
      { name: '肉禽蛋奶', icon: 'Drumstick', color: '#FF7676' },
      { name: '在外就餐', icon: 'Utensils', color: '#FF5252' },
      { name: '零食饮料', icon: 'Coffee', color: '#FF9999' },
      { name: '烟酒', icon: 'Wine', color: '#E05050' },
    ],
  },
  {
    name: '衣着',
    icon: 'Shirt',
    color: '#4ECDC4',
    sortOrder: 2,
    children: [
      { name: '服装', icon: 'Shirt', color: '#4ECDC4' },
      { name: '鞋帽', icon: 'Footprints', color: '#45B7AA' },
      { name: '配饰', icon: 'Glasses', color: '#5DD5CD' },
    ],
  },
  {
    name: '居住',
    icon: 'Home',
    color: '#45B7D1',
    sortOrder: 3,
    children: [
      { name: '房租', icon: 'Building', color: '#45B7D1' },
      { name: '水电燃气', icon: 'Zap', color: '#52C5DE' },
      { name: '物业费', icon: 'Building2', color: '#3DA8C4' },
      { name: '房屋维修', icon: 'Wrench', color: '#5ACFE8' },
    ],
  },
  {
    name: '生活用品及服务',
    icon: 'ShoppingBag',
    color: '#96CEB4',
    sortOrder: 4,
    children: [
      { name: '日用杂品', icon: 'ShoppingCart', color: '#96CEB4' },
      { name: '个人护理', icon: 'Sparkles', color: '#84BFA6' },
      { name: '家居装饰', icon: 'Sofa', color: '#A8D8C2' },
    ],
  },
  {
    name: '交通通信',
    icon: 'Car',
    color: '#FFEAA7',
    sortOrder: 5,
    children: [
      { name: '公共交通', icon: 'Bus', color: '#FFEAA7' },
      { name: '出租车/网约车', icon: 'Car', color: '#FDD663' },
      { name: '私家车', icon: 'CarFront', color: '#F5CE5A' },
      { name: '通讯费', icon: 'Phone', color: '#FFE066' },
      { name: '邮递', icon: 'Package', color: '#FFDF85' },
    ],
  },
  {
    name: '教育文化娱乐',
    icon: 'BookOpen',
    color: '#DDA0DD',
    sortOrder: 6,
    children: [
      { name: '教育', icon: 'GraduationCap', color: '#DDA0DD' },
      { name: '文化娱乐', icon: 'Film', color: '#C48EC4' },
      { name: '旅游', icon: 'Plane', color: '#E2B4E2' },
      { name: '体育', icon: 'Dumbbell', color: '#CFA0CF' },
    ],
  },
  {
    name: '医疗保健',
    icon: 'HeartPulse',
    color: '#FF8C94',
    sortOrder: 7,
    children: [
      { name: '门诊', icon: 'Stethoscope', color: '#FF8C94' },
      { name: '药品', icon: 'Pill', color: '#FF7782' },
      { name: '保健', icon: 'HeartPulse', color: '#FFA0A8' },
    ],
  },
  {
    name: '其他用品和服务',
    icon: 'MoreHorizontal',
    color: '#A8A8A8',
    sortOrder: 8,
    children: [
      { name: '转账', icon: 'ArrowLeftRight', color: '#A8A8A8' },
      { name: '红包礼金', icon: 'Gift', color: '#B4B4B4' },
      { name: '其他', icon: 'MoreHorizontal', color: '#969696' },
    ],
  },
];

// 默认收入分类
const defaultIncomeCategories = [
  {
    name: '工资收入',
    icon: 'Banknote',
    color: '#00C896',
    sortOrder: 1,
    children: [
      { name: '基本工资', icon: 'Banknote', color: '#00C896' },
      { name: '奖金', icon: 'Gift', color: '#1FE8B0' },
      { name: '加班费', icon: 'Clock', color: '#00A87E' },
    ],
  },
  {
    name: '经营收入',
    icon: 'Store',
    color: '#008866',
    sortOrder: 2,
    children: [
      { name: '销售收入', icon: 'ShoppingCart', color: '#008866' },
      { name: '服务收入', icon: 'Handshake', color: '#006E52' },
    ],
  },
  {
    name: '投资收益',
    icon: 'TrendingUp',
    color: '#005841',
    sortOrder: 3,
    children: [
      { name: '利息', icon: 'Percent', color: '#005841' },
      { name: '股息', icon: 'TrendingUp', color: '#003D2C' },
      { name: '基金收益', icon: 'ChartLine', color: '#006E52' },
    ],
  },
  {
    name: '其他收入',
    icon: 'Plus',
    color: '#00A87E',
    sortOrder: 4,
    children: [
      { name: '退款', icon: 'RotateCcw', color: '#00A87E' },
      { name: '红包', icon: 'Gift', color: '#1FE8B0' },
      { name: '其他', icon: 'Plus', color: '#008866' },
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
