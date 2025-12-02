export type FieldMeaning = {
  description: string;
  values?: Record<string, string>;
};

export type CollectionFieldMeanings = Record<string, FieldMeaning>;

const collectionFieldMeanings: Record<string, CollectionFieldMeanings> = {
  order: {
    id: { description: "Unique internal order ID (do not display it)." },
    orderNo: { description: "Unique order number (display field)." },
    customer: {
      description:
        "Customer who placed the order. Use firstName + middleName + lastName from appointment schema for labels.",
    },
    appointment: {
      description:
        "Linked appointment record (if any). Connects order to schedule data.",
    },
    cash: {
      description:
        "Amount paid by customer; also called payment (use in revenue dashboards).",
    },
    total: { description: "Total order value (used for comparisons with cash)." },
    status: {
      description: "Order payment status.",
      values: {
        paid: "Fully paid.",
        unpaid: "Partially paid.",
        canceled: "Canceled - exclude from analytics.",
      },
    },
    employee: { description: "Employee who handled the order." },
    createdAt: { description: "Order creation date." },
  },
  service: {
    en: { description: "Service name in English." },
    ar: { description: "Service name in Arabic." },
    deletedBy: { description: "User who deleted the service (if applicable)." },
    price: { description: "Service price." },
    hide: { description: "Flag to hide the service from display." },
    },
  appointment: {
    id: { description: "Unique appointment ID." },
    customer: {
      description:
        "Client who booked the appointment (firstName + middleName + lastName for labels).",
    },
    employee: {
      description:
        "Assigned employee (employee.name for performance dashboards).",
    },
    fromDate: { description: "Appointment start date and time." },
    toDate: { description: "Appointment end date and time." },
    cash: { description: "Service price booked in the appointment." },
    approved: { description: "Indicates if the appointment is approved." },
    deposit: { description: "Deposit amount paid at booking." },
    paid: { description: "Amount paid (deposit or full payment)." },
    employees: {
      description:
        "Employees involved in the appointment; each may have their own services.",
    },
    products: { description: "Products booked in the appointment." },
    status: {
      description: "Appointment status.",
      values: {
        Draft: "Appointment drafted.",
        Completed: "Appointment completed (converted to order).",
        Canceled: "Appointment canceled (ignore).",
      },
    },
    order: {
      description:
        "Related order created after appointment completion (appointment.order).",
    },
  },
  "purchase-order": {
    id: { description: "Purchase order ID." },
    no: { description: "Unique purchase receipt number." },
    status: {
      description: "Purchase receipt status.",
      values: {
        Draft: "Receipt drafted.",
        Paid: "Receipt fully paid.",
        Unpaid: "Receipt unpaid / partial paid.",
        Canceled: "Receipt canceled.",
      },
    },
    cash: { description: "Amount paid for purchase." },
    vendor: { description: "Vendor/supplier (vendor.name for labels)." },
    products: { description: "Products included in the receipt." },
    payments: { description: "Payment details and history." },
    createBy: { description: "User who created the receipt." },
    addedToStuck: { description: "Flag indicating if products were added to stock." },
    pic: { description: "Attached images/photos of receipt." },
    hide: { description: "Flag to hide the receipt from display." },
    cancellationNote: { description: "Reason for cancellation (if applicable)." },
    canceledAt: { description: "Cancellation date and time." },
    canceledBy: { description: "User who canceled the receipt." },
  },
  vendor: {
    id: { description: "Vendor ID." },
    name: { description: "Vendor name." },
    email: { description: "Vendor email address." },
    phone: { description: "Vendor phone number." },
    address: { description: "Vendor address." },
    notes: { description: "Additional notes about the vendor." },
    purchase_orders: { description: "Purchase orders from this vendor." },
    company: { description: "Company name (required)." },
    companyPhone: { description: "Company phone number." },
    isCompanyShow: { description: "Flag to display company information." },
    hide: { description: "Flag to hide the vendor from display." },
    vendor_type: { description: "Vendor type classification." },
  },
  products:{
    id: { description: "Product ID." },
    name: { description: "Product name." },
    price: { description: "Product price." },
    stocks: { description: "Available stock quantity." },
    createdAt: { description: "Date when the product was added." },
    sellPrice: { description: "Selling price of the product." },
    brand: { description: "Brand of the product." },
    hide: { description: "Flag to hide the product from display." }
  }
};

const collectionRelations: Record<string, string[]> = {
  order: ["appointment", "customer", "employee"],
  appointment: ["order", "customer", "employee"],
  "purchase-order": ["vendor"],
};
export const filterOperators = [
  { operator: "$eq", description: "Equal" },
  { operator: "$eqi", description: "Equal (case-insensitive)" },
  { operator: "$ne", description: "Not equal" },
  { operator: "$nei", description: "Not equal (case-insensitive)" },
  { operator: "$lt", description: "Less than" },
  { operator: "$lte", description: "Less than or equal to" },
  { operator: "$gt", description: "Greater than" },
  { operator: "$gte", description: "Greater than or equal to" },
  { operator: "$in", description: "Included in an array" },
  { operator: "$notIn", description: "Not included in an array" },
  { operator: "$contains", description: "Contains" },
  { operator: "$notContains", description: "Does not contain" },
  { operator: "$containsi", description: "Contains (case-insensitive)" },
  {
    operator: "$notContainsi",
    description: "Does not contain (case-insensitive)",
  },
  { operator: "$null", description: "Is null" },
  { operator: "$notNull", description: "Is not null" },
  { operator: "$between", description: "Is between" },
  { operator: "$startsWith", description: "Starts with" },
  { operator: "$startsWithi", description: "Starts with (case-insensitive)" },
  { operator: "$endsWith", description: "Ends with" },
  { operator: "$endsWithi", description: "Ends with (case-insensitive)" },
  { operator: "$or", description: 'Logical "or" join for filters' },
  { operator: "$and", description: 'Logical "and" join for filters' },
  { operator: "$not", description: 'Logical "not" wrapper for filters' },
] 
export const getCustomFieldMeaning = (collectionName: string) =>
  collectionFieldMeanings[collectionName] || {};

export const getCollectionRelations = (collectionName: string) =>
  collectionRelations[collectionName] || [];

export { collectionFieldMeanings, collectionRelations };

