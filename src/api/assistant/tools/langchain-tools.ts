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
    // Call the executor - it will handle filter normalization
    const result = await executeGetListData(collection, filters, populate);
    return JSON.stringify(result);
  },
  {
    name: "get_list_data",
    description: `Fetch multiple ERP records (appointments, orders, purchase-orders, products, services, or users) with optional filters and populated relations.

  **Important:** Always pass filters as a JSON object, never as a string.
  Example: {"collection":"orders", "filters": {"createdAt": {"$gte":"2025-08-01T00:00","$lte":"2025-08-31T23:59"}}, "populate":["appointment"]}

  **Key guidelines:**
  - For "orders" collection: Always include populate: ["appointment"] to retrieve customer name.

  **AUTOMATIC STATUS FILTERING (orders & purchase-orders only):**
  - The system AUTOMATICALLY excludes "Cancelled" and "Draft" statuses.
  - Do NOT manually add status filters like {"status":{"$ne":"Cancelled"}} - this is redundant.
  - ONLY add status filters if user explicitly requests Cancelled/Draft records:
    • User wants cancelled: {"status": "Cancelled"}
    • User wants all including cancelled: {"status": {"$in": ["Cancelled", "Draft", "Completed", "Pending"]}}
`,
    schema: z.object({
      collection: z
        .enum(allowedCollections)
        .describe("Target collection name."),
      // Accept either object or string but prefer object
      filters: z.union([z.record(z.any()), z.string()]).optional()
        .describe(
          "Strapi-compatible filters. **Send as an object**, e.g. {\"createdAt\": {\"$gte\":\"2025-08-01T00:00\",\"$lte\":\"2025-08-31T23:59\"}}. " +
          "Available operators: " + filterOperatorsHint + ". " +
          "Note: For orders/purchase-orders, 'Cancelled' and 'Draft' are auto-excluded unless you specify otherwise."
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
    rows,
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
    description: `Transform raw data into time-series chart format for visualization.

**Important workflow:**
1. First, call get_list_data to fetch the raw records
2. Then, call get_chart_data with those records to generate chart data

**Purpose:** Groups data by date and aggregates numeric values for chart visualization.

**When to use:**
- User requests trends, graphs, dashboards, or comparisons over time
- User asks for performance metrics across periods
- User wants visual representation of data

**Example:**
First fetch data:
  get_list_data({collection: "orders", filters: {...}})
Then create chart:
  get_chart_data({rows: <results from get_list_data>, metric: "cash", entity: "orders", chartType: "line", ...})
`,

    schema: z.object({
      rows: z.any()
        .describe(
          "REQUIRED. Raw data rows previously fetched via get_list_data tool. " +
          "Do NOT call get_chart_data without rows. " +
          "Pass the 'results' array from get_list_data response."
        ),
      metric: z
        .string()
        .describe(
          "Metric name to chart - must be a numeric field from the data rows. " +
          "Examples: 'cash', 'revenue', 'total', 'quantity', 'price', 'discount', etc. " +
          "The tool will aggregate (sum) this field's values grouped by date. " +
          "If the field doesn't exist, the tool will return an error with available numeric fields."
        ),

      entity: z
        .string()
        .describe(
          "Entity/collection name (e.g. 'orders', 'appointments'). " +
          "Used for context and summary messages."
        ),
      chartType: z
        .enum(["line", "bar", "area", "pie"])
        .describe("Chart visualization type. Choose based on data nature: line for trends, bar for comparisons, area for cumulative data, pie for proportions."),
      xLabel: z
        .string()
        .describe("Label for X-axis (typically time/date)."),

      yLabel: z
        .string()
        .describe("Label for Y-axis (typically the metric being measured)."),
    })
  }
);

export const getSingleDataTool = tool(
  async (input: GetSingleDataInput) => {
    const result = await executeGetSingleData(input);
    return JSON.stringify(result);
  },
  {
    name: "get_single_data",
    description: `Fetch exactly ONE specific ERP record by unique identifier.

**Purpose:** Retrieve a single record's ID and type for frontend to open detailed view.

**When to use:**
- User mentions a specific identifier (order number, email, ID, name, etc.)
- User asks for details about a particular record
- User wants to view/edit/delete a specific item

**Returns:**
- Single match: {id, type, displayName, record} - Frontend uses id+type to open the record
- Multiple matches: {multiple: true, matches: [{id, type, displayName}...]} - Ask user to be more specific
- No match: {success: false, error: "..."} - Inform user record not found

**Important notes:**
- For "orders" collection, customer name is auto-populated for displayName
- NO automatic status filtering - shows even Cancelled/Draft records (user requested specific ID)
- The tool returns the full record for you to describe to the user naturally

**Example usage:**
User: "Show me order ORD-123"
Call: get_single_data({collection: "orders", filters: {"orderNo": "ORD-123"}})
Response: You describe the order naturally using the returned record data`,

    schema: z.object({
      collection: z
        .enum(allowedCollections)
        .describe(
          "Target collection name. One of: appointments, orders, purchase-orders, products, services, users."
        ),
      filters: z
        .record(z.string(), z.unknown())
        .describe(
          `Strapi filters to identify the specific record. ` +
          `Supported operators: ${filterOperatorsHint}. ` +
          `Examples: {"orderNo": "ORD-123"}, {"email": "user@example.com"}, {"id": 456}`
        ),
      populate: z
        .array(z.string())
        .optional()
        .describe(
          'Optional relations to populate. For "orders", appointment.customer is auto-populated. ' +
          'Use ["*"] only when you need all relations.'
        ),
    }),
  }
);

export const allLangChainTools = [getListDataTool, getSingleDataTool, timeChartDataTool];

