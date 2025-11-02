import { config } from "process";

module.exports = {
    routes: [
        { // Path defined with a URL parameter
            method: 'POST',
            path: '/po',
            handler: 'purchase-order.createPO',

        },
        { // Path defined with a URL parameter
            method: 'POST',
            path: '/addStuck',
            handler: 'purchase-order.updateStock',

        },
        { // Path defined with a URL parameter
            method: 'GET',
            path: '/statics/:id',
            handler: 'purchase-order.count',

        },
        { // Path defined with a URL parameter
            method: 'POST',
            path: '/ocr',
            handler: 'purchase-order.uploadOCR',
            config: { auth: false },


        },
    ]
}