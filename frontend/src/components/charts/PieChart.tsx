import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { cn } from '@/lib/utils';

/**
 * ECharts 饼图封装组件
 * 用于分类支出占比展示
 */

interface PieChartProps {
  /** 数据项 */
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  /** 高度 */
  height?: number | string;
  /** 是否显示为环形图 */
  ring?: boolean;
  /** 环形图中心文字 */
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

export function PieChart({
  data,
  height = 300,
  ring = true,
  centerLabel,
  centerValue,
  className,
}: PieChartProps) {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#E2E8F0',
      borderWidth: 1,
      textStyle: { color: '#0F172A', fontSize: 13 },
      formatter: (params: any) => {
        const val = Number(params.value).toLocaleString('zh-CN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return `<div style="display:flex;align-items:center;gap:6px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span>
          <span>${params.name}</span>
          <span style="font-weight:600;margin-left:8px">¥${val}</span>
          <span style="color:#94A3B8">(${params.percent}%)</span>
        </div>`;
      },
    },
    legend: {
      orient: 'horizontal',
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: {
        color: '#64748B',
        fontSize: 12,
      },
    },
    series: [
      {
        type: 'pie',
        radius: ring ? ['45%', '70%'] : '70%',
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: !ring,
          color: '#64748B',
          fontSize: 12,
        },
        labelLine: {
          show: !ring,
          lineStyle: { color: '#E2E8F0' },
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
          },
        },
        data: data.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: d.color ? { color: d.color } : undefined,
        })),
      },
    ],
    graphic: ring && (centerLabel || centerValue)
      ? ([
          {
            type: 'text',
            left: 'center',
            top: '38%',
            style: {
              text: centerLabel || '',
              textAlign: 'center',
              fill: '#94A3B8',
              fontSize: 12,
            },
          },
          {
            type: 'text',
            left: 'center',
            top: '46%',
            style: {
              text: centerValue || '',
              textAlign: 'center',
              fill: '#0F172A',
              fontSize: 20,
              fontWeight: 'bold',
            },
          },
        ] as any)
      : undefined,
  };

  return (
    <div className={cn('w-full', className)}>
      <ReactECharts
        option={option}
        style={{ height }}
        opts={{ renderer: 'svg' }}
        notMerge
      />
    </div>
  );
}
