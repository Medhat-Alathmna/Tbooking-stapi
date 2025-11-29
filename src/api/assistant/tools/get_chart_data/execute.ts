// File: tools/get_chart_data/excute.ts
// Implementation of executeTimeChartDataTool used by the agent.
// This file expects the agent to call get_list_data first and then pass
// the raw rows into this function via the get_chart_data tool call.

export type SeriesInput = {
  metric?: string; // e.g. "revenue", "orders_count", "new_users"
  label?: string;
  entity?: string;
  filter?: Record<string, any>;
  valueField?: string; // optional hint which field contains numeric value
  rows?: any[]; // optional: rows already attached to this series
};

export type ChartOpts = {
  series?: SeriesInput[];
  rows?: any[]; // fallback: single rows array for single-series calls
  timeField?: string; // e.g. "createdAt" or "fromDate"
  granularity?: "hour" | "day" | "week" | "month";
  startDate?: string; // ISO
  endDate?: string; // ISO
  relativePeriod?: string; // e.g. "7d", "30d"
  dataPoints?: number;
  chartType?: string;
  xLabel?: string;
  yLabel?: string;
  options?: {
    zeroFill?: boolean; // default true
    fillValue?: number | null; // default 0
    topN?: number; // for categorical
  };
};

const toISODate = (d: Date) => d.toISOString().split("T")[0];

const parseDate = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
};

function formatBucket(date: Date, gran: string) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  if (gran === "hour") {
    const h = date.getUTCHours();
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00Z`;
  }
  if (gran === "day") {
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (gran === "month") {
    return `${y}-${String(m).padStart(2, "0")}`;
  }
  // week: compute ISO week (simple approximate: week starting Monday)
  // We'll compute week-year label like YYYY-Www
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // get day of week (0 Sun..6 Sat), convert to Monday-based
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  // Thursday in current week decides the year
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const weekYear = tmp.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const diff = Math.round((tmp.getTime() - firstThursday.getTime()) / 86400000);
  const week = 1 + Math.floor(diff / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function iterateBuckets(start: Date, end: Date, gran: string) {
  const buckets: string[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), start.getUTCHours()));
  if (gran === "hour") {
    while (cur <= end) {
      buckets.push(formatBucket(cur, gran));
      cur.setUTCHours(cur.getUTCHours() + 1);
    }
    return buckets;
  }
  if (gran === "day") {
    cur.setUTCHours(0, 0, 0, 0);
    while (cur <= end) {
      buckets.push(formatBucket(cur, gran));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return buckets;
  }
  if (gran === "month") {
    cur.setUTCDate(1);
    cur.setUTCHours(0, 0, 0, 0);
    while (cur <= end) {
      buckets.push(formatBucket(cur, gran));
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return buckets;
  }
  // week
  cur.setUTCHours(0, 0, 0, 0);
  // move to Monday of the current week
  const dayNum = (cur.getUTCDay() + 6) % 7;
  cur.setUTCDate(cur.getUTCDate() - dayNum);
  while (cur <= end) {
    buckets.push(formatBucket(cur, "week"));
    cur.setUTCDate(cur.getUTCDate() + 7);
  }
  return buckets;
}

function getValueByPath(obj: any, path?: string) {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function inferValueFieldFromMetric(metric?: string) {
  if (!metric) return undefined;
  const m = metric.toLowerCase();
  if (m.includes("revenue") || m.includes("sales") || m.includes("total") || m.includes("amount") || m.includes("cash")) return "total";
  if (m.includes("price")) return "price";
  if (m.includes("stock")) return "stock";
  if (m.includes("quantity") || m.includes("qty") || m.includes("sold")) return "quantity";
  // count-like metrics don't need valueField
  return undefined;
}

// Supported aggregations: count, sum (by valueField), avg (if requested). We'll default to count if no valueField.

export async function executeTimeChartDataTool(opts: ChartOpts) {
  const {
    series,
    rows,
    timeField,
    granularity,
    startDate: sStart,
    endDate: sEnd,
    relativePeriod,
    xLabel,
    yLabel,
    dataPoints,
    options = { zeroFill: true, fillValue: 0 },
    chartType = "line",
  } = opts as ChartOpts & { options?: any };

  // If caller passed rows at root and no series with rows, create default series
  const workingSeries: SeriesInput[] = [];
  if ((!series || series.length === 0) && rows) {
    workingSeries.push({ metric: "count", label: "series", rows });
  } else if (series && series.length) {
    // attach global rows if provided
    for (const s of series) {
      if (!s.rows && rows) s.rows = rows;
      workingSeries.push({ ...s });
    }
  }
  console.log(opts);

  // Determine global start/end from provided values or from rows or from relativePeriod
  let start = parseDate(sStart) || null;
  let end = parseDate(sEnd) || null;

  if (!start || !end) {
    // attempt to derive from rows if available
    const sampleRows = (rows || (workingSeries[0] && workingSeries[0].rows) || []).slice(0, 1000);
    const dates: Date[] = [];
    for (const r of sampleRows) {
      const v = getValueByPath(r, timeField) || r[timeField];
      const pd = parseDate(typeof v === "string" ? v : null);
      if (pd) dates.push(pd);
    }
    if (dates.length) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      start = start || dates[0];
      end = end || dates[dates.length - 1];
    }
  }

  // relativePeriod like '7d' or '30d'
  if ((!start || !end) && relativePeriod) {
    const match = String(relativePeriod).match(/(\d+)d/);
    if (match) {
      const days = parseInt(match[1], 10);
      const now = new Date();
      const st = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const ed = new Date(st);
      ed.setUTCDate(st.getUTCDate() + days - 1);
      start = start || st;
      end = end || ed;
    }
  }

  // Final fallback: last 30 days
  if (!start || !end) {
    const now = new Date();
    const ed = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const st = new Date(ed);
    st.setUTCDate(st.getUTCDate() - 29);
    start = start || st;
    end = end || ed;
  }

  // Ensure start <= end
  if (start.getTime() > end.getTime()) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const buckets = iterateBuckets(start, end, granularity);

  // For each series, aggregate
  const datasets: Array<{ label: string; data: number[]; meta?: any }> = [];
  console.log('workingSeries : ',workingSeries);
  
  for (const s of workingSeries) {
    
    const sRows = s.rows || [];
    const label = s.label || s.metric || "series";

    const valueField = s.valueField || inferValueFieldFromMetric(s.metric);
    const aggIsCount = !valueField || (s.metric || /count|number|users|appointments/i.test(s.metric));

    // map bucket -> value
    const map = new Map<string, number>();
    for (const b of buckets) map.set(b, 0);

    for (const r of sRows) {
      const tval = getValueByPath(r, timeField) || r[timeField];
      const pd = parseDate(typeof tval === "string" ? tval : null);
      if (!pd) continue; // skip rows without valid date
      const bkey = formatBucket(pd, granularity);
      if (!map.has(bkey)) {
        // row falls outside computed buckets -> ignore
        continue;
      }
      if (aggIsCount) {
        map.set(bkey, (map.get(bkey) || 0) + 1);
      } else {
        // sum numeric field
        const raw = getValueByPath(r, valueField) ?? r[valueField];
        const n = typeof raw === "number" ? raw : parseFloat(String(raw || "0").replace(/[^0-9.-]+/g, ""));
        if (!isNaN(n)) map.set(bkey, (map.get(bkey) || 0) + n);
      }
    }

    const data = buckets.map((b) => {
      const v = map.get(b) ?? 0;
      return (options.zeroFill ? v : (v === 0 ? null : v));
    });

    datasets.push({ label, data, meta: { metric: s.metric, entity: s.entity, valueField } });
  }

  // summary
  const summary = {
    start: formatBucket(start, "day"),
    end: formatBucket(end, "day"),
    totalPerSeries: datasets.map((d) => ({ label: d.label, total: d.data.reduce((a, b) => a + (b || 0), 0) })),
  };

  return {
    labels: buckets,
    datasets,
    chartType,
    dataPoints,
    xLabel,
    yLabel,
    summary,
  };
}



// =====================================================================================
// File: notes - How to wire this to the agent (for your reference)
// - The agent should call get_list_data and request `preserveRecords: true` or `fields` required.
// - Then the agent sends the returned rows into the get_chart_data tool as part of the `series[].rows` or `rows` root field.
// - get_chart_data (this execute) will aggregate and return chart-ready JSON.
// =====================================================================================
