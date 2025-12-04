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
  filters?: FilterInput | string,
  populate?: string[],
  limit?: number
): Promise<any> => {
    try {
  // Validate collection
  if (!COLLECTION_UID_MAP[collection]) {
    throw new Error(`Collection not allowed: ${collection}`);
  }

    const uid = COLLECTION_UID_MAP[collection];
  console.log(limit);
  
    // Normalize filters: accept both object and string (for backward compatibility)
    let parsedFilters: Record<string, any> | undefined = undefined;

    if (typeof filters === "string") {
      const trimmed = filters.trim();
      if (trimmed) {
        try {
          parsedFilters = JSON.parse(trimmed);
          // Validate that parsed result is an object
          if (typeof parsedFilters !== "object" || Array.isArray(parsedFilters)) {
            return {
              success: false,
              error: "Filters must be a JSON object, not an array or primitive. Example: {\"status\":{\"$ne\":\"Cancelled\"}}"
            };
          }
        } catch (err: any) {
          return {
            success: false,
            error: `Invalid filters JSON: ${err?.message || String(err)}. Provide filters as an object.`
          };
        }
      }
    } else if (filters && typeof filters === "object" && !Array.isArray(filters)) {
      parsedFilters = filters as Record<string, any>;
    } else if (filters !== undefined && filters !== null) {
      return {
        success: false,
        error: "Filters must be either a JSON object or a valid JSON string."
      };
    }

    // Build query arguments
    const queryArgs: any = {};

    // Initialize parsedFilters if needed
    if (!parsedFilters) {
      parsedFilters = {};
    }

    // PERMANENTLY exclude hidden records (soft delete) for collections that support it
    // Collections with hide field: services, purchase-orders, products, vendors
    // This filter CANNOT be overridden - hidden records are never accessible
    const collectionsWithHide = ['services', 'purchase-orders', 'products', 'vendors'];

    if (collectionsWithHide.includes(collection)) {
      // Force hide filter - remove any user-provided hide filter
      delete parsedFilters?.hide;
      parsedFilters.hide = { $ne: true };
    }

    // PERMANENTLY exclude "Cancelled" and "Draft" statuses for orders and purchase-orders
    // This filter is ALWAYS applied and CANNOT be overridden
    const isOrderCollection = collection === 'orders' || collection === 'purchase-orders';

    if (isOrderCollection) {
      // Check if user explicitly requested Cancelled or Draft statuses
      const hasStatusFilter = parsedFilters?.status !== undefined;

      // Check if user specifically wants Cancelled/Draft records
      const requestedCancelledOrDraft = hasStatusFilter && (
        parsedFilters.status === 'Canceled' ||
        parsedFilters.status === 'Draft' ||
        parsedFilters.status?.$in?.includes('Canceled') ||
        parsedFilters.status?.$in?.includes('Draft') ||
        parsedFilters.status?.$eq === 'Canceled' ||
        parsedFilters.status?.$eq === 'Draft'
      );

      if (!requestedCancelledOrDraft) {
        if (hasStatusFilter) {
          // User has a status filter - combine it with auto-exclude using $and
          const userStatusFilter = parsedFilters.status;

          // Use $and to combine both conditions
          if (!parsedFilters.$and) {
            parsedFilters.$and = [];
          }

          parsedFilters.$and.push(
            { status: userStatusFilter },
            { status: { $notIn: ['Canceled', 'Draft'] } }
          );

          delete parsedFilters.status;
        } else {
          // No user status filter - just add auto-exclude
          parsedFilters.status = { $notIn: ['Canceled', 'Draft'] };
        }
      }
    }

    if (parsedFilters && Object.keys(parsedFilters).length > 0) {
      queryArgs.where = parsedFilters;
    }

    if (populate && populate.length > 0) {
      queryArgs.populate = populate;
    }

    if (limit !== undefined) {
      queryArgs.limit = limit;
    }

    // Default ordering by creation date (newest first)
    queryArgs.orderBy = { createdAt: "desc" };

    console.log(queryArgs);
    
    const results = await strapi.db.query(uid).findMany(queryArgs);

    // Transform results based on collection type
    let finalResults: any[] = [];

    if (collection === 'orders' || collection === 'purchase-orders') {
      // Special formatting for order-like collections
      finalResults = results.map((r: any) => {
        const orderNo = r.orderNo ?? null;
        const id = r.id ?? null;
        const status = r.status ?? null;
        const createdAt = r.createdAt ?? null;
        const cash = r.cash ?? 0;

        // Extract customer name from nested appointment relation
        let customer = null;
        const appointment = r.appointment ?? null;
        if (appointment && appointment.customer) {
          const c = appointment.customer;
          const parts = [c.firstName, c.middleName, c.lastName]
            .filter(Boolean)
            .map(p => String(p).trim());
          if (parts.length) {
            customer = parts.join(" ");
          }
        }

        return { orderNo, customer, status, id, createdAt, cash };
      });
    } else {
      // For other collections, return results as-is
      finalResults = results;
    }

    return {
      success: true,
      data: {
        results: finalResults,
        total: finalResults.length,
      },
    };
  } catch (err: any) {
    console.error("executeGetListData error:", err);
    return { success: false, error: err?.message ?? String(err) };
  }
}

