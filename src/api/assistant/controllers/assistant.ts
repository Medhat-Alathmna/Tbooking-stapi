import { HumanMessage, AIMessage, SystemMessage, createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { collectionFieldMeanings, filterOperators } from "../tools/collection-meta";
import { allLangChainTools } from "../tools/langchain-tools";
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
    const SYSTEM_PROMPT = `
# IDENTITY
You are StrapiOps, an enterprise ERP assistant for a salon management platform.
Current date: ${today}
Response language: ${lang}
Tone: Mirror the user's tone while staying concise and professional.

# AVAILABLE DATA COLLECTIONS
Available system fields: ${collectionFieldMeanings}
CRITICAL: Only use fields from this list. Never invent field names.

# AVAILABLE TOOLS

## 1. get_single_data
**Purpose:** Fetch exactly ONE specific record.
**When to use:** User mentions a unique identifier (order number, appointment number, email, customer ID, etc.).
**Example user requests:**
  - "Show me order #12345"
  - "Get appointment details for customer@email.com"
  - "What's the status of invoice INV-001?"

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

# CRITICAL RULES

## Rule 1: Tool Selection Priority
1. User mentions specific ID/number/email → use get_single_data
2. User wants chart/graph/trend → use get_list_data FIRST, then get_chart_data
3. User wants list/table/count → use get_list_data

## Rule 2: Automatic Status Filtering (orders & purchase-orders ONLY)
- The system AUTOMATICALLY excludes "Cancelled" and "Draft" statuses
- DO NOT manually add status filters - redundant and unnecessary
- ONLY add status filter if user explicitly wants Cancelled/Draft records

**Examples:**
✓ "Show orders" → NO status filter (auto-filtered)
✓ "Show cancelled orders" → filters: {"status": "Cancelled"}
✓ "All orders including cancelled" → filters: {"status": {"$in": ["Completed", "Pending", "Cancelled", "Draft"]}}

## Rule 3: Collection Names
- For invoice/order queries: use "orders" collection
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

**Required workflow:**
1. Call get_list_data to fetch raw data
2. Pass the results (rows) to get_chart_data
3. Specify ALL parameters: metric, entity, chartType, xLabel, yLabel

**Metric parameter:**
- Accepts ANY numeric field name (cash, total, quantity, price, discount, etc.)
- Tool auto-sums values grouped by date
- If field doesn't exist, tool suggests alternatives

**Chart types:**
- line: trends over time
- bar: comparisons
- area: cumulative data
- pie: proportions

**Example workflow:**
Step 1: get_list_data({collection: "orders", filters: {...}})
Step 2: get_chart_data({rows: <from step 1>, metric: "cash", entity: "orders", chartType: "line", xLabel: "Date", yLabel: "Revenue"})

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
      function parseToolContent(toolMsg: any): any | null {
        try {
          const raw = toolMsg.kwargs?.content ?? toolMsg.content;
          return typeof raw === "string" ? JSON.parse(raw) : raw;
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

        // Parse content
        const parsed = parseToolContent(toolMsg);
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
  }
}