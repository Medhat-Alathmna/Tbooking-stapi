import { tool } from "langchain";
import { z } from "zod";

import executeGetListData, {
  allowedCollections,
  type GetListDataInput,
} from "./get_list_data/execute";
import executeGetSingleData, {
  type GetSingleDataInput,
} from "./get_single_data/execute";
import {
  getCollectionRelations,
  getCustomFieldMeaning,
  filterOperators
} from "./collection-meta";



const filterOperatorsHint = filterOperators
  .map(({ operator, description }) => `${operator}: ${description}`)
  .join("; ");

export const getListDataTool = tool(
  async (input: GetListDataInput) => {
    const result = await executeGetListData(
      input,
      // Strapi instance is resolved inside execute() when not provided.
    );

    const meta = {
      fields: getCustomFieldMeaning(input.collection),
      relations: getCollectionRelations(input.collection),
    };

    return JSON.stringify({ ...result, meta });
  },
  {
    name: "get_list_data",
    description: `Fetch multiple ERP records (appointments, orders, purchase-orders, products, services, or users) with optional filters and populated relations.

Use this tool when a user requests:
- Lists, tables, or summaries of ERP entities (e.g., "Show upcoming appointments", "List paid orders last week").
- Counts or basic analytics that require the raw records (you can count/summarize after receiving the list).
- Detect any time range (today, last month, this week, etc.) and return ISO dates:
   {"from": "YYYY-MM-DDT00:00", "to": "YYYY-MM-DDT23:59"}
- If not mentioned a time range,do not add date time filter.   
- A dataset that includes related entities (employees, customers, vendors, etc.) by specifying populate fields or ["*"] for everything.
- When entity is Order specifying populate fields [Appointment] 
Always provide precise filters when users mention identifiers, dates, or statuses.
If users want everything, omit filters. Set populate to ["*"] only when you truly need all relations.`,
    schema: z.object({
      collection: z
        .enum(allowedCollections)
        .describe(
          "Target collection name. One of appointments, orders (Invoices), purchase-orders, products, services, users."
        ),
      filters: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          `Optional Strapi-compatible filters. Supported operators: ${filterOperatorsHint}. Combine them in nested objects, e.g. {"orderNo":{"$eq":"INV-1001"},"$and":[{"status":{"$eq":"paid"}},{"createdAt":{"$between":["2025-01-01","2025-01-31"]}}]}`
        ),
      populate: z
        .array(z.string())
        .optional()
        .describe(
          'Optional relations to populate (["*"] fills everything, otherwise list relation keys).'
        ),
    }),
  }
);

export const getSingleDataTool = tool(
  async (input: GetSingleDataInput) => {
    const result = await executeGetSingleData(
      input,
      // Strapi instance is resolved inside execute() when not provided.
    );

    return JSON.stringify(result);
  },
  {
    name: "get_single_data",
    description: `Fetch exactly one ERP record (appointments, orders, purchase-orders, products, services, or users) using precise filters and optional populated relations.

Use this tool when a user references a specific identifier (order/invoice number, appointment number, email, etc.) and expects a single match.
- Provide the most specific filters available to avoid multiple matches.
- If you need related data, list the relations in populate or set ["*"] only when absolutely necessary.`,
    schema: z.object({
      collection: z
        .enum(allowedCollections)
        .describe(
          "Target collection name. One of appointments, orders (Invoices), purchase-orders, products, services, users."
        ),
      filters: z
        .record(z.string(), z.unknown())
        .describe(
          `Required Strapi filters identifying the record. Supported operators: ${filterOperatorsHint}. Include at least one unique field (e.g. orderNo, appointment number, email).`
        ),
      populate: z
        .array(z.string())
        .optional()
        .describe(
          'Optional relations to populate (["*"] fills everything, otherwise list relation keys).'
        ),
    }),
  }
);

export const allLangChainTools = [getListDataTool, getSingleDataTool];

export default allLangChainTools;
