/**
 * This API can access only:
 *   - the existing "Book Manage" tab (list/append/update/delete)
 *   - the existing order tab with gid 328326034 (append orders only)
 * It never creates/deletes tabs or reads/writes rows in any other tab.
 * Script Properties: SPREADSHEET_ID, API_TOKEN.
 */
const BOOK_SHEET_NAME = 'Book Manage';
const ORDER_SHEET_ID = 328326034;
const ALLOWED_BOOK_ACTIONS = Object.freeze(['list', 'append', 'update', 'delete']);
const ORDER_HEADERS = Object.freeze([
  'Order ID', 'Created At', 'Name', 'Phone', 'Address', 'Items', 'Total (VND)', 'Status',
]);
const MAX_BODY_LENGTH = 20000;

function doPost(event) {
  try {
    const raw = event && event.postData && event.postData.contents;
    if (!raw || raw.length > MAX_BODY_LENGTH) return respond({ ok: false, error: 'Invalid request body.' });
    const input = JSON.parse(raw);
    const properties = PropertiesService.getScriptProperties();
    const expectedToken = properties.getProperty('API_TOKEN');
    const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
    if (!expectedToken || !spreadsheetId || input.token !== expectedToken) {
      return respond({ ok: false, error: 'Unauthorized or server configuration is incomplete.' });
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

    // Checkout payloads have no action. They can only append to the designated order gid.
    if (input.orderId) return appendOrder(spreadsheet, input);

    // Book management is limited to the exact existing tab name and explicit actions.
    if (input.sheet !== BOOK_SHEET_NAME || !ALLOWED_BOOK_ACTIONS.includes(input.action)) {
      return respond({ ok: false, error: 'Only Book Manage operations and order submissions are allowed.' });
    }
    const bookSheet = spreadsheet.getSheetByName(BOOK_SHEET_NAME);
    if (!bookSheet) return respond({ ok: false, error: 'Book Manage tab does not exist.' });
    if (input.action === 'list') return listRows(bookSheet);
    if (input.action === 'append') return appendRow(bookSheet, input.values);
    if (input.action === 'update') return updateRow(bookSheet, input.row, input.values);
    return deleteRow(bookSheet, input.row);
  } catch (error) {
    return respond({ ok: false, error: 'Request failed.' });
  }
}

function appendOrder(spreadsheet, order) {
  // Find the target by its stable gid; do not depend on, or create, any tab name.
  const orderSheet = spreadsheet.getSheets().find(sheet => sheet.getSheetId() === ORDER_SHEET_ID);
  if (!orderSheet) return respond({ ok: false, error: 'Order tab gid 328326034 does not exist.' });
  const customer = order.customer;
  if (!customer || typeof customer !== 'object' || !Array.isArray(order.items) || order.items.length < 1) {
    return respond({ ok: false, error: 'Invalid order.' });
  }
  if (orderSheet.getLastRow() === 0) {
    orderSheet.getRange(1, 1, 1, ORDER_HEADERS.length).setValues([ORDER_HEADERS.slice()]);
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    orderSheet.appendRow([
      safeCellValue(order.orderId),
      safeCellValue(order.createdAt),
      safeCellValue(customer.name),
      safeCellValue(customer.phone),
      safeCellValue(customer.address),
      safeCellValue(formatOrderItems(order.items)),
      order.total === null ? '' : safeCellValue(order.total),
      'New',
    ]);
  } finally {
    lock.releaseLock();
  }
  return respond({ ok: true, orderId: order.orderId });
}

function formatOrderItems(items) {
  const money = value => value === null || value === undefined
    ? 'Ch\u01b0a ch\u1ed1t gi\u00e1'
    : Number(value).toLocaleString('vi-VN') + ' \u0111';
  return items.map(item => {
    const quantity = Number(item.quantity) || 0;
    const title = String(item.title || 'S\u1ea3n ph\u1ea9m');
    const productId = String(item.productId || '');
    const unitPrice = money(item.unitPrice);
    const lineTotal = money(item.lineTotal);
    return title + ' \u00d7 ' + quantity
      + ' | \u0110\u01a1n gi\u00e1: ' + unitPrice
      + ' | Th\u00e0nh ti\u1ec1n: ' + lineTotal
      + (productId ? ' | M\u00e3 s\u00e1ch: ' + productId : '');
  }).join('\n');
}
function listRows(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 1 || lastColumn < 1) return respond({ ok: true, headers: [], rows: [] });
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  const headers = values[0].map(value => value.trim());
  if (headers.some(header => !header)) return respond({ ok: false, error: 'Every header cell must have a name.' });
  const rows = values.slice(1).map((row, index) => ({
    row: index + 2,
    values: Object.fromEntries(headers.map((header, column) => [header, row[column]])),
  }));
  return respond({ ok: true, headers, rows });
}

function appendRow(sheet, values) {
  const data = validateValues(sheet, values, false);
  if (!data.ok) return respond(data);
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, data.values.length).setValues([data.values]);
  return respond({ ok: true, row });
}

function updateRow(sheet, row, values) {
  if (!validDataRow(sheet, row)) return respond({ ok: false, error: 'Invalid row.' });
  const data = validateValues(sheet, values, true);
  if (!data.ok) return respond(data);
  data.entries.forEach(([header, value]) => {
    const column = data.headers.indexOf(header) + 1;
    sheet.getRange(row, column).setValue(safeCellValue(value));
  });
  return respond({ ok: true, row });
}

function deleteRow(sheet, row) {
  if (!validDataRow(sheet, row)) return respond({ ok: false, error: 'Invalid row.' });
  sheet.deleteRow(row);
  return respond({ ok: true, row });
}

function validateValues(sheet, values, partial) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return { ok: false, error: 'Values must be an object keyed by column header.' };
  }
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return { ok: false, error: 'Book Manage needs a header row first.' };
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(value => value.trim());
  if (headers.some(header => !header)) return { ok: false, error: 'Every header cell must have a name.' };
  const entries = Object.entries(values);
  if (!entries.length || entries.some(([key]) => !headers.includes(key))) {
    return { ok: false, error: 'Values contain an empty or unknown column header.' };
  }
  const ordered = partial ? null : headers.map(header => Object.prototype.hasOwnProperty.call(values, header) ? safeCellValue(values[header]) : '');
  return { ok: true, values: ordered, entries, headers };
}

function validDataRow(sheet, row) {
  return Number.isInteger(row) && row >= 2 && row <= sheet.getLastRow();
}

function safeCellValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && /^[=+\-@]/.test(value)) return "'" + value;
  if (['string', 'number', 'boolean'].includes(typeof value)) return value;
  throw new Error('Unsupported cell value.');
}

function respond(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
