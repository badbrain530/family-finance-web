import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { cn } from '@/lib/utils';

/**
 * ECharts 折线图封装组件
 * 用于收支趋势展示
 */

interface LineChartProps {
  /** X轴标签 */
  xLabels: string[];
  /** 数据系列 */
  series: Array<{
    name: string;
    data: number[];
    color?: string;
    areaStyle?: boolean;
  }>;
  /** 高度 */
  height?: number | string;
  /** 是否显示图例 */
  showLegend?: boolean;
  /** 是否平滑曲线 */
  smooth?: boolean;
  className?: string;
}

export function LineChart({
  xLabels,
  series,
  height = 300,
  showLegend = true,
  smooth = true,
  className,
}: LineChartProps) {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#E2E8F0',
      borderWidth: 1,
      textStyle: {
        color: '#0F172A',
        fontSize: 13,
      },
      formatter: (params: any) => {
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0].axisValue}</div>`;
        params.forEach((item: any) => {
          const val = Number(item.value).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          html += `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${item.color}"></span>
            <span style="color:#64748B">${item.seriesName}</span>
            <span style="font-weight:600;margin-left:auto">¥${val}</span>
          </div>`;
        });
        return html;
      },
    },
    legend: showLegend
      ? {
          show: true,
          bottom: 0,
          icon: 'circle',
          itemWidth: 8,
          itemHeight: 8,
          textStyle: {
            color: '#64748B',
            fontSize: 12,
          },
        }
      : { show: false },
    grid: {
      left: '3%',
      right: '3%',
      top: '5%',
      bottom: showLegend ? '15%' : '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: xLabels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#E2E8F0' } },
      axisTick: { show: false },
      axisLabel: {
        color: '#94A3B8',
        fontSize: 12,
      },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#F1F5F9' } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#94A3B8',
        fontSize: 12,
        formatter: (val: number) => {
          if (val >= 10000) return `${(val / 10000).toFixed(1)}万`;
          return val.toString();
        },
      },
    },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth,
      symbol: 'circle',
      symbolSize: 6,
      showSymbol: false,
      lineStyle: {
        width: 2,
        color: s.color || '#00C896',
      },
      itemStyle: {
        color: s.color || '#00C896',
      },
      areaStyle: s.areaStyle
        ? {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: (s.color || '#00C896') + '33' },
                { offset: 1, color: (s.color || '#00C896') + '05' },
              ],
            },
          }
        : undefined,
    })),
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
