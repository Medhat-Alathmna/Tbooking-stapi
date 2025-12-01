

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
  const { rows , metric, entity, chartType, xLabel, yLabel } = opts;

  // Validate input data
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return {
      success: false,
      error: "No data rows provided. Please call get_list_data first to fetch data, then pass the results to get_chart_data."
    };
  }

  if (!metric || typeof metric !== 'string') {
    return {
      success: false,
      error: "Invalid metric specified. Please provide a valid metric name (e.g., 'revenue', 'cash', 'total')."
    };
  }

  // Log only in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('[get_chart_data] Options:', opts);
  }

  // Group data by day using createdAt or date field
  const grouped: Record<string, number> = {};
  let processedCount = 0;
  let skippedCount = 0;

  for (const r of rows) {
    // Extract date from createdAt or date field
    const d = r.createdAt
      ? new Date(r.createdAt).toISOString().slice(0,10)
      : (r.date ? new Date(r.date).toISOString().slice(0,10) : null);

    if (!d) {
      skippedCount++;
      continue;
    }

    // Extract numeric value from the specified metric
    let val = 0;

    // Check if the metric exists in the record
    if (r[metric] !== undefined && r[metric] !== null) {
      const numValue = Number(r[metric]);
      if (!isNaN(numValue)) {
        val = numValue;
        processedCount++;
      } else {
        skippedCount++;
        continue;
      }
    } else {
      // Metric field doesn't exist in this record
      skippedCount++;
      continue;
    }

    // Add to grouped data
    grouped[d] = (grouped[d] || 0) + val;
  }

  // Log statistics in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log(`[get_chart_data] Processed: ${processedCount}, Skipped: ${skippedCount}`);
  }

  // Convert to array and sort by date
  const seriesData = Object.entries(grouped)
    .sort((a,b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));

  if (seriesData.length === 0) {
    // Provide helpful error message
    const availableFields = rows.length > 0
      ? Object.keys(rows[0]).filter(k => typeof rows[0][k] === 'number').join(', ')
      : 'unknown';

    return {
      success: false,
      error: `No valid data found for metric "${metric}". ` +
             `The field "${metric}" either doesn't exist or contains no numeric values. ` +
             (availableFields !== 'unknown' && availableFields.length > 0
               ? `Available numeric fields: ${availableFields}`
               : 'No numeric fields found in the data.')
    };
  }

  const series = [{
    label: metric,
    data: seriesData
  }];

  return {
    success: true,
    series,
    summary: `Computed ${metric} for ${entity}`
  };
};