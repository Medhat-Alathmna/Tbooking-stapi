'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = ({
    async updateStock(ctx) {
      const productId = ctx.params.id;
      const { qty } = ctx.request.body;
      let product = await strapi.entityService.findOne('api::product.product',productId, {
        
        populate: "*",
      });
      try {
          
        // Update stock quantity
        product.stocks -= qty;
        
        const updatedProduct = await strapi.entityService.update('api::product.product', productId, {
            data:{
                stocks:product.stocks
            }
        });
  
        ctx.send({ message: 'Stock updated successfully', updatedProduct });
      } catch (err) {
        ctx.send(product);
      }
    },
  })