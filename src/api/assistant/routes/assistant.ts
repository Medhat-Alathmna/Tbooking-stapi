module.exports = {
  routes: [
    {
      method: "POST",
      path: "/assistant",
      handler: "assistant.chat",
      config: {
        auth: false, // أو true لو أردت تقييدها
      },
    },
  ],
};
