'use strict';

module.exports = {
  async afterCreate(event) {
    const { result } = event;

    // Only emit if created by mobile    
    if (result.platform === 'mobile') {
      if (strapi.io) {
        strapi.io.emit('new-appointment', {
          id: result.id,
          name: result.name,
          number: result.number,
          phone: result.phone,
          createdAt: result.createdAt,
        });

        strapi.log.info('📱 Emitted new-appointment (mobile)');
      }
    } else {
      strapi.log.info('🖥️ Appointment created from web — no emit');
    }
  },
};
