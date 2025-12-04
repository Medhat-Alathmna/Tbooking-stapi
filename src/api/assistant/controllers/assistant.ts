import { HumanMessage, AIMessage, SystemMessage, createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { collectionFieldMeanings, filterOperators } from "../tools/collection-meta";
import { allLangChainTools } from "../tools/langchain-tools";
import { toonStats, fromTOON } from "../tools/toon-official-wrapper";
module.exports = {
  async processChatWithLangChain(ctx: any) {
    const {
      userMessage,
      conversationHistory = [],
    } = ctx.request.body as {
      userMessage: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    };

    const today = new Date().toISOString().split("T")[0];
    const isArabic = /[\u0600-\u06FF]/.test(userMessage);
    const lang = isArabic ? "Arabic" : "English";

    // Format filter operators for LLM
    const filterOperatorsGuide = filterOperators
      .map(({ operator, description }) => `  ${operator}: ${description}`)
      .join("\n");

    const SYSTEM_PROMPT = `
# IDENTITY
You are StrapiOps, an enterprise ERP assistant for a salon management platform.
Current date: ${today}
Response language: ${lang}
Tone: Mirror the user's tone while staying concise and professional.

# AVAILABLE DATA COLLECTIONS
Available system fields per collection:
${JSON.stringify(collectionFieldMeanings, null, 2)}

CRITICAL: Only use fields from this list. Never invent field names.

# FILTER OPERATORS (REQUIRED FOR ALL FILTERS)
When creating filters, you MUST use these Strapi operators:
${filterOperatorsGuide}

**CRITICAL FILTER RULES:**
- NEVER send filters as plain values: ❌ {"status": "Unpaid"}
- ALWAYS use operators: ✅ {"status": {"$eq": "Unpaid"}}
- For equality: Use {"field": {"$eq": "value"}}
- For date ranges: Use {"createdAt": {"$gte": "2025-01-01T00:00", "$lte": "2025-01-31T23:59"}}
- For multiple values: Use {"status": {"$in": ["Paid", "Unpaid"]}}
- For exclusion: Use {"status": {"$ne": "Canceled"}}
- For text search: Use {"name": {"$containsi": "search term"}}

**FILTER EXAMPLES:**
✅ Single condition: {"status": {"$eq": "Paid"}}
✅ Date range: {"createdAt": {"$gte": "2025-08-01T00:00", "$lte": "2025-08-31T23:59"}}
✅ Multiple conditions: {"status": {"$eq": "Paid"}, "cash": {"$gte": 100}}
✅ Array values: {"status": {"$in": ["Paid", "Unpaid"]}}
✅ Text search: {"customer.firstName": {"$containsi": "john"}}
✅ Logical OR: {"$or": [{"status": {"$eq": "Paid"}}, {"cash": {"$gt": 1000}}]}

❌ WRONG: {"status": "Paid"}
❌ WRONG: {"createdAt": "2025-08-01"}
❌ WRONG: {"cash": 100}

# FIELD NAMING RULES
- Orders collection: Use "orderNo" (NOT invoiceNo, invoice_number, etc.)
- Always check field names in the list above before using them
- If unsure about a field name, ask the user for clarification

# AVAILABLE TOOLS

## 1. get_single_data
**Purpose:** Fetch exactly ONE specific record.
**When to use:** User mentions a unique identifier (order number, appointment number, email, customer ID, etc.).
**Example user requests:**
  - "Show me order #12345"
  - "Get appointment details for customer@email.com"
  - "What's the status of order ORD-123?"

## 2. get_list_data
**Purpose:** Fetch multiple records with optional filters.
**When to use:** User wants tables, lists, counts, KPIs, or says "show all/list".
**Example user requests:**
  - "Show me today's orders"
  - "List all appointments this week"
  - "How many orders in August?"

## 3. get_chart_data
**Purpose:** Transform data into time-series charts.
**When to use:** User requests trends, graphs, dashboards, comparisons, or performance over time.
**Example user requests:**
  - "Show revenue trend this month"
  - "Graph of appointments per day"
  - "Compare sales week by week"
  - "show chart of total order for last 10 months"

# CRITICAL RULES

## Rule 1: Tool Selection Priority
1. User mentions specific ID/number/email → use get_single_data
2. User wants chart/graph/trend → use get_chart_data (it fetches data internally)
3. User wants list/table/count → use get_list_data

## Rule 2: Automatic Soft Delete Filtering
- The system AUTOMATICALLY and PERMANENTLY excludes hidden records (hide: true) for collections: services, purchase-orders, products, vendors
- Hidden/deleted records are NEVER accessible, even if user requests them
- DO NOT manually add hide filters - they are enforced at the system level
- If user asks for hidden/deleted records, politely inform them that deleted records cannot be accessed

**Examples:**
✓ "Show products" → Returns only visible products (hide ≠ true)
✗ "Show hidden products" → Inform user: "Deleted products cannot be accessed"
✗ "All products including deleted" → Inform user: "Only active products can be displayed"

## Rule 3: Automatic Status Filtering (orders & purchase-orders ONLY)
- The system AUTOMATICALLY and PERMANENTLY excludes "Cancelled" and "Draft" statuses
- DO NOT manually add status filters for active records - they are enforced at the system level
- ONLY add status filter if user explicitly wants Cancelled/Draft records
- If no status filter provided, system automatically applies: status $notIn ['Canceled']

**Examples:**
✓ "Show orders" → NO status filter needed (system auto-applies $notIn ['Cancelled'])
✓ "Show cancelled orders" → filters: {"status": {"$eq": "Cancelled"}}
✓ "All orders including cancelled" → filters: {"status": {"$in": ["Completed", "Pending", "Cancelled", "Draft"]}}

## Rule 4: Collection Names
- For invoice/order queries: use "orders" collection with "orderNo" field
- For purchase queries: use "purchase-orders" collection
- NEVER invent collection names - ask if unclear

# TOOL-SPECIFIC GUIDELINES

## get_list_data Guidelines

**Filters (JSON object only):**
- ALWAYS send filters as object, NEVER as string
- Time ranges: Convert to ISO format {"createdAt": {"$gte": "YYYY-MM-DDT00:00", "$lte": "YYYY-MM-DDT23:59"}}
- No time mentioned → omit time filter
- Narrow filters → include specific constraints (dates, statuses, thresholds, names)
- "All" requested → omit filters entirely

**Populate (for relationships):**
- Collection is "orders" + need customer name → MUST include populate: ["appointment"]
- Only populate fields needed for the response
- Use ["*"] sparingly - only when explicitly needed

**Example:**
{"collection": "orders", "filters": {"createdAt": {"$gte": "2025-08-01T00:00", "$lte": "2025-08-31T23:59"}}, "populate": ["appointment"]}

## get_chart_data Guidelines

**Important:** This tool fetches data internally - you don't need to call get_list_data first!

**Required parameters:**
- collection: Target collection (orders, appointments, etc.)
- filters: Same as get_list_data (optional)
- populate: Same as get_list_data (optional)
- metric: Numeric field to aggregate (cash, total, quantity, price, discount, etc.)
- chartType: Visualization type
- xLabel: X-axis label
- yLabel: Y-axis label

**Metric parameter:**
- Accepts ANY numeric field name (cash, total, quantity, price, discount, etc.)
- Tool auto-sums values grouped by date
- If field doesn't exist, tool suggests alternatives

**Chart types:**
- line: trends over time
- bar: comparisons
- area: cumulative data
- pie: proportions

**Example:**
get_chart_data({
  collection: "orders",
  filters: {"createdAt": {"$gte": "2025-08-01T00:00", "$lte": "2025-08-31T23:59"}},
  metric: "cash",
  chartType: "line",
  xLabel: "Date",
  yLabel: "Revenue"
})

# FINAL REMINDERS
- Be precise and efficient
- Ask clarifying questions if uncertain
- Never guess field names, status values, or collection names
- Respond in ${lang} matching the user's formality level
`;

    try {
      const model = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        maxTokens: 400,
      });
      const agent = createAgent({
        model,
        tools: allLangChainTools,
      });


      const messages = [new SystemMessage(SYSTEM_PROMPT)];

      conversationHistory.forEach((msg) => {
        if (msg.role === "user") {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === "assistant") {
          messages.push(new AIMessage(msg.content));
        }
      });

      messages.push(new HumanMessage(userMessage));

      const result = await agent.invoke({ messages });
      const lastMessage = result.messages[result.messages.length - 1];

      const toolsUsed = result.messages
        .filter((msg: any) => msg.tool_calls?.length > 0)
        .flatMap((msg: any) => msg.tool_calls.map((tc: any) => tc.name));

      console.log("[LangChain] Tools used:", toolsUsed);

      // Helper: Check if a tool was actually used
      function isToolUsed(messages: any[], toolName: string): boolean {
        return messages.some(
          (m) => Array.isArray(m.tool_calls) &&
            m.tool_calls.some((tc) => tc.name === toolName)
        );
      }

      // Helper: Find tool message by name
      function findToolMessage(messages: any[], toolName: string): any {
        return messages.find((m) => m.name === toolName);
      }

      // Helper: Parse tool message content
      function parseToolContent(toolMsg: any, toolName: string): any | null {
        try {
          const raw = toolMsg.kwargs?.content ?? toolMsg.content;

          // If not a string, return as-is (already parsed)
          if (typeof raw !== "string") {
            return raw;
          }

          // get_list_data returns TOON format, decode it
          if (toolName === "get_list_data") {
            const decoded = fromTOON(raw);


            return decoded;
          }

          // Other tools return JSON
          return JSON.parse(raw);
        } catch (e) {
          console.error(`[Parse error for ${toolMsg.name}]:`, e);
          return null;
        }
      }

      // Helper: Extract list data result
      function extractListData(parsed: any): any[] {
        const payload = parsed.result ?? parsed;
        return payload.finalResults ?? payload.data?.results ?? [];
      }

      // Helper: Extract chart data result
      function extractChartData(parsed: any): any[] {
        if (process.env.NODE_ENV === 'development') {
          console.log('[get_chart_data result]:', parsed);
        }

        return parsed.series?.map((s) => ({
          metric: s.label,
          points: s.data.map((p) => p.value),
          labels: s.data.map((p) => p.date),
        })) ?? [];
      }

      // Helper: Extract single data result
      function extractSingleData(parsed: any): any {
        if (process.env.NODE_ENV === 'development') {
          console.log('[get_single_data result]:', parsed);
        }

        // Return the data as-is for LLM to process
        // Frontend will use the id + type to open the record
        return parsed.data ?? null;
      }

      // Main function: Extract tool result from LangChain response
      function extractToolResult(result, toolName: string) {
        const messages = result.messages || [];

        // Check if tool was used
        if (!isToolUsed(messages, toolName)) {
          return { used: false, data: null };
        }

        // Find tool message
        const toolMsg = findToolMessage(messages, toolName);
        if (!toolMsg) {
          return { used: true, data: null };
        }

        // Parse content (pass toolName to handle TOON format correctly)
        const parsed = parseToolContent(toolMsg, toolName);
        if (!parsed) {
          return { used: true, data: null };
        }

        // Extract data based on tool type
        switch (toolName) {
          case "get_list_data":
            return {
              used: true,
              data: extractListData(parsed),
            };

          case "get_chart_data":
            return {
              used: true,
              data: extractChartData(parsed),
            };

          case "get_single_data":
            return {
              used: true,
              data: extractSingleData(parsed),
            };

          default:
            return { used: true, data: parsed };
        }
      }

      // Extract tool results
      const listData = extractToolResult(result, "get_list_data");
      const chartData = extractToolResult(result, "get_chart_data");
      const singleData = extractToolResult(result, "get_single_data");


      return {
        success: true,
        response: lastMessage,
        chartData: chartData ?? null,
        listData: listData ?? null,
        singleData: singleData ?? null,
        result: result,
        usedTool: toolsUsed.length > 0,
        toolsUsed: [...new Set(toolsUsed)],
      };
    } catch (error) {
      console.error("[LangChain] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        response: "I'm sorry, I encountered an error processing your request.",
      };
    }
  },

  /**
   * Get TOON optimization statistics
   */
  async getToonStats(ctx: any) {
    try {
      const stats = toonStats.getStats();

      ctx.body = {
        success: true,
        stats: {
          ...stats,
          message: stats.totalCalls === 0
            ? "No TOON optimizations have been performed yet."
            : `TOON has optimized ${stats.totalCalls} requests, saving ${stats.percentageSaved}% tokens.`
        }
      };
    } catch (error) {
      console.error("[TOON Stats] Error:", error);
      ctx.body = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },

  /**
   * Reset TOON statistics
   */
  async resetToonStats(ctx: any) {
    try {
      toonStats.reset();

      ctx.body = {
        success: true,
        message: "TOON statistics have been reset."
      };
    } catch (error) {
      console.error("[TOON Stats Reset] Error:", error);
      ctx.body = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}