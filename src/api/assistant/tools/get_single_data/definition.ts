import {
  allowedCollections,
  type AllowedCollection,
} from "../get_list_data/definition";

export interface GetSingleDataParameters {
  collection: AllowedCollection;
  filters: Record<string, unknown>;
  populate?: string[];
}

const getSingleDataDefinition = {
  name: "get_single_data",
  description:
    "Fetch a single record from ERP collections (appointments, orders, purchase orders, products, services, or users).",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["collection", "filters"],
    properties: {
      collection: {
        type: "string",
        enum: allowedCollections,
        description:
          "Target collection identifier. Valid values: appointments, orders, purchase-orders, products, services, users.",
      },
      filters: {
        type: "object",
        description:
          "Filters that uniquely identify the record, e.g. {\"orderNo\":{\"$eq\":\"INV-1001\"}} or {\"appointment\":{\"orderNo\":{\"$eq\":\"10-51-2025\"}}}.",
        additionalProperties: true,
      },
      populate: {
        type: "array",
        description:
          "Optional list of relations/fields to populate. Use [\"*\"] to include everything or provide relation keys explicitly.",
        items: { type: "string" },
      },
    },
  },
};

export default getSingleDataDefinition;

