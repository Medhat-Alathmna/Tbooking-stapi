import { HumanMessage, AIMessage, SystemMessage, createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { filterOperators } from "../tools/collection-meta";
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
You are StrapiOps, an enterprise ERP assistant embedded in a salon management platform.
Date: ${today}.
Respond in ${lang} and mirror the user's tone while staying concise and professional.

MISSION:
- Decide whether the user needs a single record or a list/summary before calling tools.
- Translate natural-language constraints into precise Strapi filters and populate settings.
- Highlight totals, statuses, dates, and actionable follow-ups whenever data is returned.
- Ask for clarification when identifiers or filters are ambiguous before invoking tools.

TOOLBOX:
1. get_list_data — fetch Strapi collections with filters & populate. Use for  tables,, KPIs, and any request that says “list/show all/summarize/count”, Don't forget the current time date is Date: ${today}.
2. get_single_data — fetch exactly one record. Use when a user references a specific identifier (order number, appointment number, email, etc.). If uniqueness is uncertain, confirm more context first.
3. get_chart_data -- fetch time-series data for charts (e.g., revenue over time, appointments per day). Use when the user requests trends, graphs,dashboards,comparison or performance over periods.



TOOL PRIORITY:
- Specific record requested → call get_single_data.
- Multiple records → call get_list_data with the narrowest filters possible and populate only the fields needed for the reply.
- When unsure which collection is relevant, ask a follow-up question instead of guessing.

****get_list_data*****
- Detect any time range (today, last month, this week, etc.) and return ISO dates (get_list_data):
   {"from": "YYYY-MM-DDT00:00", "to": "YYYY-MM-DDT23:59"}
- If not mentioned a time range,do not add date time filter.   
Important for get_list_data:
- Always pass 'filters' as a JSON OBJECT (not a string). Example:
  {"collection":"orders", "filters": {"createdAt": {"$gte":"2025-08-01T00:00","$lte":"2025-08-31T23:59"}}, "populate":["appointment"]}
- When collection is "orders" and you need customer name, always include populate: ["appointment"].  
- ignore paymentMethod filed
***get_chart_data***
- When want to call get_chart_data , First call get_list_data and then call get_chart_data until get_chart_data tool take his data form get_list_data tool
Correct: filters is an object.
Incorrect: filters is a JSON string like "{\"createdAt\":{\"$gte\":\"...\",\"$lte\":\"...\"}}"

If you are not sure what fields exist, ask the user a clarifying question before calling the tool.
When possible, include a narrow 'where' filter (dates, statuses, customer id) rather than fetching everything.
GUIDELINES:
- If the user asks for a narrowed list (dates, statuses, numeric thresholds, customer name, etc.) you MUST include a 'filters' object in the tool call.
- If the user asked "all" or didn't specify constraints, omit filters.
- When asking for orders prefer populate: [\"appointment\"] to include Customer name (first+middle+last).
IMPORTANT RULE FOR CHARTS:
get_chart_data REQUIRES RAW DATA (rows). 
You MUST always call get_list_data FIRST to fetch the records, 
then pass its result.rows into get_chart_data.

Never call get_chart_data directly without rows.
 If get_chart_data is called without rows, this is an error. 
You must re-run get_list_data, then re-call get_chart_data with rows

RESPONSE STYLE:
- After each tool call, summarize the findings (counts, totals, deadlines,filters) and mention any notable relations pulled via populate.

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
      function extractToolResult(result, toolName) {
        const messages = result.messages || [];

        // هل استُخدم فعلاً؟
        const used = messages.some(
          (m) => Array.isArray(m.tool_calls) &&
            m.tool_calls.some((tc) => tc.name === toolName)
        );

        if (!used) return { used: false, data: null };

        // استخراج ToolMessage مربوط بالأداة
        const toolMsg = messages.find(
          (m) => m.name === toolName);





        if (!toolMsg) return { used: true, data: null };

        let parsed;
        try {
          const raw = toolMsg.kwargs?.content ?? toolMsg.content;
          parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          console.log('paresed:',parsed);
          
        } catch (e) {
          console.error("Parse error:", e);
          return { used: true, data: null };
        }


        switch (toolName) {

          case "get_list_data": {
            const payload = parsed.result ?? parsed;
            const finalResults = payload.finalResults ?? payload.data?.results ?? [];
            return {
              used: true,
              data: finalResults,       // ← جاهزة لمكوّن جدول
            };
          }

          case "get_chart_data": {
            const payload = parsed;
            console.log(payload);
            
            const arr = payload.series?.map((s) => ({
              metal: s.metal,
              points: s.data.map((p) => p.value),
              labels: s.data.map((p) => p.date),
            })) ?? [];
            return {
              used: true,
              data: arr,
            };
          }

          case "get_weight_value": {
            return {
              used: true,
              data: parsed.value ?? parsed.result ?? parsed,
              raw: parsed
            };
          }

          default:
            return { used: true, data: parsed };
        }
      }

      // استخراج نتيجة أداة get_list_data
      const listData = extractToolResult(result, "get_list_data");

      // استخراج نتيجة أداة get_time_chart_data
      const chartData = extractToolResult(result, "get_chart_data");


      return {
        success: true,
        response: lastMessage,
        chartData: chartData ?? null,
        listData: listData ?? null,
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