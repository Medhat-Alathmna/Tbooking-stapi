/**
 * stock-adjustment router
 */

// import { factories } from '@strapi/strapi';

// export default factories.createCoreRouter('api::stock-adjustment.stock-adjustment');
module.exports = {
    routes: [
        { // Path defined with a URL parameter
            method: 'POST',
            path: '/stock-adjustments',
            handler: 'stock-adjustment.createStockAdjustmentAndUpdateStock',
            "config": {
                auth: false,
            }
        },
        { // Path defined with a URL parameter
            method: 'GET',
            path: '/productLogs/:productId',
            handler: 'stock-adjustment.getProductMovements',
            "config": {
                auth: false,
            }
        },
    ]
}