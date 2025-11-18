const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
import { get_encoding } from "tiktoken";
import { encoding_for_model } from "tiktoken";
import { encode } from '@toon-format/toon'

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
      id: { description: "Unique internal order ID.(Do not display it)" },
      orderNo: { description: "This is Unique order Number (Display field)" },
      customer: { description: "Customer who placed the order. Use  (firstName + middleName + lastName ). for labels. from appointment schema" },
      appointment: { description: "Linked appointment record (if any). Connects order to schedule data." },
      cash: { description: "Amount paid by customer and it's called payment (use in revenue dashboards)." },
      total: { description: "Total order value  (used for comparisons with cash)." },
      status: {
        description: "Order payment status.",
        values: {
          paid: "Fully paid.",
          unpaid: "Partially paid.",
          canceled: "Canceled — exclude from analytics.",
        },
      },
      employee: { description: "Employee who handled the order." },
      createdAt: { description: "Order creation date." },
    },

    appointment: {
      id: { description: "Unique appointment ID." },
      customer: { description: "Client who booked the appointment (firstName + middleName + lastName for labels)." },
      employee: { description: "Assigned employee (employee.name for performance dashboards)." },
      fromDate: { description: "Appointment start date and time." },
      toDate: { description: "Appointment end date and time." },
      cash: { description: "Service price booked in the appointment." },
      approved: { description: "Indicates if the appointment is approved." },
      deposit: { description: "Deposit amount paid at booking." },
      paid: { description: "Amount paid (deposit or full payment)." },
      employees: { description: "List of employees involved in the appointment, also has a services JSON booked in at appointment, may be multi employees and their have own services every each." },
      products: { description: "Products booked in the appointment." },
      status: {
        description: "Appointment status.",
        values: {
          Draft: "Appointment drafted.",
          Completed: "Appointment completed. that's mean converted to order.",
          Canceled: "Appointment canceled (ignore).",
        },
      },
      order: { description: "Related order created after appointment completion (appointment.order)." },
    },

    "purchase-order": {
      id: { description: "Purchase order ID." },
      vendor: { description: "Supplier/vendor (vendor.name for labels)." },
      paid: { description: "Amount paid to vendor." },
      total: { description: "Total purchase value." },
      status: { description: "Purchase order status." },
      createdAt: { description: "Date of purchase order creation." },
    },
}
return customMeanings[collectionName] || {};
}

/* ------------------------------------------------------------------
   🧠 2. Main Assistant Controller
------------------------------------------------------------------- */

module.exports = {
  
async chat(ctx) {
  try {
    const { message, type } = ctx.request.body;
    const today = new Date().toISOString().split("T")[0];
    const entity = (type || "order").toLowerCase();
const isArabic = /[\u0600-\u06FF]/.test(message);
const lang = isArabic ? "Arabic" : "English";
    // 🧩 معلومات الحقول والعلاقات
    const schemaInfo = getCustomFieldMeaning(entity);
    const relations = {
      order: ["appointment", "customer", "employee"],
      appointment: ["order", "customer", "employee"],
      "purchase-order": ["vendor"],
    };

    const entityMap = {
      order: "api::order.order",
      "purchase-order": "api::purchase-order.purchase-order",
      appointment: "api::appointment.appointment",
      invoice: "api::invoice.invoice",
      employee: "api::employee.employee",
    };

    // 🧠 1️⃣ تحليل النية والفترة الزمنية
    const analyzePrompt = `
You are an advanced ERP AI Assistant.
Today’s date: ${today}.
User language: ${lang}.

Context:
- You assist in analyzing, summarizing, and visualizing ERP data.
- Below are field meanings and relationships for the selected entity.

Fields:
${JSON.stringify(schemaInfo, null, 2)}

Relations:
${JSON.stringify(relations[entity] || [], null, 2)}

Your goals:
1. Detect the user's intent: "summary", "dashboard", or "clarify".
2. Detect any time range (today, last month, this week, etc.) and return ISO dates:
   {"from": "YYYY-MM-DDT00:00", "to": "YYYY-MM-DDT23:59"}
3. Suggest dashboard type (bar, line, pie, double-bar) if user asks for visual data.
4. Exclude canceled or invalid records automatically.
5. If no intent is clear, default to "summary".
6. Return ONLY JSON using this exact format:

{
  "intent": "summary" | "dashboard" | "clarify",
  "title": "string",
  "entity": "${entity}",
  "period": {"from": "YYYY-MM-DDTHH:mm", "to": "YYYY-MM-DDTHH:mm"},
  "dashboardType": "bar" | "line" | "pie" | null,
  "filters": {},
  "summary": {"text": "string"},
  "suggestions": []
}
`;

    const analysis = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: analyzePrompt },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(analysis.choices[0].message.content || "{}");

    // 🟡 Clarify step
    if (parsed.intent === "clarify") {
      return ctx.send({
        type: "clarify",
        title: parsed.title || "توضيح مطلوب",
        entity,
        summary: parsed.summary || { text: "هل يمكنك توضيح المطلوب أكثر؟" },
        suggestions:
          parsed.suggestions || [
            "هل ترغب بعرض ملخص أم لوحة بيانية؟",
            "هل تريد بيانات هذا الشهر أم السابقة؟",
          ],
      });
    }

    // 🧭 2️⃣ جلب البيانات من Strapi
    const collection = entityMap[entity];
    if (!collection)
      return ctx.send({
        type: "clarify",
        summary: { text: `⚠️ الكيان '${entity}' غير معروف.` },
        suggestions: Object.keys(entityMap),
      });

    const filters = parsed.filters || {};
    if (parsed.period?.from && parsed.period?.to) {
      filters.createdAt = {
        $gte: parsed.period.from,
        $lte: parsed.period.to,
      };
    }
const encoder = encoding_for_model("gpt-4o-mini");
    const data:any = await strapi.entityService.findMany(collection, {
      filters,
      populate: '*',
    });
const dataJson = JSON.stringify(data);

// Now it's a string, safe for encode()
const systemTokens = encoder.encode(dataJson).length;
    console.log(`🗂️ [${entity}] Data tokens: ${systemTokens}`);

    const toonData = encode(data);
    const toonTokens = encoder.encode(toonData).length;

    console.log(`🗂️ [${entity}] Toon Data tokens: ${toonTokens}`);

    if (!data?.length) {
      return ctx.send({
        type: "summary",
        entity,
        summary: {
          text: `لم يتم العثور على أي بيانات لـ ${entity} في الفترة المحددة.`,
        },
        suggestions: [
          "هل ترغب بتوسيع النطاق الزمني؟",
          "هل تريد عرض بيانات الشهر الماضي؟",
        ],
      });
    }

    // 🧠 3️⃣ إرسال البيانات الفعلية إلى GPT للتحليل النهائي
    const dataPrompt = `
  You are a data analyst for an ERP system.
  The user said: "${message}".
  Below is real JSON data from the "${entity}" collection.
  User language: ${lang}.
  do not translate field names or values, keep them as is.
  Analyze the numeric fields (total, cash, discount).
  Your tasks:
  - If intent = "summary": write a clear ${lang} summary (max 3 lines).
  - If intent = "dashboard":
     - Use human-readable labels (${schemaInfo}).
     - Create one or more widgets: charts or stats or table.
     - Each widget must have clear and realistic data points.
     - For each widget, provide insightful discussion that includes (give your discussion in a field called "discussion"):
     • Key trends and patterns in the data
     • Notable changes or anomalies
     • Business recommendations based on the data
     • Potential actions to improve performance
     • Risk factors to consider
     - Avoid repeating the same widget structure as before — always recalculate.
     - Return valid JSON only.
     - summarize data's widgets(label,value) in a field called "widgetsSummary" .
     

  Output format (always use this exact structure):
  {
    "type": "dashboard" | "summary", 
    "title": "string",
    "entity": "${entity}",
    "period": ${JSON.stringify(parsed.period || {})},
    "dashboardType": "${parsed.dashboardType || "bar"}",
    "widgets": [
    {
      "type": "chart",
      "chartType": "bar" | "line" | "pie",
      "label": "string",
      "data": [{"label": "string", "value": number}],
      "unit": "string",
      "widgetsSummary": "string",
      "discussion": "string - provide actionable insights, trends analysis, and business recommendations",
    },
    {
      "type": "stat",
      "label": "string", 
      "data": [{"label": "count", "value": number}],
      "unit": "string"
    }
    ],
    "summary": {"text": "string"},
    "suggestions": ["string", "string"]
  }
  `;

    const fullAnalysis = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: dataPrompt },
        { role: "user", content: JSON.stringify(data) },
      ],
    });

    const aiOutput = fullAnalysis.choices[0].message.content.trim();
const outTokens = encoder.encode(aiOutput).length;
    console.log(`🗂️ [${entity}] Data tokens: ${outTokens}`);

    let finalJSON;
    try {
      finalJSON = JSON.parse(aiOutput);
    } catch (err) {
      console.error("⚠️ JSON Parse Error:", err.message);
      return ctx.send({
        type: "summary",
        entity,
        summary: { text: "تم تحليل البيانات، لكن الرد لم يكن بتنسيق JSON صالح." },
      });
    }

    // ✅ إرسال النتيجة النهائية
    ctx.send(finalJSON);
  } catch (error) {
    console.error("❌ [Assistant Error]", error);
    ctx.send(
      {
        error: "حدث خطأ أثناء تحليل البيانات.",
        details: error.message,
      },
      500
    );
  }
}

};
