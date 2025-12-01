/**
 * appointment controller
 */
'use strict';
import { factories } from '@strapi/strapi'
const { createCoreController } = require('@strapi/strapi').factories;
const axios = require('axios');
import { JWT } from 'google-auth-library';
// const { sanitizeEntity } = require('strapi-utils');
import fs from 'fs';
let serviceAccount;

try {
  // First, try to parse it as JSON directly (for production/deployment)
  serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
} catch (e) {
  // If that fails, assume it's a file path (for local development)
  const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fs.existsSync(filePath)) {
    serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    // If the file doesn't exist, throw a clearer error
    throw new Error(`Could not find Google credentials file at path: ${filePath}. Please ensure the file exists or the environment variable contains the JSON content.`);
  }
}
let eventSource;

module.exports = createCoreController('api::appointment.appointment', ({ strapi }) => ({
    async searchCU(ctx) {
        try {
            const search = ctx.request.query;

            const entities = await strapi.entityService.findMany('api::appointment.appointment', {
                populate: '*',

            },);
            entities.map(x => {
                x.customer.firstName = x.customer?.firstName?.toLocaleLowerCase()
                x.customer.middleName = x.customer?.middleName?.toLocaleLowerCase()
                x.customer.lastName = x.customer?.lastName?.toLocaleLowerCase()
            });
            let customer = entities.filter(x => x.customer?.firstName == search.search?.toLocaleLowerCase() || x.customer?.middleName == search.search?.toLocaleLowerCase() || x.customer?.lastName == search.search?.toLocaleLowerCase());

            ctx.send({ customer });
        } catch (error) {
            ctx.throw(error)
        }
    },
    async deleteUnapproved(ctx) {
        try {
            const entities = await strapi.entityService.findMany('api::appointment.appointment', {
                populate: '*',
                filters: {
                    approved: { $eq: false },
                }
            },);
            entities.forEach(ent => {
                strapi.entityService.delete('api::appointment.appointment', ent.id)

            })
            ctx.send(entities)
        } catch (error) {
            ctx.throw(error)
        }
    },
    async convertDraftToCancel(ctx) {
        try {
            const entities = await strapi.entityService.findMany('api::appointment.appointment', {
                populate: '*',
                filters: {
                    approved: { $eq: true },
                    status: { $eq: 'Draft' },
                }
            },);
            entities.forEach(ent => {
                strapi.entityService.update('api::appointment.appointment', ent.id,
                    {
                        data: {
                            status: 'Canceled'
                        }
                    }
                )

            })
            ctx.send(entities)
        } catch (error) {
            ctx.throw(error)
        }
    },
    async searchOR(ctx) {
        try {
            const search = ctx.request.query;

            const entities = await strapi.entityService.findMany('api::order.order', {
                populate: '*',
                pagination: {
                         // Page number
                    pageSize: 10 // Items per page
                },
            },);
            // let customer
            // entities.map(x=>{
            //     customer  =x.appointment.find(x=>x.customer.firstName ==search.search|| x.customer.middleName ==search.search||x.customer.lastName==search.search);
            // })
            let customer = entities.filter(x => x.appointment?.customer?.firstName == search.search || x.appointment?.customer?.middleName == search.search || x.appointment?.customer?.lastName == search.search);
            ctx.send({ customer });
        } catch (error) {
            ctx.throw(error)
        }
    },
    
    async booking(ctx) {
        const { firstName, middleName, lastName, phone, expoPushToken, fromDate, toDate, address, approved,platform, employee, bookBy, confirmBy, deposit } = ctx.request.body;
        const lastEntry = await strapi.db.query('api::appointment.appointment').findMany({
            orderBy: { createdAt: 'desc' },
            limit: 1,
        });

        // Extract the ID of the last created entry
        if (lastEntry.length) {
            const lastCreatedId = lastEntry[0]?.number;
            let parts = lastCreatedId.split('-');
            let lastParts = parseInt(parts[parts.length - 1], 10) + 1;
            let incrementedLastPart = lastParts.toString().padStart(2, '0');
            parts[parts.length - 1] = incrementedLastPart;
            var incrementedNumberString = parts.join('-');
        }else{
            // If no entries exist, start with the first number
            var incrementedNumberString:any = '01-01-23-00';
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
          lastPart='00'
          day = currentDay; // Update to today's day
          month = currentMonth; // Update to today's month
          year = currentYear; // Update to today's month
        } else {
          // Increment the last part for the same day
          lastPart = (lastPart + 0).toString().padStart(2, '0');
        }
    
            const newNumber = `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year.toString().padStart(2, '0')}-${lastPart}`;
        console.log('newNumber', newNumber);
        
        try {
            const createAppo = await strapi.entityService.create('api::appointment.appointment', {
                data: {

                    employee: [employee],
                    customer: {
                        firstName,
                        middleName,
                        lastName
                    },
                    expoPushToken,
                    phone, fromDate, address, bookBy,
                    number: newNumber,confirmBy,
                    toDate, approved, deposit,platform,
                    hide: false,
                }
            });

            // if (eventSource) {
            //     const sanitizedEntity = sanitizeEntity(createAppo, { model: strapi.models['api::appointment.appointment'] });
            //     eventSource.send(`data: ${JSON.stringify(sanitizedEntity)}\n\n`);
            //   }
              ctx.send({ message: 'Booking Created', createAppo });

            //   return sanitizeEntity(createAppo, { model: strapi.models['api::appointment.appointment'] });
        } catch (error) {
            return ctx.throw(400, error);


        }
    },
    async servicesMobile(ctx) {
        try {
            const entities = await strapi.entityService.opMany('api::service.service');
            ctx.send(entities);
        } catch (error) {
            ctx.send({ message: error, error });

        }
    },
    async usersMobile(ctx) {
        try {
            const entities = await strapi.entityService.findMany('plugin::users-permissions.user', {
                populate: { someRelation: true },
                filters: {
                    blocked: { $eq: false },
                    isToday: { $eq: true },
                    hide: { $eq: false }
                }
            });
            ctx.send(entities);
        } catch (error) {
            ctx.send({ message: error, error });

        }
    },
    async publishedPosts(ctx) {
        try {

            const publishedPosts = await strapi.entityService.findMany('api::mobile-ad.mobile-ad', {
                populate: 'ads',
                filters: {
                    published: { $eq: true },
                },
                sort: { createdAt: 'desc' },

            });



            ctx.send({ publishedPosts });
        } catch (error) {
            console.error(error);
            return ctx.throw(500, 'Internal Server Error');
        }
    },
    async notfi(ctx) {
        ctx.set('Content-Type', 'text/event-stream');
        ctx.set('Cache-Control', 'no-cache');
        ctx.set('Connection', 'keep-alive');

        // Send an initial event to the client
        ctx.res.write(`data: Connection established\n\n`);

        // Example: Send periodic updates every 5 seconds
        const intervalId = setInterval(() => {
            const message = { message: `Hello! Current time: ${new Date().toLocaleTimeString()}` };
            ctx.res.write(`data: ${JSON.stringify(message)}\n\n`);
        }, 5000);

        // Stop sending events when the connection is closed
        // ctx.req.on('close', () => {
        //   clearInterval(intervalId);
        //   ctx.res.end();
        // });
    },

    async getLastNumber(ctx){
        const lastEntry = await strapi.db.query('api::appointment.appointment').findMany({
            orderBy: { createdAt: 'desc' },
            limit: 1,
        });
 if (lastEntry.length) {
        const lastCreatedId = lastEntry[0]?.number;
        let parts = lastCreatedId.split('-');
        let lastParts = parseInt(parts[parts.length - 1], 10) + 1;
        let incrementedLastPart = lastParts.toString().padStart(2, '0');
        parts[parts.length - 1] = incrementedLastPart;
        var incrementedNumberString = parts.join('-');
 }else{
        // If no entries exist, start with the first number
        var incrementedNumberString:any = '01-01-23-00';
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
          lastPart='00'
          day = currentDay; // Update to today's day
          month = currentMonth; // Update to today's month
          year = currentYear; // Update to today's month
        } else {
          // Increment the last part for the same day
          lastPart = (lastPart + 0).toString().padStart(2, '0');
        }
    
    
        // Create the new date string
        const newNumber = `${day.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${year.toString().padStart(2, '0')}-${lastPart}`;
        // Send the updated value as the response
        ctx.send({ newNumber });
      
    },

    async sse(ctx) {

        ctx.set('Content-Type', 'text/event-stream');
        ctx.set('Cache-Control', 'no-cache');
        ctx.set('Connection', 'keep-alive');
    
        // Keep the connection open
        eventSource = ctx;
        eventSource.send(`data: ${JSON.stringify('test')}\n\n`);

        // When the connection is closed, clean up
        ctx.req.on('close', () => {
          eventSource = null;
        });
                eventSource.send(`data: ${JSON.stringify('test')}\n\n`);

      },
      

async sendPush(ctx) {
  const { token, title, body } = ctx.request.body;

  if (!token || !title || !body) {
    ctx.throw(400, 'Missing token, title, or body');
  }

  const deviceToken = Array.isArray(token) ? token[0] : token;

  try {
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    await client.authorize();
    const accessToken = (await client.getAccessToken()).token;

    const url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    const message = {
      message: {
        token: deviceToken,
        notification: {
          title: title,
          body: body,
        },
        android: {
          notification: {
            click_action: "OPEN_ACTIVITY_1",
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              alert: {
                title: title,
                body: body,
              },
              sound: "default",
              badge: 1,
            },
          },
        },
        webpush: {
          headers: {
            TTL: "86400",
          },
          notification: {
            title: title,
            body: body,
          },
        },
      },
    };

    const response = await axios.post(url, message, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    ctx.send({ status: 'success', data: response.data });

  } catch (error) {
    ctx.send({
      status: 'error',
      message: 'Failed to send push notification',
      details: error.response?.data || error.message,
    });
  }
}
}));