const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = {
  async chat(ctx) {
    try {
      const { message, type } = ctx.request.body;

      // 🧩 تعريف أنواع البيانات المسموح بها
      const entityMap = {
        order: "api::order.order",
        purchases: "api::purchase.purchase",
        invoices: "api::invoice.invoice",
        employees: "api::employee.employee",
      };

      // 🧭 1️⃣ أرسل الطلب الأول لتحليل نية المستخدم والفترة الزمنية
      const analyzePrompt = `
        أنت مساعد ذكي لنظام ERP.
        حلل النص الذي سأرسله لتحديد:
        - نوع البيانات (sales, purchases, invoices, employees)
        - هل يتضمن فترة زمنية (مثل اليوم، الأسبوع الماضي، الشهر الحالي...)
        - إذا نعم، احسب التواريخ بدقة بصيغة YYYY-MM-DD بناءً على التاريخ الحالي ${new Date().toISOString().split('T')[0]}.

        أعد الرد في شكل JSON فقط بدون أي شرح، بالمثال التالي:
        {
          "entity": "sales",
          "needsDate": true,
          "from": "2025-10-01",
          "to": "2025-10-09"
        }

        إذا لم يذكر المستخدم أي فترة زمنية، اجعل:
        {
          "entity": "sales",
          "needsDate": false
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

      const parsed = JSON.parse(analysis.choices[0].message.content);

      // 🔎 تحديد الكيان
      const entity = parsed.entity || type || "sales";
      const collection = entityMap[entity];
      if (!collection) {
        return ctx.send({ error: `النوع '${entity}' غير معروف.` }, 400);
      }

      // 🧩 2️⃣ جلب البيانات من Strapi
      let filters:any = {};
      if (parsed.needsDate && parsed.from && parsed.to) {
        filters.createdAt = { $gte: parsed.from, $lte: parsed.to };
      }

      const data = await strapi.entityService.findMany(collection, { filters });

      if (!data || data.length === 0) {
        return ctx.send({
          reply: `لم يتم العثور على بيانات (${entity}) في الفترة المطلوبة.`,
        });
      }

      // 🧠 3️⃣ إرسال البيانات إلى GPT لتحليلها بالعربية
      const summaryPrompt = `
        أنت مساعد ذكاء اصطناعي متخصص في تحليل بيانات ERP.
        أرسل لك بيانات ${entity} بصيغة JSON.
        قم بتلخيصها للمستخدم بالعربية، متضمنًا:
        - عدد السجلات
        - مجموع القيم المالية إن وجدت (total, amount, price...)
        - الاتجاه العام (زيادة، نقصان...)
        - ملاحظات مهمة
        اجعل الرد واضحًا ومهنيًا دون جداول.
      `;

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: summaryPrompt },
          { role: "user", content: JSON.stringify(data) },
        ],
      });

      const reply = completion.choices[0].message.content;
      ctx.send({ reply });
    } catch (error) {
      console.error("Assistant error:", error);
      ctx.send({ error: "حدث خطأ أثناء تحليل البيانات." }, 500);
    }
  },
};
