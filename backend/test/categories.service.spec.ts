import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/modules/families/families.service';

/**
 * 回归测试：commit 1d152f5
 *   fix(categories): 二级分类图标颜色继承一级，支持单独覆盖
 *
 * 验证 CategoriesService.resolveInheritedColors 的继承契约：
 *   resolvedColor = node.color == null ? (parentColor ?? FALLBACK_COLOR) : node.color
 *   inheritColor  = node.color == null
 *   FALLBACK_COLOR = '#94A3B8'
 */
describe('CategoriesService.resolveInheritedColors (颜色继承回归)', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const prisma = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    const familiesService = {
      validateFamilyMember: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: FamiliesService, useValue: familiesService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // 通过 any 访问私有方法（仅测试用途，不改变被测源码）
  const resolve = (nodes: any[], parentColor: string | null = null): any[] =>
    (service as any).resolveInheritedColors(nodes, parentColor);

  it('① 二级/三级继承父级真实颜色，显式覆盖保留自身色', () => {
    // 构造分类树（扁平结构，带 children 已是树形）
    const tree = [
      {
        id: 'P1',
        name: '一级-P1',
        color: '#FF0000',
        children: [
          {
            id: 'C1',
            name: '二级-C1',
            color: null, // 继承父级
            children: [
              {
                id: 'GC1',
                name: '三级-GC1',
                color: null, // 继承父级
                children: [],
              },
            ],
          },
          {
            id: 'C2',
            name: '二级-C2',
            color: '#00FF00', // 显式覆盖
            children: [],
          },
        ],
      },
    ];

    const result = resolve(tree, null);
    const p1 = result[0];
    const c1 = p1.children[0];
    const gc1 = c1.children[0];
    const c2 = p1.children[1];

    // 一级：自身色，不继承
    expect(p1.color).toBe('#FF0000');
    expect(p1.inheritColor).toBe(false);

    // 二级 C1：继承父级真实色，inheritColor=true
    expect(c1.color).toBe('#FF0000');
    expect(c1.inheritColor).toBe(true);

    // 三级 GC1：继续继承（来自祖父 P1 透传），inheritColor=true
    expect(gc1.color).toBe('#FF0000');
    expect(gc1.inheritColor).toBe(true);

    // 二级 C2：显式覆盖色，inheritColor=false
    expect(c2.color).toBe('#00FF00');
    expect(c2.inheritColor).toBe(false);
  });

  it('② 顶层节点 color 为 null 时回退到 FALLBACK_COLOR #94A3B8', () => {
    const tree = [
      {
        id: 'X1',
        name: '顶层-空色',
        color: null,
        children: [],
      },
    ];

    const [x1] = resolve(tree, null);
    expect(x1.color).toBe('#94A3B8');
    expect(x1.inheritColor).toBe(true);
  });

  it('③ 父级 null 色情况下，子级仍回退到 FALLBACK_COLOR', () => {
    // 极端场景：父级自身也是 null（走兜底），子级继续继承兜底色
    const tree = [
      {
        id: 'Y1',
        name: '顶层-空色',
        color: null,
        children: [
          {
            id: 'Y2',
            name: '子级-空色',
            color: null,
            children: [],
          },
        ],
      },
    ];

    const [y1] = resolve(tree, null);
    const y2 = y1.children[0];
    expect(y1.color).toBe('#94A3B8');
    expect(y2.color).toBe('#94A3B8');
    expect(y2.inheritColor).toBe(true);
  });
});
