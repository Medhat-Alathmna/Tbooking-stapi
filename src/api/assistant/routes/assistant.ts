module.exports = {
  routes: [
    {
      method: "POST",
      path: "/assistant",
      handler: "assistant.chat",
      config: { auth: false },
    },
  ],
};
