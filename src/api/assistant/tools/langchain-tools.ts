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
import { toTOON, calculateSavings, toonStats } from "./toon-official-wrapper";



const filterOperatorsHint = filterOperators
  .map(({ operator, description }) => `${operator}: ${description}`)
  .join("; ");

export const getListDataTool = tool(
  async ({ collection, filters, populate , limit }: any) => {
    // Auto-populate appointment for orders collection to get customer name
    if (collection === "orders" ) {
      if (!populate || !populate.includes("appointment")) {
        populate = populate ? [...populate, "appointment"] : ["appointment"];
      }
    }

    // Call the executor - it will handle filter normalization
    const result = await executeGetListData(collection, filters, populate,limit);

    // Convert to TOON format to reduce token usage
    const originalJSON = JSON.stringify(result);
    const toonJSON = toTOON(result);


    // Track statistics
    toonStats.track(originalJSON, toonJSON);

    // Log savings for monitoring
    const savings = calculateSavings(originalJSON, toonJSON);
    console.log(`[TOON] Token optimization: ${savings.percentage}% saved (${savings.saved} tokens)`);

    return toonJSON;
  },
  {
    name: "get_list_data",
    description: `Fetch multiple ERP records (appointments, orders, purchase-orders, products, services, or users) with optional filters and populated relations.

  **IMPORTANT - TOON FORMAT:**
  - Results are returned in Official TOON (Token-Oriented Object Notation) format
  - TOON uses YAML-like indentation with CSV-style tables for uniform arrays
  - Example TOON response:
    success: true
    data:
      results[3]{orderNo,customer,status,id,createdAt,cash}:
        ORD-123,John Doe,Completed,1,2025-08-15T10:30:45.123Z,1500
        ORD-124,Jane Smith,Pending,2,2025-08-16T14:22:10.456Z,2300
        ORD-125,Bob Wilson,Completed,3,2025-08-17T09:15:30.789Z,1800
      total: 3
  - Achieves ~40% fewer tokens than JSON
  - Human-readable and lossless

  **CRITICAL - FILTER FORMAT:**
  - ALWAYS use Strapi operators in filters (${filterOperatorsHint})
  - NEVER send plain values: ❌ {"status": "Unpaid"}
  - ALWAYS use operators: ✅ {"status": {"$eq": "Unpaid"}}

  **Filter Examples:**
  ✅ {"collection":"orders", "filters": {"createdAt": {"$gte":"2025-08-01T00:00","$lte":"2025-08-31T23:59"}}, "populate":["appointment"]}
  ✅ {"collection":"orders", "filters": {"status": {"$eq": "Paid"}, "cash": {"$gte": 100}}, "populate":["appointment"]}
  ✅ {"collection":"products", "filters": {"hide": {"$eq": false}}, "populate":[]}

  **Key guidelines:**
  - For "orders" collection: Always include populate: ["appointment"] to retrieve customer name.

  **AUTOMATIC STATUS FILTERING (orders & purchase-orders only):**
  - The system AUTOMATICALLY excludes "Cancelled" and "Draft" statuses.
  - Do NOT manually add status filters like {"status":{"$ne":"Cancelled"}} - this is redundant.
  - ONLY add status filters if user explicitly requests Cancelled/Draft records:
    • User wants cancelled: {"status": {"$eq": "Cancelled"}}
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
      limit: z.number().optional(),
    })
  }
);
export const timeChartDataTool = tool(
  async ({
    collection,
    filters,
    populate,
    metric,
    chartType,
    xLabel,
    yLabel,
  }) => {
    // Fetch data internally instead of receiving it from LLM
    // This prevents token overflow and JSON truncation issues
    const listResult = await executeGetListData(collection, filters, populate);

    if (!listResult.success || !listResult.data?.results) {
      return JSON.stringify({
        success: false,
        error: listResult.error || "Failed to fetch data for chart"
      });
    }

    const rows = listResult.data.results;
    const opts = {
      metric,
      entity: collection,
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
    description: `Transform data into time-series chart format for visualization.

**Purpose:** Fetches data and groups it by date, aggregating numeric values for chart visualization.

**When to use:**
- User requests trends, graphs, dashboards, or comparisons over time
- User asks for performance metrics across periods
- User wants visual representation of data

**Important:** This tool fetches data internally - you don't need to call get_list_data first!

**Example:**
  get_chart_data({
    collection: "orders",
    filters: {"createdAt": {"$gte": "2025-08-01T00:00", "$lte": "2025-08-31T23:59"}},
    metric: "cash",
    chartType: "line",
    xLabel: "Date",
    yLabel: "Revenue"
  })
`,

    schema: z.object({
      collection: z
        .enum(allowedCollections)
        .describe("Target collection name (orders, appointments, etc.)"),
      filters: z.union([z.record(z.any()), z.string()]).optional()
        .describe("Strapi-compatible filters (same as get_list_data)"),
      populate: z.array(z.string()).optional()
        .describe("Optional relations to populate (same as get_list_data)"),
      metric: z
        .string()
        .describe(
          "Metric name to chart - must be a numeric field. " +
          "Examples: 'cash', 'revenue', 'total', 'quantity', 'price', 'discount', etc. " +
          "The tool will aggregate (sum) this field's values grouped by date."
        ),
      chartType: z
        .enum(["line", "bar", "area", "pie"])
        .describe("Chart type: line for trends, bar for comparisons, area for cumulative, pie for proportions"),
      xLabel: z
        .string()
        .describe("Label for X-axis (typically time/date)"),
      yLabel: z
        .string()
        .describe("Label for Y-axis (typically the metric being measured)"),
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

