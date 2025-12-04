/**
 * TOON Statistics API Route
 * GET /api/assistant/toon-stats - Get TOON optimization statistics
 */

export default {
  routes: [
    {
      method: "GET",
      path: "/assistant/toon-stats",
      handler: "assistant.getToonStats",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/assistant/toon-stats/reset",
      handler: "assistant.resetToonStats",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
