// Link nhận đơn của shop. Để trống sẽ tạm khóa nút tương ứng.
export const shopContacts = {
  messenger: '', // https://m.me/tenpage hoặc https://www.facebook.com/tenpage
  zalo: '', // https://zalo.me/84901234567
};
export function contactLink(value, channel) {
  try {
    const url = new URL(value);
    const hosts = channel === 'messenger' ? ['m.me', 'www.m.me', 'facebook.com', 'www.facebook.com', 'messenger.com', 'www.messenger.com'] : ['zalo.me', 'www.zalo.me'];
    return url.protocol === 'https:' && hosts.includes(url.hostname) && url.pathname !== '/' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
export function orderMessage(product, lang = 'vi') {
  const isEReader = product.productType === 'ereader';
  const itemName = isEReader ? (lang === 'en' ? 'e-reader' : 'máy đọc sách') : (lang === 'en' ? 'book' : 'sách');
  const price = product.price === null ? null : new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'vi-VN', { style: 'currency', currency: 'VND' }).format(product.price);
  if (lang === 'en') return `Hi Stillleaf, I would like to order this ${itemName}: “${product.title}”.\nProduct ID: ${product.id}\n${price === null ? 'Please let me know the price.' : `Listed price: ${price}.`}\nPlease confirm availability and shipping costs. Thank you!`;
  return `Chào shop, mình muốn đặt ${itemName} “${product.title}”.\nMã sản phẩm: ${product.id}\n${price === null ? 'Nhờ shop báo giá giúp mình.' : `Giá niêm yết: ${price}.`}\nShop xác nhận tình trạng hàng và phí vận chuyển giúp mình nhé.`;
}
