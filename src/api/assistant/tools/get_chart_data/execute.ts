

export type SeriesInput = {
  metric?: string; // e.g. "revenue", "orders_count", "new_users"
  label?: string;
  entity?: string;
  filter?: Record<string, any>;
  valueField?: string; // optional hint which field contains numeric value
  rows?: any[]; // optional: rows already attached to this series
};

export type ChartOpts = {
    metric:string,
    entity:string,
    chartType:string,
    xLabel:string,
    yLabel:string,
    rows:any[], 
};

export const executeTimeChartDataTool = async (
  opts: ChartOpts
): Promise<any> => {
  const { rows = [], metric, entity, chartType, xLabel, yLabel } = opts;
  // بسيط: group by day using createdAt or date field
  const grouped: Record<string, number> = {};
  for (const r of rows || []) {
    const d = r.createdAt ? new Date(r.createdAt).toISOString().slice(0,10) : (r.date ? new Date(r.date).toISOString().slice(0,10) : null);
    if (!d) continue;
    const val = Number(r[metric] ?? r.cash ?? r.total ?? 0);
    grouped[d] = (grouped[d] || 0) + (isNaN(val) ? 0 : val);
  }
  const seriesData = Object.entries(grouped)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));

  const series = [{
    label: metric,
    data: seriesData
  }];

  return { series, summary: `Computed ${metric} for ${entity}` };
};