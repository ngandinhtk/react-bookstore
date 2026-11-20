import { useLanguage } from './i18n';
﻿import React from 'react';
export default function Brand({ footer = false }) {const {t}=useLanguage();
  return <a className="brand brand-lockup" href="#" aria-label={t("Stillleaf — về trang đầu")}>
    <img className="brand-mark" src="/logo-mark.svg" width="48" height="48" alt="" aria-hidden="true"/>
    <span className="brand-wordmark">stillleaf<small>{footer ? t("GÓC SÁCH BÌNH YÊN") : t("NHÀ SÁCH & GÓC ĐỌC")}</small></span>
  </a>;
}
