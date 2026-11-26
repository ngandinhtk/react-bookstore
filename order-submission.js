import { randomUUID } from 'node:crypto';

export function validateOrder(input, books) {
  const customer = input?.customer;
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) {
    throw new TypeError('Vui lòng nhập thông tin nhận hàng.');
  }
  const name = typeof customer.name === 'string' ? customer.name.trim() : '';
  const phone = typeof customer.phone === 'string' ? customer.phone.trim() : '';
  const address = typeof customer.address === 'string' ? customer.address.trim() : '';
  if (!name || name.length > 100) throw new TypeError('Họ tên không hợp lệ.');
  if (!/^\+?[\d\s().-]{8,24}$/.test(phone) || phone.replace(/\D/g, '').length < 8 || phone.replace(/\D/g, '').length > 15) {
    throw new TypeError('Số điện thoại không hợp lệ.');
  }
  if (!address || address.length > 500) throw new TypeError('Địa chỉ không hợp lệ.');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) {
    throw new TypeError('Đơn hàng cần có từ 1 đến 50 sản phẩm.');
  }

  const products = new Map(books.map(book => [book.id, book]));
  const seen = new Set();
  let total = 0;
  let hasUnknownPrice = false;
  const items = input.items.map(item => {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);
    const book = products.get(productId);
    if (!Number.isSafeInteger(productId) || !book || seen.has(productId)) {
      throw new TypeError('Sản phẩm trong đơn hàng không hợp lệ.');
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99 || (book.stock !== null && quantity > book.stock)) {
      throw new TypeError(`Số lượng "${book.title}" không hợp lệ hoặc vượt quá tồn kho.`);
    }
    seen.add(productId);
    const unitPrice = Number.isSafeInteger(book.price) && book.price >= 0 ? book.price : null;
    const lineTotal = unitPrice === null ? null : unitPrice * quantity;
    if (lineTotal === null) hasUnknownPrice = true;
    else total += lineTotal;
    return { productId, title: book.title, quantity, unitPrice, lineTotal };
  });

  return {
    orderId: randomUUID(),
    createdAt: new Date().toISOString(),
    customer: { name, phone, address },
    items,
    total: hasUnknownPrice ? null : total,
  };
}
