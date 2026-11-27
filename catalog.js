import {createHash} from 'node:crypto';
export const SHEET_URL='https://docs.google.com/spreadsheets/d/11Uxei5HoXZZEgdmTZDIEgiY1pRNKIPFzWp7rgS_4E0s/edit?gid=0';
const CSV_URL='https://docs.google.com/spreadsheets/d/11Uxei5HoXZZEgdmTZDIEgiY1pRNKIPFzWp7rgS_4E0s/gviz/tq?tqx=out:csv&gid=0&range=A1:Z1002';
export function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;text=text.replace(/^\uFEFF/,'');for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}if(quoted)throw Error('Dữ liệu CSV không hợp lệ.');if(cell||row.length){row.push(cell);rows.push(row)}return rows}
const safeUrl=value=>{if(/^\/images\/[^/\\?#]+\.(jpe?g|png|webp|gif|avif)$/i.test(value))return value;try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}};
export function mapRows(rows) {
  const headers = rows[0]?.map(h => h.trim().toLowerCase()) || [];
  if (!headers.includes('tên sách') && !headers.includes('tên sản phẩm') && !headers.includes('title')) {
    throw Error('Không tìm thấy cột Tên sách hoặc Tên sản phẩm.');
  }
  const seen = new Set();
  const palette = [['#ba643f','#fff0c5'],['#e5ddbc','#354f3c'],['#4b604a','#efead3'],['#d7a75d','#343c30'],['#7b796a','#fff3d8']];
  return rows.slice(1).flatMap((row, rowIndex) => {
    const get = (...names) => {
      for (const name of names) {
        const index = headers.indexOf(name.toLowerCase());
        if (index >= 0 && row[index]?.trim()) return row[index].trim();
      }
      return '';
    };
    const title = get('Tên sách','Tên sản phẩm','title');
    if (!title) return [];
    const rawType = get('Loại sản phẩm','product_type').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g,' ').trim();
    let productType = 'book';
    if (['máy đọc sách','máy đọc sách điện tử','e-reader','ereader'].includes(rawType)) productType = 'ereader';
    else if (rawType && !['sách','book'].includes(rawType)) throw Error('Loại sản phẩm không được hỗ trợ.');
    const status = get('Trạng thái bán','Trạng thái sản phẩm','Trạng thái','Trạng thái đọc').normalize('NFC').toLocaleLowerCase('vi-VN').replace(/\s+/g,' ');
    if (!['đang bán','đã bán'].includes(status)) return [];
    const publish = get('published');
    if (['false','0','ẩn','no'].includes(publish.toLowerCase())) return [];
    const identity = get('id') || title.normalize('NFC').toLowerCase();
    const id = parseInt(createHash('sha256').update('sheet:'+identity).digest('hex').slice(0,12),16);
    if (seen.has(id)) throw Error('Mã sản phẩm hoặc tên sản phẩm bị trùng.');
    seen.add(id);
    const [color,ink] = palette[id % palette.length];
    const rawPrice = get('Giá bán lại (Dự kiến)','Giá bán','price').replace(/\s/g,'');
    const price = rawPrice && /^\d+(\.\d+)?$/.test(rawPrice) ? Number(rawPrice) : null;
    const rawStock = get('stock','Tồn kho');
    return [{
      id,
      sheetRow: rowIndex + 2,
      title,
      productType,
      author: get('Tác giả','Thương hiệu','author') || (productType === 'ereader' ? '' : 'Chưa cập nhật tác giả'),
      category: get('Thể loại','category') || (productType === 'ereader' ? 'Máy đọc sách' : 'Chưa phân loại'),
      description: get('Nội dung sách','Mô tả sản phẩm','description') || (productType === 'ereader' ? '' : 'Nội dung sách đang được cập nhật.'),
      price,
      currency: 'VND',
      stock: /^\d+$/.test(rawStock) ? Number(rawStock) : null,
      buyUrl: safeUrl(get('buy_url')),
      isSold: status === 'đã bán',
      coverUrl: safeUrl(get('cover_url')),
      color,
      ink,
      motif: productType === 'ereader' ? '▣' : '❧',
      format: get('format','Định dạng') || (productType === 'ereader' ? '' : 'Chưa cập nhật định dạng'),
    }];
  });
}
export function createCatalog({fetcher=fetch,ttl=60000,clock=Date.now}={}){let cached=null,lastAttempt=null,lastSuccess=null,error=null,pending=null;async function refresh(){lastAttempt=clock();try{const res=await fetcher(CSV_URL,{signal:AbortSignal.timeout(15000),headers:{Accept:'text/csv'}});if(!res.ok||!res.headers.get('content-type')?.includes('text/csv'))throw Error('Không đọc được bảng sách.');const text=await res.text();const next=mapRows(parseCsv(text));cached=next;lastSuccess=new Date(clock()).toISOString();error=null}catch{error='Chưa đồng bộ được Google Sheets. Đang giữ bản cập nhật thành công gần nhất.'}finally{pending=null}}
return {async get(){if(lastAttempt===null||clock()-lastAttempt>=ttl){if(!pending)pending=refresh();await pending}else if(pending)await pending;return {books:cached||[],source:'google-sheets',lastSyncedAt:lastSuccess,stale:!!error,error,available:cached!==null}},url:SHEET_URL};}
