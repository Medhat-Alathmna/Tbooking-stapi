'use strict';

import dayjs from "dayjs";

const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
function getValueFromPath(obj, path) {
  // Handle custom virtual fields
  if (path === 'appointment.customer.fullName') {
    const c = obj?.appointment?.customer;
    return c ? [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ') : '';
  }
  if (path === 'customer.fullName') {
    const c = obj?.customer;
    return c ? [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ') : '';
  }
  if (path === 'payments.list') {
    const payments = obj?.payments;
    if (!Array.isArray(payments)) return '';
    return payments
      .map(p => {
        const name = p.by || 'Unknown';
        const amount = p.pay ?? '0';
        return `${name} (${amount})`;
      })
      .join(' + ');
  }
  if (path === 'fromDate.toDate') {
    const fromDate = obj?.fromDate;
    const toDate = obj?.toDate;
    if (!fromDate || !toDate) return '';
    return `${dayjs(fromDate).format('YYYY-MM-DD hh:mm')} --> ${dayjs(toDate).format('YYYY-MM-DD hh:mm')}`;

  }
  if (path === 'products.sell') {
    const products = obj?.products;
    if (!Array.isArray(products)) return '';
    return products
      .map(p => {
        const name = p.name || 'Unknown';
        const sellPrice = p.sellPrice ??'0';
        return `${name} (${sellPrice})`;
      })
      .join(' + ');
  }
  if (path === 'products.qty') {
    const products = obj?.products;
    if (!Array.isArray(products)) return '';
    return products
      .map(p => {
        const name = p.name || 'Unknown';
        const qty = p.qty ??'0';
        return `${name} (${qty})`;
      })
      .join(' + ');
  }
  if (path === 'products.list') {
    const products = obj?.products;
    if (!Array.isArray(products)) return '';
    return products
      .map(p => {
        const name = p.name || 'Unknown';
        const price = p.price ?? '0';
        return `${name} (${price})`;
      })
      .join(' + ');
  }
  if (path === 'employees.services') {
    const employees = obj?.employee;
    if (!Array.isArray(employees)) return '';

    return employees.map(emp => {
      const name = emp.username || 'Unknown';
      const services = emp.services?.map(s => `${s.en} (${s.price})`).join(', ') || '';
      return `${name}: ${services}`;
    }).join(' // ');
  }
  return path.split('.').reduce((o, k) => (o ? o[k] : ''), obj);
}
function extractPopulatePaths(columns) {
  const populate = {};

  columns.forEach(col => {
    const path = col.key;
    const parts = path.split('.');

    if (parts.length > 1) {
      let current = populate;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        current[part] = current[part] || {};
        current[part].populate = current[part].populate || {};
        current = current[part].populate;
      }
    }
  });

  return populate;
}

module.exports = {
  async exportData(ctx) {
    const { columns, collection, password } = ctx.request.body;

    if (!columns || !Array.isArray(columns)) {
      return ctx.badRequest('Missing columns');
    }

    if (!collection || typeof collection !== 'string') {
      return ctx.badRequest('Missing or invalid collection');
    }
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in');
    }

    if (!password) {
      return ctx.badRequest('Password is required');
    }
    const uid = `api::${collection}.${collection}`;
    const model = strapi.contentTypes[uid];

    if (!model) {
      return ctx.badRequest(`Collection '${collection}' not found.`);
    }
    const user = await strapi.entityService.findOne('plugin::users-permissions.user', ctx.state.user.id, {
      fields: ['password']
    });

    // Compare entered password with hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return ctx.send({ message: 'Incorrect password' }, 401);
    }
    const populate = extractPopulatePaths(columns);

    const data = await strapi.entityService.findMany(model, {
      populate,
      filters: { hide: { $eq: false } },

    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${collection} Data`);

    worksheet.columns = columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 20,
    }));

    data.forEach(item => {
      const row = {};
      columns.forEach(col => {
        let value = getValueFromPath(item, col.key);

        // Format date if requested
        if (col.format && value) {
          value = dayjs(value).format(col.format);
        }

        row[col.key] = value ?? '';
      });

      worksheet.addRow(row);
    });

    ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    ctx.set('Content-Disposition', 'attachment; filename=exported-data.xlsx');
    ctx.body = await workbook.xlsx.writeBuffer();
  },
};
