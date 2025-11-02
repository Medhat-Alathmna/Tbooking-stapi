/**
 * purchase-order controller
 */
'use strict';
import { factories } from '@strapi/strapi'
const { DateTime } = require('luxon');
import OpenAI from "openai";
import fs from "fs";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { createCoreController } = require('@strapi/strapi').factories;
module.exports = createCoreController('api::purchase-order.purchase-order', ({ strapi }) => ({

  async createPO(ctx) {
    const { vendor, cash, status, payments, products, createBy, addedToStuck,pic } = ctx.request.body;
    const lastEntry = await strapi.db.query('api::purchase-order.purchase-order').findMany({
      orderBy: { createdAt: 'desc' },
      limit: 1,
    });
    if (lastEntry.length) {
      const lastCreatedId = lastEntry[0]?.no;
      let parts = lastCreatedId?.split('-');
      let lastParts = parseInt(parts[parts.length - 1], 10) + 1;
      let incrementedLastPart = lastParts.toString().padStart(2, '0');
      parts[parts.length - 1] = incrementedLastPart;
      var incrementedNumberString = parts.join('-');
    } else {
      // If no entries exist, start with the first number
      var incrementedNumberString: any = '01-01-23-00';
    }

    // Get today's date
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1; // Months are 0-indexed, so add 1
    const currentYear = today.getFullYear().toString().slice(-2); // Get last two digits of the year

    // Split the previous date part
    let [day, month, year, lastPart] = incrementedNumberString.split('-').map(Number);

    // Check if we need to reset to the next day
    if (currentDay !== day || currentMonth !== month) {
      // Reset increment to 0 and update the day and month
      lastPart = '00'
      day = currentDay; // Update to today's day
      month = currentMonth; // Update to today's month
      year = currentYear; // Update to today's month
    } else {
      // Increment the last part for the same day
      lastPart = (lastPart + 0).toString().padStart(2, '0');
    }

    const newNumber = `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year.toString().padStart(2, '0')}-${lastPart}`;

    try {
      const createPO = await strapi.entityService.create('api::purchase-order.purchase-order', {
        data: {
          no: newNumber,
          vendor,
          cash,
          status,
          payments,
          products,
          createBy,
          addedToStuck,
          pic,
          hide:false
        }
      });


      ctx.send({ message: 'PO Created', createPO });

    } catch (error) {
      return ctx.throw(400, error);


    }
  },
  async updateStock(ctx) {
    const { products } = ctx.request.body;
    try {
      for (let index = 0; index < products.length; index++) {
        let product = await strapi.entityService.findOne('api::product.product', products[index].id,);
        // Update stock quantity
        product.stocks += products[index].qty;
        // Save updated product
        var updatedProduct = await strapi.entityService.update('api::product.product', products[index].id, {
          data: {
            stocks: product.stocks
          }
        });
      }
      ctx.send({ message: 'Stock updated successfully', updatedProduct });
    } catch (err) {
      ctx.send(err);
    }
  },
  async count(ctx) {
        const productCounts: any = {};

    const { startDate, endDate } = ctx.request.query;
    const vendor = ctx.params.id

    const startDateTime = DateTime.fromISO(startDate).startOf('day').toJSDate();
    const endDateTime = DateTime.fromISO(endDate).endOf('day').toJSDate();

    const currentDate = DateTime.now().startOf('day').toJSDate();
    const currentEndDate = DateTime.now().endOf('day').toJSDate();
    const bodycurrentDate = [currentDate, currentEndDate]
    const selectedtDate = [startDateTime, endDateTime]
    const entities = await strapi.entityService.findMany('api::purchase-order.purchase-order', {
      populate: '*',
      auth: false,
      filters: {
        createdAt: { $between: startDate ? selectedtDate : bodycurrentDate },
        status: { $notIn: ['Canceled','Draft'] },
        vendor: { id: vendor },
      }

    });
    try {
      let cash = 0
      let cost=0
      let count = entities.length ? entities.length : 0
      entities?.forEach((request) => {
        request.products?.forEach((product) => {
          const productName = product.name;

          if (!productCounts[productName]) {
            productCounts[productName] = {
              qty: 0,
              name: productName,
              sellPrice: 0,
            };
          }
          productCounts[productName].qty += product.qty;
          productCounts[productName].sellPrice += product.sellPrice * product.sellPrice;
        });
      });
      const topProducts = Object.values(productCounts)
        .sort((a: any, b: any) => b.qty - a.qty)
        .slice(0, 5);
      const costestPorducts = Object.values(productCounts)
        .sort((a: any, b: any) => b.sellPrice - a.sellPrice)
        .slice(0, 5);
      entities.forEach(x => {
        cash += x.cash
        x.products.forEach(element => {
          cost+=JSON.parse(element.sellPrice)*element.qty
        });
      })


      ctx.send({ entities, topProducts, count, cash ,cost,costestPorducts})
    } catch (error) {

    }
  },
     async uploadOCR(ctx) {
    try {
      // ✅ الملف موجود داخل ctx.request.files.files
      const uploaded = ctx.request.files?.files;
      if (!uploaded) return ctx.badRequest("No file uploaded");

      const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;

      // ✅ قراءة الملف من المسار المؤقت وتحويله إلى Base64
      const fileBuffer = fs.readFileSync(file.path);
      const base64Image = fileBuffer.toString("base64");

      // ✅ تحليل الصورة عبر OpenAI
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `أنت مساعد ذكاء اصطناعي متخصص في تحليل فواتير المشتريات.
أعد النتيجة بصيغة JSON فقط وفق البنية التالية:
{
  "vendor": "اسم المورد",
  "invoice_number": "رقم الفاتورة",
  "date": "YYYY-MM-DD",
  "items": [
    { "name": "اسم المنتج", "qty": 0, "unit_price": 0, "total": 0 }
  ],
  "subtotal": 0,
  "tax": 0,
  "total": 0
}`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "حلل هذه الصورة واستخرج بيانات الفاتورة بدقة." },
              { type: "image_url", image_url: { url: `data:${file.type};base64,${base64Image}` } },
            ],
          },
        ],
      });

      // ✅ تحويل النص الناتج إلى JSON
      const raw = completion.choices[0].message.content?.trim();
      let resultJson;
      try {
        resultJson = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        resultJson = match ? JSON.parse(match[0]) : { raw };
      }

      // ✅ إرجاع النتيجة
      ctx.send({
        message: "✅ Invoice analyzed successfully by OpenAI",
        fileInfo: {
          name: file.name,
          type: file.type,
          size: file.size,
        },
        result: resultJson,
      });

    } catch (error) {
      console.error("OCR Error:", error);
      ctx.throw(500, "❌ Failed to process invoice");
    }
  },
}));