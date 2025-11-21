import type { Strapi } from "@strapi/strapi";

export const allowedCollections = [
  "appointments",
  "orders",
  "purchase-orders",
  "products",
  "services",
  "users",
] as const;

export type AllowedCollection = (typeof allowedCollections)[number];

export const COLLECTION_UID_MAP: Record<AllowedCollection, string> = {
  appointments: "api::appointment.appointment",
  orders: "api::order.order",
  "purchase-orders": "api::purchase-order.purchase-order",
  products: "api::product.product",
  services: "api::service.service",
  users: "plugin::users-permissions.user",
};

export type FilterInput = Record<string, unknown>;

export interface GetListDataInput {
  collection: AllowedCollection;
  filters?: FilterInput;
  populate?: string[];
}

export interface ToolExecutionContext {
  strapi: Strapi;
}

const allowedSet = new Set<AllowedCollection>(allowedCollections);

const sanitizeFilters = (filters?: FilterInput): FilterInput | undefined => {
  if (!filters) return undefined;
  if (Array.isArray(filters) || typeof filters !== "object") return undefined;
  return filters;
};

const normalizePopulate = (
  populate?: string[]
): string[] | "*" | undefined => {
  if (!populate || !populate.length) return undefined;
  if (populate.length === 1 && populate[0] === "*") {
    return "*";
  }
  return populate;
};

const resolveStrapi = (ctx?: ToolExecutionContext): Strapi => {
  if (ctx?.strapi) return ctx.strapi;
  const globalStrapi = (globalThis as { strapi?: Strapi }).strapi;
  if (globalStrapi) return globalStrapi;
  throw new Error("[get_list_data] Missing Strapi instance in tool context.");
};

const fetchList = async (
  strapiInstance: Strapi,
  uid: any,
  filters?: FilterInput,
  populate?: string[] | "*" | undefined
) => {
  const query: Record<string, unknown> = {};
  if (filters) query.filters = filters;
  if (populate) query.populate = populate;
  return strapiInstance.entityService.findMany(uid, query);
};

export const execute = async (
  input: GetListDataInput,
  ctx?: ToolExecutionContext
) => {
  const { collection, filters, populate } = input;

  if (!allowedSet.has(collection)) {
    throw new Error(
      `[get_list_data] Unsupported collection "${collection}". Allowed: ${allowedCollections.join(
        ", "
      )}.`
    );
  }

  const strapiInstance = resolveStrapi(ctx);
  const uid = COLLECTION_UID_MAP[collection];
  const safeFilters = sanitizeFilters(filters);
  const populateOption = normalizePopulate(populate);

  const data = await fetchList(strapiInstance, uid, safeFilters, populateOption);

  return {
    collection,
    count: Array.isArray(data) ? data.length : 0,
    filters: safeFilters || {},
    data,
  };
};

export default execute;
