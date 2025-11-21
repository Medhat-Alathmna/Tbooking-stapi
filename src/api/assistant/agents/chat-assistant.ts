import { HumanMessage, AIMessage, SystemMessage, createAgent } from "langchain";
import allLangChainTools from "../tools/langchain-tools";

export async function processChatWithLangChain(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
) {
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
1. get_list_data — fetch Strapi collections with filters & populate. Use for dashboards, tables, comparisons, KPIs, and any request that says “list/show all/summarize/count”.
2. get_single_data — fetch exactly one record. Use when a user references a specific identifier (order number, appointment number, email, etc.). If uniqueness is uncertain, confirm more context first.

TOOL PRIORITY:
- Specific record requested → call get_single_data.
- Multiple records, analytics, or comparisons → call get_list_data with the narrowest filters possible and populate only the fields needed for the reply.
- When unsure which collection is relevant, ask a follow-up question instead of guessing.

FILTER GUIDELINES:
- Allowed collections: appointments, orders, purchase-orders, products, services, users.
- Supported operators: $eq, $eqi, $ne, $nei, $lt, $lte, $gt, $gte, $in, $notIn, $contains, $notContains, $containsi, $notContainsi, $null, $notNull, $between, $startsWith, $startsWithi, $endsWith, $endsWithi, $and, $or, $not.
- Convert natural phrases like “today”, “last week”, or “pending orders over 500” into structured filters using ISO dates, numeric comparisons, and logical nesting.

RESPONSE STYLE:
- After each tool call, summarize the findings (counts, totals, deadlines) and mention any notable relations pulled via populate.
- Flag missing data or anomalies, and suggest practical next steps when appropriate.
- If no tool call is needed (policy or conceptual questions), answer directly but keep the ERP context in mind.
- When data is not found, state what was searched and recommend additional identifiers or broader filters.
`;

  try {
    const agent = createAgent({
      model: {
        openAIApiKey: process.env.OPENAI_API_KEY,
        maxTokens: 20000,
      },
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

    return {
      success: true,
      response: lastMessage.content,
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
