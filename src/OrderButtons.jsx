import { useLanguage } from './i18n';
﻿import React, { useState } from 'react';
import { shopContacts, contactLink, orderMessage } from './shop';
export default function OrderButtons({ book }) {const {t,lang}=useLanguage();
  const [copyStatus, setCopyStatus] = useState('');
  const message = orderMessage(book,lang);
  const soldOut = book.stock === 0;
  async function copy() {
    try { await navigator.clipboard.writeText(message); setCopyStatus("Đã sao chép. Bạn có thể dán vào cuộc trò chuyện với shop."); }
    catch { setCopyStatus("Bạn có thể chọn và sao chép nội dung trong ô bên dưới."); }
  }
  const isEReader = book.productType === 'ereader';
  return <section className="order-panel" aria-label={t(isEReader ? "Đặt mua máy đọc sách" : "Đặt mua sách")}>
    <p className="eyebrow">{t(isEReader ? "ĐẶT MÁY ĐỌC SÁCH VỚI STILLLEAF" : "ĐẶT SÁCH VỚI STILLLEAF")}</p>
    <div className="order-actions">
      {[['messenger', 'Facebook'], ['zalo', 'Zalo']].map(([channel, label]) => {
        const href = contactLink(shopContacts[channel], channel);
        return href && !soldOut ? <a className={`order-button ${channel}`} key={channel} href={href} target="_blank" rel="noopener noreferrer">{t("Đặt qua")} {label} ↗</a> : <button className={`order-button ${channel}`} key={channel} disabled title={soldOut ? t(isEReader ? "Máy đọc sách đã hết hàng" : "Sách đã hết hàng") : t("Shop chưa cập nhật địa chỉ liên hệ")}>{t("Đặt qua")} {label} ↗</button>;
      })}
    </div>
    {soldOut ? <p className="disclosure">{t(isEReader ? "Máy đọc sách hiện đã hết hàng." : "Sách hiện đã hết hàng.")}</p> : <p className="disclosure">{t(isEReader ? "Gửi tên máy cho shop để xác nhận đơn và phí vận chuyển." : "Gửi tên sách cho shop để xác nhận đơn và phí vận chuyển.")}</p>}
    <details className="order-message"><summary>{t(isEReader ? "Nội dung đặt máy đọc sách để gửi shop" : "Nội dung đặt sách để gửi shop")}</summary><textarea aria-label={t(isEReader ? "Nội dung đặt máy đọc sách" : "Nội dung đặt sách")} readOnly value={message} rows={5}/><button className="link-button" onClick={copy}>{t("Sao chép nội dung")}</button><p role="status" className="disclosure">{t(copyStatus)}</p></details>
  </section>;
}
