"use strict";
/**
 * order controller
 */

import { factories } from "@strapi/strapi";

const { createCoreController } = require("@strapi/strapi").factories;
const { DateTime } = require("luxon");

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async count(ctx) {
    const productCounts: any = {};
    const serviceCounts: any = {};

    try {
      const { startDate, endDate } = ctx.request.query;

      const startDateTime = DateTime.fromISO(startDate)
        .startOf("day")
        .toJSDate();
      const endDateTime = DateTime.fromISO(endDate).endOf("day").toJSDate();

      const currentDate = DateTime.now().startOf("day").toJSDate();
      const currentEndDate = DateTime.now().endOf("day").toJSDate();
      const bodycurrentDate = [currentDate, currentEndDate];
      const selectedtDate = [startDateTime, endDateTime];
      const entities = await strapi.entityService.findMany("api::order.order", {
        populate: "*",
        filters: {
          createdAt: { $between: startDate ? selectedtDate : bodycurrentDate },

          status: { $ne: "Canceled" },
        },
      });
      let sum = 0;
      entities.forEach((entity) => {
        const cash = entity.cash || 0;
        const deposit = entity.appointment?.deposit || 0;
        sum += cash + deposit;

  console.log({
    cash,
    deposit,

  });
      });


      entities?.forEach((request) => {
        request.appointment.products?.forEach((product) => {
          const productName = product.name;

          // Step 2: Count Frequency or Sum Quantities
          if (!productCounts[productName]) {
            productCounts[productName] = {
              qty: 0,
              name: productName,
              price: 0,
            };
          }
          productCounts[productName].qty += product.qty;
          productCounts[productName].price += product.qty * product.price;
        });
      });
      const topProducts = Object.values(productCounts)
        .sort((a: any, b: any) => b.qty - a.qty)
        .slice(0, 5);

      entities.forEach((request) => {
        if (
          request.appointment.employee &&
          Array.isArray(request.appointment.employee)
        ) {
          request.appointment.employee.forEach((emp) => {
            if (emp.services && Array.isArray(emp.services)) {
              emp.services.forEach((service) => {
                const serviceId = service.id;
                if (!serviceCounts[serviceId]) {
                  serviceCounts[serviceId] = {
                    count: 0,
                    ar: service.ar,
                    en: service.en,
                    price: service.price,
                  };
                }
                serviceCounts[serviceId].count += 1;
                serviceCounts[serviceId].price += service.price;
              });
            }
          });
        }
      });
      const topServices = Object.values(serviceCounts)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 5);
      const canceld = await strapi.entityService.findMany("api::order.order", {
        populate: { someRelation: true },
        filters: {
          status: { $eq: "Canceled" },
          hide: { $eq: false },
        },
      });
      let canceldLenght = canceld.length;

      const paid = await strapi.entityService.findMany("api::order.order", {
        populate: { someRelation: true },
        filters: {
          status: { $eq: "Paid" },
          hide: { $eq: false },
        },
      });
      let paidLenght = paid.length;

      const unpaid = await strapi.entityService.findMany("api::order.order", {
        populate: { someRelation: true },
        filters: {
          status: { $eq: "Unpaid" },
          hide: { $eq: false },
        },
      });
      let unpaidLenght = unpaid.length;

      let po = await strapi.entityService.findMany(
        "api::purchase-order.purchase-order",
        {
          populate: 'vendor',
          filters: {
            createdAt: {
              $between: startDate ? selectedtDate : bodycurrentDate,
            },
            status: { $notIn: ["Canceled", "Draft"] },
            hide: { $eq: false },
          },
        }
      );
      let poLength = po.length;
      let cashPo = 0;
      let costPo = 0;
      po.forEach((x) => {
        cashPo += x.cash;
        x.products.forEach((element) => {
          costPo += JSON.parse(element.sellPrice);
        });
      });
      ctx.send({
        entities,
        sum,
        canceldLenght,
        paidLenght,
        unpaidLenght,
        topProducts,
        topServices,
        poLength,
        cashPo,
        costPo,
        po
      });
    } catch (error) {
      console.error(error);
      return ctx.throw(500, "Internal Server Error");
    }
  },
  async productInfo(ctx) {
    const { startDate, endDate } = ctx.request.query;
    const startDateTime = DateTime.fromISO(startDate).startOf("day").toJSDate();
    const endDateTime = DateTime.fromISO(endDate).endOf("day").toJSDate();

    const currentDate = DateTime.now().startOf("day").toJSDate();
    const currentEndDate = DateTime.now().endOf("day").toJSDate();
    const bodycurrentDate = [currentDate, currentEndDate];
    const selectedtDate = [startDateTime, endDateTime];
    let allproducts = [];
    const entities = await strapi.entityService.findMany("api::order.order", {
      populate: "*",
      limit: -1,
      filters: {
        createdAt: { $between: startDate ? selectedtDate : bodycurrentDate },

        status: { $ne: "Canceled" },
      },
    });
    try {
      const productId = ctx.params.id;

      let totalQty = 0;
      let totalRevenue = 0;

      entities.forEach((request) => {
        const products = request.products;
        if (Array.isArray(products)) {
          products.forEach((product) => {
            if (product.id == parseInt(productId)) {
              const qty = typeof product.qty === "number" ? product.qty : 0;
              const price =
                typeof product.price === "number" ? product.price : 0;
              totalQty += qty;
              totalRevenue += qty * price;
              allproducts.push(request);
            }
          });
        }
      });
      ctx.send({ totalQty, totalRevenue, allproducts });
    } catch (error) {
      ctx.throw(error);
    }
  },
  //  async findMostActivePeriods(ctx) {
  //     const events = [];
  //     const { startDate, endDate } = ctx.request.query;

  //     const startDateTime = DateTime.fromISO(startDate).startOf('day').toJSDate();
  //     const endDateTime = DateTime.fromISO(endDate).endOf('day').toJSDate();

  //     const currentDate = DateTime.now().startOf('day').toJSDate();
  //     const currentEndDate = DateTime.now().endOf('day').toJSDate();
  //     const bodycurrentDate = [currentDate, currentEndDate]
  //     const selectedtDate = [startDateTime, endDateTime]
  //     const entities = await strapi.entityService.findMany('api::order.order', {
  //         populate: '*',
  //         filters: {
  //             createdAt: { $between: startDate ? selectedtDate : bodycurrentDate },

  //             status: { $ne: 'Canceled' }
  //         }
  //     });
  //     // Step 1: Create start and end events for each request
  //     entities.forEach(request => {
  //       const { fromDate, toDate } = request.appointment          ;

  //       // Parse the dates
  //       const start = new Date(fromDate);
  //       const end = new Date(toDate);

  //       // Push start and end events
  //       events.push({ date: start, type: 'start' });
  //       events.push({ date: end, type: 'end' });
  //     });

  //     // Step 2: Sort events
  //     events.sort((a, b) => {
  //       if (a.date < b.date) return -1;
  //       if (a.date > b.date) return 1;
  //       // If dates are equal, prioritize 'start' over 'end'
  //       if (a.type === 'start' && b.type === 'end') return -1;
  //       if (a.type === 'end' && b.type === 'start') return 1;
  //       return 0;
  //     });

  //     // Step 3: Sweep through events to find maximum overlap
  //     let currentActive = 0;
  //     let maxActive = 0;
  //     let periods = [];
  //     let periodStart = null;

  //     events.forEach(event => {
  //       if (event.type === 'start') {
  //         currentActive += 1;
  //         if (currentActive > maxActive) {
  //           // New maximum found, reset periods
  //           maxActive = currentActive;
  //           periods = [];
  //           periodStart = event.date;
  //         } else if (currentActive === maxActive) {
  //           // Start of a new period with maxActive
  //           periodStart = event.date;
  //         }
  //       } else if (event.type === 'end') {
  //         if (currentActive === maxActive && periodStart) {
  //           // End of a maxActive period
  //           periods.push({ start: periodStart, end: event.date });
  //           periodStart = null;
  //         }
  //         currentActive -= 1;
  //       }
  //     });

  //     return {
  //       maxActive,
  //       periods: periods.map(p => ({
  //         start: p.start.toISOString(),
  //         end: p.end.toISOString(),
  //         durationInDays: Math.ceil((p.end - p.start) / (1000 * 60 * 60 * 24))
  //       }))
  //     };
  //   },
  async searchs(ctx) {
    try {
      const search = ctx.request.query;

      const entities = await strapi.entityService.findMany("api::order.order", {
        populate: "*",
        filters: {
          "appointment.customer": {
            $or: [
              { firstName: { $containsi: search } },
              { lastName: { $containsi: search } },
            ],
          },
        },
      });
      ctx.send({ entities });
    } catch (error) { }
  },
  async phoneNumbers(ctx) {
    const uniquePhones = {}; // This object will help track unique phone numbers
    const phones = [];
    try {
      const entities = await strapi.entityService.findMany("api::order.order", {
        populate: "*",
        filters: {
          status: { $ne: "Canceled" },
        },
      });
      entities.forEach((entity) => {
        const customer =
          entity.appointment.customer.firstName +
          " " +
          entity.appointment.customer.middleName +
          " " +
          entity.appointment.customer.lastName;
        const phoneNumber = entity.appointment.phone;

        if (!uniquePhones[phoneNumber] && phoneNumber) {
          uniquePhones[phoneNumber] = true;
          phones.push({ phone: phoneNumber, customer });
        }
      });
      ctx.send({ phones });
    } catch (error) { }
  },
  async getLastNumberOrder(ctx) {
    const lastEntry = await strapi.db.query("api::order.order").findMany({
      orderBy: { createdAt: "desc" },
      limit: 1,
    });

    if (lastEntry.length) {
      const lastCreatedId = lastEntry[0]?.orderNo;
      let parts = lastCreatedId.split("-");
      let lastParts = parseInt(parts[parts.length - 1], 10) + 1;
      let incrementedLastPart = lastParts.toString().padStart(2, "0");
      parts[parts.length - 1] = incrementedLastPart;
      var incrementedNumberString = parts.join("-");
    } else {
      // If no entries exist, start with the first number
      var incrementedNumberString: any = "01-01-23-00";
    }
    // Get today's date
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1; // Months are 0-indexed, so add 1
    const currentYear = today.getFullYear().toString().slice(-2); // Get last two digits of the year

    // Split the previous date part
    let [day, month, year, lastPart] = incrementedNumberString
      .split("-")
      .map(Number);

    // Check if we need to reset to the next day
    if (currentDay !== day || currentMonth !== month) {
      // Reset increment to 0 and update the day and month
      lastPart = "00";
      day = currentDay; // Update to today's day
      month = currentMonth; // Update to today's month
      year = currentYear; // Update to today's month
    } else {
      // Increment the last part for the same day
      lastPart = (lastPart + 0).toString().padStart(2, "0");
    }

    // Create the new date string
    const newNumber = `${day.toString().padStart(2, "0")}-${month
      .toString()
      .padStart(2, "0")}-${year.toString().padStart(2, "0")}-${lastPart}`;
    // Send the updated value as the response
    ctx.send({ newNumber });
  },
}));
