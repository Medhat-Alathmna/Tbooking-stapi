export const allowedCollections = [
  "appointments",
  "orders",
  "purchase-orders",
  "products",
  "services",
  "users",
] as const;

export type AllowedCollection = (typeof allowedCollections)[number];

const getListDataDefinition = {
  name: "get_list_data",
  description:
    "Fetch a filtered list of records from ERP collections such as appointments, orders, purchase orders, products, services, or users.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["collection"],
    properties: {
      collection: {
        type: "string",
        enum: allowedCollections,
        description:
          "Target collection. Valid values: appointments, orders, purchase-orders, products, services, users.",
      },
      filters: {
        type: "object",
        description:
          "Optional filters expressed using Strapi's entityService syntax (e.g. {\"status\":{\"$eq\":\"paid\"}} or {\"createdAt\":{\"$gte\":\"2024-01-01\"}}).",
        additionalProperties: true,
      },
      populate: {
        type: "array",
        description:
          "Optional list of relations/fields to populate. Use [\"*\"] to include everything or list specific relation keys.",
        items: { type: "string" },
      },
    },
  },
};

export default getListDataDefinition;

