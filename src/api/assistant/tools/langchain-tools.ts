import { tool } from "langchain";
import { z } from "zod";

import {
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
  collectionFieldMeanings,
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
              "Filters must be a JSON object (e.g., { \"createdAt\": { \"$gte\": \"2025-08-01T00:00\", \"$lte\": \"2025-08-31T23:59\" } }). Please resend `filters` as an object, not a JSON string. "
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

    return JSON.stringify(result);
  },
  {
    name: "get_list_data",
    description: `Fetch multiple ERP records (appointments, orders, purchase-orders, products, services, or users) with optional filters and populated relations.

  **Important:** Always pass filters as a JSON object, never as a string.
  Example: {"collection":"orders", "filters": {"status":{"$ne":"Cancelled"}, "createdAt": {"$gte":"2025-08-01T00:00","$lte":"2025-08-31T23:59"}}, "populate":["appointment"]}
  **Key guidelines:**
  - For "orders" collection: Always include populate: ["appointment"] to retrieve customer name.
- By DEFAULT, **exclude** records whose status equals "Cancelled" or "Draft" (filters": {"status":{"$ne":"Cancelled"}). 
- Only include "Cancelled" or "Draft" records if the user explicitly asks for them .  
`,
    schema: z.object({
      collection: z
        .enum(allowedCollections)
        .describe("Target collection name."),
      // Accept either object or string but prefer object
      filters: z.union([z.record(z.any()), z.string()])
        .describe(" Strapi-compatible filters. **Send as an object**, e.g. {\"status\":{\"$ne\":\"Cancelled\"}, \"createdAt\": {\"$gte\":\"2025-08-01T00:00\",\"$lte\":\"2025-08-31T23:59\"}}" +
          `  "you can use these operators in filters: " + ${filterOperatorsHint}`
        ),
      populate: z.array(z.string()).optional().describe('Optional relations to populate (["*"] fills everything).Always when collection has value an order , populate must include "appointment" to get customer name.'),
      sort: z.record(z.string()).optional(),
    })
  }
);
export const timeChartDataTool = tool(
  async ({
    metric,
    entity,
    chartType,
    xLabel,
    yLabel,
    rows, // optional — may also come per-series
  }) => {
    const opts = {
      metric,
      entity,
      chartType,
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
      "Optional. Array of raw records previously returned by get_list_data (result.data.results). " +
    "Preferred flow: the agent should first call get_list_data(...) and then call get_chart_data(...) passing those rows here. " +
    `,

    schema: z.object({
      rows: z.any().optional()
        .describe(
          "Don't call get_chart_data without rows" +
          "Raw rows previously fetched via get_list_data tool."

        ),
      metric: z
        .string()
        .describe(
          "Metric name (e.g. 'revenue', 'orders_count','cash',anything countable). " +
          "Represents the value being charted."
        ),

      entity: z
        .string()
        .describe(
          "Entity/collection name (e.g. 'orders', 'appointments')/ Dates. " +
          "Helps the agent map the metric to the right dataset."
        ),
      chartType: z
        .enum(["line", "bar", "area", "pie"])
        .describe("Preferred chart visualization type."),
      xLabel: z
        .string()
        .describe("X-axis label."),

      yLabel: z
        .string()
        .describe("Y-axis label"),
    })
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

export const allLangChainTools = [getListDataTool, getSingleDataTool, timeChartDataTool];

