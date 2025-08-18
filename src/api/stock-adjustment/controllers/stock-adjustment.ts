/**
 * stock-adjustment controller
 */

import { factories } from '@strapi/strapi'
const { createCoreController } = require('@strapi/strapi').factories;
export default factories.createCoreController('api::stock-adjustment.stock-adjustment');

module.exports = createCoreController('api::stock-adjustment.stock-adjustment', ({ strapi }) => ({

  async createStockAdjustmentAndUpdateStock(ctx) {
  const { product, quantity, reason, note, cost, user } = ctx.request.body;

  const knex = strapi.db.connection; // DB connection from Strapi

  try {
    await knex.transaction(async (trx) => {
      const existingProduct = await strapi.db.query('api::product.product').findOne({
        where: { id: product },
        select: ['id', 'stocks'],
        transacting: trx
      });

      if (!existingProduct) {
        throw new Error("Product not found");
      }

      const newStock = existingProduct.stocks + quantity;
      if (newStock < 0) {
        throw new Error("Stock can't be negative");
      }

      const createStockAdjustment = await strapi.db.query('api::stock-adjustment.stock-adjustment').create({
        data: { product, quantity, reason, note, cost, user },
        transacting: trx
      });

      const updatedProduct = await strapi.db.query('api::product.product').update({
        where: { id: product },
        data: { stocks: newStock },
        transacting: trx
      });

      ctx.send({
        adjustment: createStockAdjustment,
        product: updatedProduct
      });
    });
  } catch (error) {
    return ctx.throw(400, error.message);
  }
},


async getProductMovements(ctx) {
  try {
    const { productId } = ctx.params;

 
    const adjustments = await strapi.db.query('api::stock-adjustment.stock-adjustment').findMany({
      where: { product: productId },
      populate: { user: true, product: true }
    });

    const adjustmentMovements = adjustments.map(a => ({
      type: 'adjustment',
      id: a.id,
      productId: a.product?.id,
      productName: a.product?.name,
      quantity: a.quantity,
      price: null,
      vendor: null,
      customer: null,
      reason: a.reason,
      note: a.note,
      cost: a.cost,
      user: a.user?.username,
      date: a.createdAt
    }));

    //
    // 2️⃣ المبيعات (Orders → Appointment → Products)
    //
    const orders = await strapi.db.query('api::order.order').findMany({
      populate: {
        appointment: { populate: { products: true, customer: true } }
      }
    });

    const salesMovements = [];
    for (const order of orders) {
      order.appointment?.products?.forEach(p => {
        if (p.id === Number(productId)) {
          salesMovements.push({
            type: 'sales',
            id: order.id,
            productId: p.id,
            productName: p.name,
            quantity: -p.qty,
            price: p.price,
            vendor: null,
            customer: order.appointment?.customer
              ? `${order.appointment.customer.firstName} ${order.appointment.customer.middleName ?? ''} ${order.appointment.customer.lastName}`
              : null,
            reason: null,
            note: order?.notes,
            cost: null,
            user: order?.orderBy,
            date: order?.createdAt
          });
        }
      });
    }

    //
    // 3️⃣ المشتريات (PO → Products)
    //
    const purchaseOrders = await strapi.db.query('api::purchase-order.purchase-order').findMany({
      populate: { products: true, vendor: true, createBy: true }
    });

    const purchaseMovements = [];
    for (const po of purchaseOrders) {
      po.products?.forEach(p => {
        if (p.id === Number(productId)) {
          purchaseMovements.push({
            type: 'purchases',
            id: po.id,
            productId: p.id,
            productName: p.name,
            quantity: p.qty,
            price: p.sellPrice,
            vendor: po.vendor?.name,
            customer: null,
            reason: null,
            note: null,
            cost: null,
            user: po.createBy?.username,
            date: po?.createdAt
          });
        }
      });
    }
    //
    // 4️⃣ دمج وترتيب
    //
    const movements = [
      ...adjustmentMovements,
      ...salesMovements,
      ...purchaseMovements
    ];

movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    ctx.send(movements);

  } catch (error) {
    return ctx.throw(400, error.message);
  }
}


}));