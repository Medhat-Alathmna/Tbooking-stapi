import { AllowedCollection, allowedCollections, FilterInput, COLLECTION_UID_MAP } from "../get_list_data";

export interface GetSingleDataInput {
  collection: AllowedCollection;
  filters: FilterInput;
  populate?: string[];
}

export interface GetSingleDataResult {
  success: boolean;
  data?: {
    id: number;
    type: string;
    displayName: string;
    record: any;
  } | {
    multiple: true;
    matches: Array<{
      id: number;
      type: string;
      displayName: string;
    }>;
  };
  error?: string;
}

// Helper: Build display name based on collection type
const buildDisplayName = (collection: AllowedCollection, record: any): string => {
  switch (collection) {
    case 'orders':
      // orderNo + customer name
      const orderNo = record.orderNo || 'N/A';
      let customerName = '';

      if (record.appointment?.customer) {
        const c = record.appointment.customer;
        const parts = [c.firstName, c.middleName, c.lastName]
          .filter(Boolean)
          .map(p => String(p).trim());
        customerName = parts.length ? ` - ${parts.join(' ')}` : '';
      }

      return `${orderNo}${customerName}`;

    case 'appointments':
      // customer name + date
      let appointmentCustomer = '';
      if (record.customer) {
        const c = record.customer;
        const parts = [c.firstName, c.middleName, c.lastName]
          .filter(Boolean)
          .map(p => String(p).trim());
        appointmentCustomer = parts.join(' ');
      }

      const fromDate = record.fromDate ? new Date(record.fromDate).toLocaleDateString() : '';
      return appointmentCustomer ? `${appointmentCustomer} - ${fromDate}` : fromDate;

    case 'purchase-orders':
      // vendor name or ID
      const vendorName = record.vendor?.name || `Purchase #${record.id}`;
      return vendorName;

    case 'products':
      // product name
      return record.name || `Product #${record.id}`;

    case 'services':
      // service name
      return record.name || `Service #${record.id}`;

    case 'users':
      // user full name or email
      if (record.firstName || record.lastName) {
        const parts = [record.firstName, record.middleName, record.lastName]
          .filter(Boolean)
          .map(p => String(p).trim());
        return parts.join(' ');
      }
      return record.email || record.username || `User #${record.id}`;

    default:
      return `${collection} #${record.id}`;
  }
};

// Main execution function
export const executeGetSingleData = async (
  input: GetSingleDataInput
): Promise<GetSingleDataResult> => {
  try {
    const { collection, filters, populate } = input;

    // Validate collection
    if (!allowedCollections.includes(collection)) {
      return {
        success: false,
        error: `Unsupported collection "${collection}". Allowed: ${allowedCollections.join(', ')}.`
      };
    }

    // Validate filters
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      return {
        success: false,
        error: 'Missing or invalid filters. Provide at least one identifier (e.g., orderNo, id, email).'
      };
    }

    if (Object.keys(filters).length === 0) {
      return {
        success: false,
        error: 'Filters cannot be empty. Provide at least one identifier.'
      };
    }

    const uid = COLLECTION_UID_MAP[collection];

    // Build query
    const queryArgs: any = {
      where: filters,
      limit: 5, // Fetch up to 5 to detect multiple matches
    };

    // Auto-populate for orders to get customer name
    if (collection === 'orders') {
      queryArgs.populate = populate && populate.length > 0
        ? populate
        : ['appointment.customer'];
    } else if (populate && populate.length > 0) {
      queryArgs.populate = populate;
    }

    // Execute query
    const results = await strapi.db.query(uid).findMany(queryArgs);

    // No results found
    if (!results || results.length === 0) {
      return {
        success: false,
        error: `No ${collection} record found matching the provided filters.`
      };
    }

    // Multiple results found
    if (results.length > 1) {
      const matches = results.map(r => ({
        id: r.id,
        type: collection,
        displayName: buildDisplayName(collection, r)
      }));

      return {
        success: true,
        data: {
          multiple: true,
          matches
        }
      };
    }

    // Single result found - success!
    const record = results[0];

    return {
      success: true,
      data: {
        id: record.id,
        type: collection,
        displayName: buildDisplayName(collection, record),
        record: record  // Full record for LLM to use
      }
    };

  } catch (err: any) {
    console.error('[get_single_data] Error:', err);
    return {
      success: false,
      error: err?.message || String(err)
    };
  }
};

export default executeGetSingleData;
