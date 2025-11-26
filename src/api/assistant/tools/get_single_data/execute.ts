import { AllowedCollection, allowedCollections, FilterInput, COLLECTION_UID_MAP } from "../get_list_data";

const allowedSet = new Set<AllowedCollection>(allowedCollections);

export interface GetSingleDataInput {
  collection: AllowedCollection;
  filters: FilterInput;
  populate?: string[];
}

const sanitizeFilters = (filters?: FilterInput): FilterInput | undefined => {
  if (!filters) return undefined;
  if (Array.isArray(filters) || typeof filters !== "object") return undefined;
  return filters;
};

const normalizePopulate = (
  populate?: string[]
): string[] | "*" | undefined => {
  if (!populate || !populate.length) return undefined;
  if (populate.length === 1 && populate[0] === "*") return "*";
  return populate;
};

const resolveStrapi = (ctx?) => {
  if (ctx?.strapi) return ctx.strapi;
  const globalStrapi = (globalThis as { strapi?:any["strapi"] })
    .strapi;
  if (globalStrapi) return globalStrapi;
  throw new Error("[get_single_data] Missing Strapi instance in tool context.");
};

const fetchSingle = async (
  input: GetSingleDataInput,
  ctx?: any
) => {
  const { collection, filters, populate } = input;

  if (!allowedSet.has(collection)) {
    throw new Error(
      `[get_single_data] Unsupported collection "${collection}". Allowed: ${allowedCollections.join(
        ", "
      )}.`
    );
  }

  const safeFilters = sanitizeFilters(filters);
  if (!safeFilters || !Object.keys(safeFilters).length) {
    throw new Error(
      "[get_single_data] Missing filters. Provide at least one identifier (e.g., orderNo, appointment number)."
    );
  }

  const populateOption = normalizePopulate(populate);
  const strapiInstance = resolveStrapi(ctx);
  const uid:any = COLLECTION_UID_MAP[collection];

  const query: Record<string, unknown> = {
    filters: safeFilters,
    pagination: { limit: 2 },
  };

  if (populateOption) {
    query.populate = populateOption;
  }

  const results = await strapiInstance.entityService.findMany(uid, query);

  if (!results || !Array.isArray(results) || results.length === 0) {
    throw new Error(
      `[get_single_data] No ${collection} entry matched the provided filters.`
    );
  }

  if (results.length > 1) {
    throw new Error(
      `[get_single_data] Found multiple ${collection} entries for the provided filters. Refine them using additional unique fields (see getCustomFieldMeaning in assistant.ts).`
    );
  }

  return {
    collection,
    filters: safeFilters,
    record: results[0],
  };
};

export const execute = fetchSingle;

export default execute;

