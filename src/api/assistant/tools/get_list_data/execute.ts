import type { Strapi } from "@strapi/strapi";

export const allowedCollections = [
  "appointments",
  "orders",
  "purchase-orders",
  "products",
  "services",
  "users",
] as any;
export interface GetListDataResult {
  success: boolean;
  data?: {
    results: any[];
    total: number;
 summarize?: string;
  };
  error?: string;
}
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

export const executeGetListData = async (
  collection: AllowedCollection,
  filters?: FilterInput,
  populate?: string[]
): Promise<any> => {
    try {
  if (!COLLECTION_UID_MAP[collection]) {
    throw new Error(`Collection not allowed: ${collection}`);
  }
  
    const uid = COLLECTION_UID_MAP[collection];

    // ---- Normalize filters safely ----
    let parsedFilters: Record<string, any> | undefined = undefined;

    if (typeof filters === "string") {
      // filters arrived as JSON string (from agent). Parse safely.
      const s = (filters as string).trim();
      if (s) {
        try {
          parsedFilters = JSON.parse(s);
        } catch (err: any) {
          return { success: false, error: `Invalid filters JSON: ${err?.message || String(err)}` };
        }
      }
    } else if (filters && typeof filters === "object") {
      parsedFilters = filters as Record<string, any>;
    }

    // If parsedFilters is undefined -> we will not pass `where` (means no filters)
    const queryArgs: any = {};
    if (parsedFilters && Object.keys(parsedFilters).length > 0) {
      // Strapi expects 'where' key
      queryArgs.where = parsedFilters;
    }

    if (populate) {
      queryArgs.populate = populate;
    }

    // Add ordering if desired
    queryArgs.orderBy = { createdAt: "desc" };

    const results = await strapi.db.query(uid).findMany(queryArgs);

const finalResults: any[] = [];
results.forEach((r: any) => {
  const orderNo = r.orderNo ?? null;
  const id = r.id ?? null;
  const status = r.status ?? null;
  const createdAt = r.createdAt ?? null;
  const cash=r.cash??0

  let customer = null;
  const appointment = r.appointment ?? null;
  if (appointment && appointment.customer) {
    const c = appointment.customer;
    const parts = [c.firstName, c.middleName, c.lastName].filter(Boolean).map(p => String(p).trim());
    if (parts.length) customer = parts.join(" ");
  }

  finalResults.push({ orderNo, customer, status, id, createdAt,cash });
});

 return {
      success: true,
      data: {
        results: results,

      },
    };
  } catch (err: any) {
    console.error("executeGetListData error:", err);
    return { success: false, error: err?.message ?? String(err) };
  }
}

