
module.exports = ({
    async publishedPosts(ctx) {
        try {
            
            const publishedPosts = await strapi.entityService.findMany('api::mobile-ad.mobile-ad', {
                populate: '*',
                filters: {
                    published: { $eq: 'true' },
                }
            });



            ctx.send({ publishedPosts });
        } catch (error) {
            console.error(error);
            return ctx.throw(500, 'Internal Server Error');
        }
    },


})


