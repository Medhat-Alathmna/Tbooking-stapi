import { tool } from "langchain";
import { z } from "zod";

import  {
  allowedCollections,
  executeGetListData,
  type GetListDataInput,
} from "./get_list_data/execute";
import executeGetSingleData, {
  type GetSingleDataInput,
} from "./get_single_data/execute";
import {
  getCollectionRelations,
  getCustomFieldMeaning,
  filterOperators
} from "./collection-meta";
import { executeTimeChartDataTool } from "./get_chart_data/execute";



const filterOperatorsHint = filterOperators
  .map(({ operator, description }) => `${operator}: ${description}`)
  .join("; ");

export const getListDataTool = tool(
  async ({ collection, filters, populate, _userMessage }: any) => {
    // Normalize & validate filters (prefer object)
    let parsedFilters: Record<string, any> | undefined = undefined;

    // Accept object directly
    if (filters && typeof filters === "object" && !Array.isArray(filters)) {
      parsedFilters = filters;
    } else if (typeof filters === "string" && filters.trim()) {
      // If agent still sends string, attempt parse but prefer object next time
      try {
        parsedFilters = JSON.parse(filters);
        if (typeof parsedFilters !== "object" || Array.isArray(parsedFilters)) {
          // invalid shape
          return JSON.stringify({
            success: false,
            error:
              "Filters must be a JSON object (e.g., { \"createdAt\": { \"$gte\": \"2025-08-01T00:00\", \"$lte\": \"2025-08-31T23:59\" } }). Please resend `filters` as an object, not a JSON string."
          });
        }
      } catch (err: any) {
        return JSON.stringify({
          success: false,
          error:
            "Invalid filters JSON: " +
            (err?.message || String(err)) +
            ". Please provide filters as a JSON object (not a string). Example: {\"createdAt\": {\"$gte\":\"2025-08-01T00:00\",\"$lte\":\"2025-08-31T23:59\"}}"
        });
      }
    } else {
      // no filters provided -> undefined (means get all)
      parsedFilters = undefined;
    }

    // Call the executor with a real object (or undefined)
    const result = await executeGetListData(collection, parsedFilters, populate);

    return JSON.stringify({ result });
  },
  {
    name: "get_list_data",
    description: `Fetch multiple ERP records (appointments, orders, purchase-orders, products, services, or users) with optional filters and populated relations.

IMPORTANT: When calling this tool, pass 'filters' as a JSON object (not a JSON string). Example:
{"collection":"orders", "filters": {"createdAt": {"$gte":"2025-08-01T00:00","$lte":"2025-08-31T23:59"}}, "populate":["appointment"]}

If you send filters as a string and it's invalid JSON the tool will return a helpful error asking you to resend filters as an object.`,
    schema: z.object({
      collection: z
        .enum(allowedCollections)
        .describe("Target collection name."),
      // Accept either object or string but prefer object
      filters: z.union([z.record(z.any()), z.string()]).optional()
        .describe("Optional Strapi-compatible filters. **Send as an object**, e.g. {\"status\":{\"$eq\":\"paid\"}, \"createdAt\": {\"$gte\":\"2025-08-01T00:00\",\"$lte\":\"2025-08-31T23:59\"}}"),
      populate: z.array(z.string()).optional().describe('Optional relations to populate (["*"] fills everything).Always when collection has value an order , populate must include "appointment" to get customer name.'),
          fields: z.array(z.string()).optional(),
      preserveRecords: z.boolean().optional(),
      limit: z.number().optional(),
      sort: z.record(z.string()).optional(),
    })
  }
);
export const timeChartDataTool = tool(
  async ({
    series,
    metric,
    entity,
    startDate,
    endDate,
    relativePeriod,
    granularity,
    chartType,
    units,
    dataPoints = 30,
    xLabel,
    yLabel,
    rows, // optional — may also come per-series
  }) => {

    // Normalize single-series or fallback metric/entity
    const normalizedSeries =
      series && series.length
        ? series
        : metric
        ? [{ metric, label: metric, entity }]
        : entity
        ? [{ metric: "count", label: entity, entity }]
        : [];

    // Ensure valueField when a metric exists
    normalizedSeries.forEach((s) => {
      if (s.metric && !s.valueField) {
        s.valueField = s.metric;
      }
    });

    const opts = {
      series: normalizedSeries,
      startDate,
      endDate,
      relativePeriod,
      granularity,
      chartType,
      units,
      dataPoints,
      xLabel,
      yLabel,
      rows,
    };

    const result = await executeTimeChartDataTool(opts);
    return JSON.stringify(result);
  },

  {
    name: "get_chart_data",
    description: `
      Unified and flexible ERP charting tool.

      • Always call **get_list_data** first to fetch raw rows.
      • Supports single-series and multi-series chart generation.
      • The model may extract *any metric* the user requests.
      • Each series may include its own rows, filters, and metadata.
    `,

    schema: z.object({
      // Top-level rows (optional, but required in at least one place)
      rows: z
        .array(z.record(z.any()))
        .optional()
        .describe(
          "Raw rows from get_list_data. Required globally or per-series. " +
          "The chart cannot be computed without rows."
        ),

      // Multi-series mode
      series: z
        .array(
          z.object({
            metric: z
              .string()
              .optional()
              .describe(
                "Metric name (e.g. 'revenue', 'orders_count','cash',anything countable). " +
                "Represents the value being charted."
              ),

            entity: z
              .string()
              .optional()
              .describe(
                "Entity/collection name (e.g. 'orders', 'appointments'). " +
                "Helps the agent map the metric to the right dataset."
              ),

            filter: z
              .record(z.string())
              .optional()
              .describe(
                "Optional Strapi filter object. Must be a JSON object, not a JSON string."
              ),

            label: z
              .string()
              .optional()
              .describe(
                "Display label for the chart legend. Defaults to metric/entity."
              ),

            valueField: z
              .string()
              .optional()
              .describe(
                "The numeric field used for aggregation (e.g. 'total'). " +
                "If omitted, the tool will infer or fallback to counting."
              ),

            rows: z
              .array(z.record(z.any()))
              .optional()
              .describe(
                "Raw data for this specific series. If provided, overrides top-level rows."
              ),
          })
        )
        .optional()
        .describe(
          "Array of series definitions. Required for multi-series charts. " +
          "Each series may carry its own rows and filters."
        ),

      // Single-series shorthand
      metric: z
        .string()
        .optional()
        .describe(
          "Single-series shorthand metric (e.g. 'revenue', 'orders_count')."
        ),

      entity: z
        .string()
        .optional()
        .describe(
          "Shorthand entity name to disambiguate the metric."
        ),

      // Time range inputs
      startDate: z
        .string()
        .optional()
        .describe("ISO start date (YYYY-MM-DD or full ISO)."),

      endDate: z
        .string()
        .optional()
        .describe("ISO end date (YYYY-MM-DD or full ISO)."),

      relativePeriod: z
        .string()
        .optional()
        .describe(
          "Relative time period (e.g. '7d', '30d', '1m'). Converts to a date range automatically."
        ),

      // Chart configuration
      granularity: z
        .enum(["hour", "day", "week", "month"])
        .optional()
        .describe("Time bucket granularity for the x-axis."),

      chartType: z
        .enum(["line", "bar", "area", "pie"])
        .optional()
        .describe("Preferred chart visualization type."),

      dataPoints: z
        .number()
        .default(30)
        .describe("Target number of data points (the engine may auto-adjust)."),

      xLabel: z
        .string()
        .optional()
        .describe("X-axis label."),

      yLabel: z
        .string()
        .optional()
        .describe("Y-axis label. Often depends on the metric."),
    }),
  }
);

export const getSingleDataTool = tool(
  async (input: GetSingleDataInput) => {
    const result = await executeGetSingleData(
      input,
      // Strapi instance is resolved inside execute() when not provided.
    );

    return JSON.stringify(result);
  },
  {
    name: "get_single_data",
    description: `Fetch exactly one ERP record (appointments, orders, purchase-orders, products, services, or users) using precise filters and optional populated relations.

Use this tool when a user references a specific identifier (order/invoice number, appointment number, email, etc.) and expects a single match.
- Provide the most specific filters available to avoid multiple matches.
- If you need related data, list the relations in populate or set ["*"] only when absolutely necessary.`,
    schema: z.object({
      collection: z
        .enum(allowedCollections)
        .describe(
          "Target collection name. One of appointments, orders (Invoices), purchase-orders, products, services, users."
        ),
      filters: z
        .record(z.string(), z.unknown())
        .describe(
          `Required Strapi filters identifying the record. Supported operators: ${filterOperatorsHint}. Include at least one unique field (e.g. orderNo, appointment number, email).`
        ),
      populate: z
        .array(z.string())
        .optional()
        .describe(
          'Optional relations to populate (["*"] fills everything, otherwise list relation keys).'
        ),
    }),
  }
);

export const allLangChainTools = [getListDataTool, getSingleDataTool,timeChartDataTool];

