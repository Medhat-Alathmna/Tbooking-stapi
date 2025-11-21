module.exports = {
  routes: [
    {
      method: "POST",
      path: "/assistant",
      handler: "assistant.chat",
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/chat-assistant/processChatWithLangChain',
      handler: 'chat-assistant.processChatWithLangChain',
      config: {
        auth: false,
      },
    },
  ],
};
