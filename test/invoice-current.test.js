'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const coupons = require('../lib/coupons');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function orderWithCoupon(coupon) {
  return {
    id: 9001,
    date: '22/11/2026',
    customer: 'In-memory characterization fixture',
    paymentMode: 'cash',
    status: 'completed',
    coupon,
    items: [{ id: 1, sku: 'TEST-1', name: 'Test item', hsn: '1006', price: 2500, qty: 1 }]
  };
}

test('CORRECT BEHAVIOUR: printable invoice matches the checkout GST and totals', function () {
  const order = orderWithCoupon('SAVE10');
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, checkout.subtotal);
  assert.equal(figures.discount, checkout.discount);
  assert.equal(figures.tax, checkout.tax);
  assert.equal(figures.cgst, checkout.cgst);
  assert.equal(figures.sgst, checkout.sgst);
  assert.equal(figures.total, checkout.total);
  assert.deepEqual(
    figures.rows.map(function (row) { return { gstPercent: row.gstPercent, lineTax: row.lineTax }; }),
    checkout.lines.map(function (line) { return { gstPercent: line.gstPercent, lineTax: line.tax }; })
  );
});

test('CURRENT BEHAVIOUR: checkout uses the HSN slab and caps SAVE10 before calculating GST', function () {
  const order = orderWithCoupon('SAVE10');
  const totals = pricing.computeTotals(order.items, order.coupon);

  assert.equal(totals.subtotal, 2500);
  assert.equal(totals.discount, 150);
  assert.equal(totals.tax, 117.5);
  assert.equal(totals.cgst, 58.75);
  assert.equal(totals.sgst, 58.75);
  assert.equal(totals.total, 2467.5);
  assert.equal(totals.lines[0].gstPercent, 5);
  assert.equal(totals.lines[0].taxable, 2350);
});

test('CURRENT BEHAVIOUR: invoice uses the same HSN GST and capped SAVE10 discount as checkout', function () {
  const order = orderWithCoupon('SAVE10');
  const checkout = pricing.computeTotals(order.items, order.coupon);
  order.subtotal = checkout.subtotal;
  order.discount = checkout.discount;
  order.tax = checkout.tax;
  order.total = checkout.total;

  const figures = invoice.computeInvoiceFigures(order);
  const html = invoice.render(order);

  assert.equal(figures.subtotal, 2500);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 117.5);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.total, order.total);
  assert.match(html, /5%/);
  assert.match(html, /117\.50/);
  assert.match(html, /2467\.50/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice and checkout both reject discount from an expired coupon', function () {
  const order = orderWithCoupon('DIWALI20');

  assert.equal(coupons.validate(order.coupon, 2500).valid, false);

  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 125);
  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 2625);
});
