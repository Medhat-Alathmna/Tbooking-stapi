module.exports = {
  routes: [
    {
      method: "POST",
      path: "/assistant",
      handler: "assistant.processChatWithLangChain",
      config: {
        auth: false,  // المستخدم سيفعل المصادقة بنفسه - User will enable auth themselves
        middlewares: ['api::assistant.rate-limit']  // إضافة rate limiting - Add rate limiting
      },
    },
    {
      method: "GET",
      path: "/assistant/security-stats",
      handler: "assistant.getSecurityStats",
      config: {
        auth: false,  // التحقق من admin داخل الـ handler - Admin check inside handler
        middlewares: []
      },
    },
  ],
};
