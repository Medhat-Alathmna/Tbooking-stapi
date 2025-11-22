module.exports = {
  routes: [
    {
      method: "POST",
      path: "/assistant",
      handler: "assistant.processChatWithLangChain",
      config: { auth: false },
    },
   
  ],
};
