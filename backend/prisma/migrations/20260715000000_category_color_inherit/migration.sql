-- 分类颜色继承支持
-- 让 color 可空，空值表示「继承父级(一级)分类颜色」
-- 命名：20260715000000_category_color_inherit

-- 一级分类始终自身带色；二级分类 color 为 null 时视为继承父级颜色
ALTER TABLE "categories" ALTER COLUMN "color" DROP NOT NULL;
