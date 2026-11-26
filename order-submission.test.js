import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrder } from './order-submission.js';

const books = [
  { id: 21, title: 'Book One', price: 120000, stock: 3 },
  { id: 22, title: 'Book Two', price: null, stock: null },
];
const validInput = {
  customer: { name: '  Nguyen An ', phone: '0912345678', address: '  Hanoi ' },
  items: [{ productId: 21, quantity: 2 }],
};

test('validates customer details and calculates product totals from the catalog', () => {
  const order = validateOrder(validInput, books);

  assert.deepEqual(order.customer, { name: 'Nguyen An', phone: '0912345678', address: 'Hanoi' });
  assert.equal(order.items[0].lineTotal, 240000);
  assert.equal(order.total, 240000);
  assert.equal(order.items[0].title, 'Book One');
  assert.ok(order.orderId);
});

test('rejects invalid customer data, unknown products, and quantities above stock', () => {
  assert.throws(() => validateOrder({ ...validInput, customer: { ...validInput.customer, phone: '123' } }, books), /Số điện thoại/);
  assert.throws(() => validateOrder({ ...validInput, items: [{ productId: 99, quantity: 1 }] }, books), /Sản phẩm/);
  assert.throws(() => validateOrder({ ...validInput, items: [{ productId: 21, quantity: 4 }] }, books), /tồn kho/);
});

test('marks order total unknown when any product needs a price quote', () => {
  const order = validateOrder({ ...validInput, items: [{ productId: 22, quantity: 1 }] }, books);

  assert.equal(order.items[0].unitPrice, null);
  assert.equal(order.total, null);
});
