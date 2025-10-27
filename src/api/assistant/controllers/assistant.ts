const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const today = new Date().toISOString().split('T')[0];

/* ------------------------------------------------------------------
   🧩 1. Local helper functions
------------------------------------------------------------------- */

/**
 * Dynamically read Strapi collection schema info
 */
function getCollectionSchemaInfo(collectionName) {
  try {
    const schemaPath = path.join(
      process.cwd(),
      "src",
      "api",
      collectionName,
      "content-types",
      collectionName,
      "schema.json"
    );

    if (!fs.existsSync(schemaPath)) return null;

    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const attributes = schema.attributes || {};
    const fieldDescriptions = {};

    for (const [key, value] of Object.entries(attributes)) {
      if (typeof value === "object" && value !== null && "type" in value) {
        if (value.type === "enumeration" && "enum" in value) {
          const enumValues = Array.isArray(value.enum) ? value.enum.join(", ") : "";
          fieldDescriptions[key] = `Enum: ${enumValues}`;
        } else {
          fieldDescriptions[key] = value.type || "unknown";
        }

      } else {
        fieldDescriptions[key] = "unknown";
      }
    }

    return {
      name: schema.info.displayName,
      fields: fieldDescriptions,
      defaultDateField:
        Object.keys(attributes).find((k) =>
          ["date", "createdAt", "created_at"].includes(k)
        ) || "createdAt",
    };
  } catch (err) {
    console.error("Schema read error:", err.message);
    return null;
  }
}

/**
 * Custom business meanings for fields per collection
 */
function getCustomFieldMeaning(collectionName) {
  const customMeanings = {
    order: {
      id: { description: "Unique ID of the order" },
      createdAt: {
        description: "Date when the order was created (used for time filters).",
      },
      total: {
        description: "Total value of the order (including taxes & discounts).",
      },
      cash: { description: "Amount received from customer." },
      deposit: {
        description: "Deposit amount received before full payment.",
      },
      status: {
        description: "Order payment status and state of completion.",
        values: {
          paid: "fully paid — customer has paid the total amount.",
          unpaid:
            "partially paid — some money was received but not full amount.",
          canceled: "invoice canceled — exclude from financial summaries.",
        },
      },
      payment_method: {
        description: "Payment method (cash, card, bank transfer, etc.)",
      },
      employee: {
        description: "Employee who created or processed the order.",
      },
      branch: { description: "Branch where the order was created." },
    },

    "purchase-order": {
      id: { description: "Unique ID of the purchase order." },
      createdAt: {
        description: "Date when the purchase order was created (for date filters).",
      },
      vendor: { description: "Supplier/vendor related to this purchase order." },
      total: {
        description: "Total value of the purchase (including taxes and fees).",
      },
      paid: { description: "Amount paid to the vendor for this purchase order." },
      balance: { description: "Remaining unpaid amount." },
      status: {
        description: "Payment or processing status of the purchase order.",
        values: {
          paid: "fully paid — vendor fully compensated.",
          unpaid: "partially paid — some amount still due.",
          pending: "waiting for confirmation or payment — not finalized yet.",
          canceled: "purchase canceled — ignore from total sums or analytics.",
        },
      },
      payment_method: {
        description: "How the vendor was paid (cash, bank, transfer, etc.).",
      },
      note: { description: "Additional info or remarks about the purchase." },
    },
  };

  return customMeanings[collectionName] || {};
}

/* ------------------------------------------------------------------
   🧠 2. Main Assistant Controller
------------------------------------------------------------------- */

module.exports = {
  
  async chat(ctx) {
    try {
      const { message, type } = ctx.request.body;

      const entityMap = {
        order: "api::order.order",
        "purchase-order": "api::purchase-order.purchase-order",
        invoice: "api::invoice.invoice",
        employee: "api::employee.employee",
      };

      // 🧠 1️⃣ تحليل نية المستخدم
      const analyzePrompt = `

You are an ERP AI assistant analyzing a user's request.
Today's date is ${today}.
All time references (today, this week, this month) should be resolved based on this date.
If the user says "today", use from = to = current date.
If the user says "this week", compute start and end of current week based on current date.
If the user says "this month", compute first and last day of current month.
 Time Formatting Rules:
- Always include both date and time in ISO format.
- Start of day must be "T00:00".
- End of day must be "T23:59".
- Example:
  {
    "from": "2025-10-01T00:00",
    "to": "2025-10-07T23:59"
  }
Your goals:
1. Detect the user's intent:
   - "summary" → wants a text summary of data.
   - "dashboard" → wants a visual dashboard (charts, stats, tables).
   - "clarify" → unclear message, return guiding questions.
2. Identify the entity mentioned (orders, purchases, invoices, employees).
3. Identify the time range if mentioned (today, this week, this month, etc.).
4. If user mentions chart types like "line", "bar", "double bar", "pie", detect it as dashboardType.

Return structured JSON only:
{
  "intent": "dashboard",
  "entity": "order",
  "dashboardType": "bar",
  "needsDate": true,
 "from": "2025-10-01T00:00",
    "to": "2025-10-07T23:59"
}

;

      const analysis = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: analyzePrompt },
          { role: "user", content: message },
        ],
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(analysis.choices[0].message.content);
      console.log("🧩 [ANALYSIS RESULT]", parsed);

      if (parsed.intent === "clarify") {
        return ctx.send({
          type: "clarify",
          questions: parsed.questions || ["Can you clarify your request?"],
        });
      }

      const entity = type 
      const collection = entityMap[entity];
      if (!collection)
        return ctx.send({
          error: `Unknown entity '${entity}'.`,
          log: parsed,
        });

      // 🗃️ 2️⃣ جلب البيانات من Strapi
      let filters = parsed.filters || {};
      if (parsed.needsDate && parsed.from && parsed.to) {
        filters.createdAt = { $gte: parsed.from, $lte: parsed.to };
      }

      const data = await strapi.entityService.findMany(collection, { filters });
      console.log("📊 [DATA FETCHED]", data?.length || 0);

      // 🔎 3️⃣ تحديد نوع الإخراج
      if (!data || data.length === 0) {
        return ctx.send({
          reply: `No ${entity} data found for the specified period.`,
        });
      }

      // 🧾 حالة الملخص النصي
      if (parsed.intent === "summary") {
        const summaryPrompt = `
You are an ERP assistant summarizing structured data.
Summarize the JSON data clearly and concisely, in the user's language.

Rules:
- Reply in a professional, human tone (max 2–3 lines).
- If Arabic detected, respond in Arabic.
- Do not output raw JSON.

Examples:
Arabic: "تم العثور على 8 طلبات مدفوعة هذا الشهر بإجمالي 3500 دولار."
English: "Found 8 paid orders this month totaling $3500."
`;

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: summaryPrompt },
            { role: "user", content: JSON.stringify(data) },
          ],
        });

        const reply = completion.choices[0].message.content;
        return ctx.send({ type: "text", reply });
      }

      // 📊 حالة إنشاء داشبورد
      if (parsed.intent === "dashboard") {
        const dashboardPrompt = `
You are an ERP dashboard generator.

Input: JSON data from Strapi for the entity ${entity}.
The user requested a ${parsed.dashboardType || "bar"} dashboard visualization.

Generate only valid JSON:
{
  "type": "dashboard",
  "dashboardType": "${parsed.dashboardType || "bar"}",
  "title": "Dashboard for ${entity}",
  "period": { "from": "${parsed.from}", "to": "${parsed.to}" },
  "widgets": [
    {
      "type": "chart",
      "chartType": "${parsed.dashboardType || "bar"}",
      "label": "Daily Orders",
      "data": [
        { "date": "2025-10-01", "orders": 4 },
        { "date": "2025-10-02", "orders": 8 }
      ]
    },
    {
      "type": "stat",
      "label": "Total Revenue",
      "value": 12500,
      "unit": "USD"
    }
  ]
}

Respond with JSON only, no explanation.
`;

        const dashboardResponse = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: dashboardPrompt },
            { role: "user", content: JSON.stringify(data) },
          ],
          response_format: { type: "json_object" },
        });

        const dashboardJson = JSON.parse(
          dashboardResponse.choices[0].message.content
        );

        return ctx.send(dashboardJson);
      }

      // 🟡 احتياط: إذا لم يفهم النية
      return ctx.send({
        reply: "I couldn’t determine what you need. Try specifying 'summary' or 'dashboard'.",
        debug: parsed,
      });
    } catch (error) {
      console.error("❌ [Assistant Error]", error);
      ctx.send(
        {
          error: "Error analyzing or generating response.",
          details: error.message,
        },
        500
      );
    }
  },
};
