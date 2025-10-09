const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = {
  async chat(ctx) {
    try {
      const { message } = ctx.request.body;

      // 🧭 System Prompt (تعليمات المساعد)
      const systemPrompt = `
      You are an ERP assistant for a company.
      You can access data from the system via Strapi APIs.
      When a user asks for data, decide which endpoint to use.
      Example APIs:
      - GET /api/orders
      - GET /api/employees
      - GET /api/sales
      Always provide concise, clear answers.
      `;

      // 🔥 إرسال الرسالة إلى GPT
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      });

      const reply = completion.choices[0].message.content;

      ctx.send({ reply });
    } catch (error) {
      console.error("Assistant error:", error);
      ctx.send({ error: "Error in assistant response" }, 500);
    }
  },
};
