function doPost(event) {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty('ORDER_TOKEN');
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  const sheetName = properties.getProperty('SHEET_NAME') || 'Orders';
  if (!token || !spreadsheetId) return jsonResponse({ ok: false, error: 'Server configuration is incomplete.' });

  try {
    const order = JSON.parse(event.postData.contents);
    if (!order || order.token !== token || !order.orderId || !order.customer || !Array.isArray(order.items)) {
      return jsonResponse({ ok: false, error: 'Invalid order.' });
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Order ID', 'Created At', 'Name', 'Phone', 'Address', 'Items', 'Total (VND)', 'Status']);
      }
      const safeText = value => {
        const text = String(value ?? '');
        return /^[=+\-@]/.test(text) ? `'${text}` : text;
      };
      sheet.appendRow([
        safeText(order.orderId),
        safeText(order.createdAt),
        safeText(order.customer.name),
        safeText(order.customer.phone),
        safeText(order.customer.address),
        safeText(JSON.stringify(order.items)),
        order.total === null ? '' : order.total,
        'New',
      ]);
    } finally {
      lock.releaseLock();
    }
    return jsonResponse({ ok: true, orderId: order.orderId });
  } catch (error) {
    return jsonResponse({ ok: false, error: 'Could not save order.' });
  }
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
