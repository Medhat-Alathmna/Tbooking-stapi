
import { HumanMessage, AIMessage, SystemMessage } from "langchain/schema";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import allLangChainTools from "../tools/langchain-tools";

export default ({ strapi }) => ({
  async processChat(userMessage, conversationHistory = []) {
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
      const llm = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: "gpt-4o-mini",
        temperature: 0,
      });

      const prompt = ChatPromptTemplate.fromMessages([
        new SystemMessage(SYSTEM_PROMPT),
        new MessagesPlaceholder("chat_history"),
        new HumanMessage(userMessage),
        new MessagesPlaceholder("agent_scratchpad"),
      ]);

      const agent = await createOpenAIFunctionsAgent({
        llm,
        tools: allLangChainTools,
        prompt,
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools: allLangChainTools,
      });

      const messages = [];

      conversationHistory.forEach((msg) => {
        if (msg.role === "user") {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === "assistant") {
          messages.push(new AIMessage(msg.content));
        }
      });

      const result = await agentExecutor.invoke({
        input: userMessage,
        chat_history: messages,
      });

      return {
        success: true,
        response: result.output,
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
});
