const fs = require("fs");
const path = require("path");

/**
 * ✅ Reads and describes a Strapi content-type schema dynamically.
 */
function getCollectionSchemaInfo(collectionName) {
  try {
    const schemaPath = path.join(
      process.cwd(),
      "src",
      "api",
      collectionName,
      "content-types",
      collectionName,
      "schema.json"
    );

    if (!fs.existsSync(schemaPath)) return null;

    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const attributes = schema.attributes || {};
    const fieldDescriptions = {};

    for (const [key, value] of Object.entries(attributes)) {
      if (value.type === "enumeration") {
        fieldDescriptions[key] = `Enum: ${value.enum.join(", ")}`;
      } else {
        fieldDescriptions[key] = value.type || "unknown";
      }
    }

    return {
      name: schema.info.displayName,
      fields: fieldDescriptions,
      defaultDateField:
        Object.keys(attributes).find((k) =>
          ["date", "createdAt", "created_at"].includes(k)
        ) || "createdAt",
    };
  } catch (err) {
    console.error("Schema read error:", err.message);
    return null;
  }
}

/**
 * ✅ Custom field meanings for each collection (editable template)
 * 
 * You can safely modify descriptions or add new fields here.
 */
function getCustomFieldMeaning(collectionName) {
  const customMeanings = {
    /**
     * 📦 ORDER COLLECTION
     * --------------------------------------------------
     * Used to store client orders and payment information.
     */
    order: {
      id: {
        description: "Unique ID of the order",
      },
      createdAt: {
        description:
          "Date when the order was created — used for filtering by time periods (day, week, month).",
      },
      customer: {
        description:
          "Customer linked to the order (relation to  or client table).",
      },
      total: {
        description: "Total amount of the order including taxes and discounts.",
      },
      cash: {
        description: "The amount actually received (what the customer paid).",
      },
      deposit: {
        description: "Deposit amount received before completing the full payment.",
      },
      status: {
        description:
          "Order payment and lifecycle status. Used to identify if the order is completed, pending, or canceled.",
        values: {
          paid: "fully paid — the order is completed and all money has been received.",
          unpaid:
            "partially paid — some amount has been received but not fully paid (no completely unpaid invoices exist).",
          pending:
            "order created but not yet processed — waiting for confirmation or payment.",
          canceled:
            "the order was canceled and should be excluded from payment totals.",
        },
      },
      payment_method: {
        description: "Method of payment such as cash, card, or transfer.",
      },
      employee: {
        description:
          "Employee who handled the order or processed the payment.",
      },
      branch: {
        description:
          "Shop branch where the order was made (useful for branch-level reports).",
      },
    },

    /**
     * 🧾 PURCHASE-ORDER COLLECTION
     * --------------------------------------------------
     * Used to track purchases from vendors or suppliers.
     */
    "purchase-order": {
      id: {
        description: "Unique ID of the purchase record.",
      },
      createdAt: {
        description:
          "Date the purchase was recorded — used for filtering by date ranges.",
      },
      vendor: {
        description: "The supplier or vendor from whom the goods were purchased.",
      },
      total: {
        description:
          "Total purchase amount (including all items, taxes, and fees).",
      },
      paid: {
        description:
          "Amount that has been paid to the vendor for this purchase order.",
      },
      balance: {
        description:
          "Remaining unpaid balance — total minus the paid amount.",
      },
      status: {
        description:
          "Payment and process status of the purchase order.",
        values: {
          paid: "fully paid — vendor has been paid in full.",
          unpaid:
            "partially paid — some amount was paid, but not all.",
          pending:
            "waiting for approval or payment — not yet finalized.",
          canceled:
            "purchase order canceled — exclude from financial calculations.",
        },
      },
      payment_method: {
        description: "Payment method used to pay the vendor (cash, bank, etc.).",
      },
      note: {
        description: "Optional remarks or additional info about the purchase.",
      },
    },
  };

  return customMeanings[collectionName] || {};
}

module.exports = { getCollectionSchemaInfo, getCustomFieldMeaning };
