import http from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from './discussion-store.js';
import {createCatalog} from './catalog.js';
import {createAiCatalogEnrichment} from './ai-catalog.js';
import {validateOrder} from './order-submission.js';
const root=path.dirname(fileURLToPath(import.meta.url));
export async function createApp({database=path.join(root,'data','discussions.sqlite'),catalog=createCatalog(),orderSheetUrl=process.env.GOOGLE_SHEETS_ORDER_URL,orderToken=process.env.GOOGLE_SHEETS_ORDER_TOKEN,fetcher=fetch}={}){
 if(database!==':memory:')await mkdir(path.dirname(database),{recursive:true});const store=createStore(database);
 const aiCatalog=createAiCatalogEnrichment({cacheFile:path.join(root,'data','ai-catalog.json')});
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data))};
 const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');const match=url.pathname.match(/^\/api\/books\/(\d+)\/discussions$/);
 if(url.pathname.startsWith('/api/')){
 if(url.pathname==='/api/books'&&req.method==='GET'){
  const data=await catalog.get();if(!data.available)return json(res,503,data);
  const books=await aiCatalog.enrich(data.books);
  if(orderSheetUrl&&orderToken){
   const updates=books.map((book,i)=>({book,original:data.books[i]})).filter(({book,original})=>book.sheetRow&&(book.category!==original.category||book.description!==original.description));
   for(let i=0;i<updates.length;i+=8){
    await Promise.all(updates.slice(i,i+8).map(async({book})=>{
     try{
      const response=await fetcher(orderSheetUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sheet:'Book Manage',action:'update',row:book.sheetRow,values:{'Thể loại':book.category,'Nội dung sách':book.description},token:orderToken}),signal:AbortSignal.timeout(15000)});
      if(!response.ok)return;const result=await response.json();if(result?.ok!==true)return;
     }catch{}
    }));
   }
  }
  return json(res,200,{...data,books:books.map(({sheetRow,...book})=>book)});
 }
 if(url.pathname==='/api/orders'){
 if(req.method!=='POST')return json(res,405,{error:'Phương thức không được hỗ trợ.'});
 const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`&&origin!=='http://127.0.0.1:5173'&&origin!=='http://localhost:5173')return json(res,403,{error:'Nguồn gửi không hợp lệ.'});
 if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Vui lòng gửi dữ liệu JSON.'});
 let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){json(res,413,{error:'Nội dung quá dài.'});return}chunks.push(chunk)}
 let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json(res,400,{error:'Dữ liệu JSON không hợp lệ.'})}
 const data=await catalog.get();if(!data.available)return json(res,503,{error:'Chưa tải được danh mục sản phẩm.'});
 let order;try{order=validateOrder(input,data.books)}catch(e){return json(res,400,{error:e.message})}
 let endpoint;try{endpoint=new URL(orderSheetUrl);if(endpoint.protocol!=='https:')throw Error()}catch{return json(res,503,{error:'Chưa cấu hình lưu đơn hàng vào Google Sheets.'})}
 if(!orderToken)return json(res,503,{error:'Chưa cấu hình lưu đơn hàng vào Google Sheets.'});
 try{
 const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...order,token:orderToken}),signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok||result?.ok!==true||result.orderId!==order.orderId)throw Error();
 return json(res,201,{orderId:order.orderId});
 }catch{return json(res,502,{error:'Chưa lưu được đơn hàng vào Google Sheets. Vui lòng thử lại.'})}
 }
 const data=await catalog.get();if(!data.available)return json(res,503,{error:'Chưa tải được danh mục sách.'});
 const book=match&&data.books.find(b=>b.id===Number(match[1]));if(!book||book.productType==='ereader')return json(res,404,{error:'Không tìm thấy sách.'});const bookId=Number(match[1]);
 if(req.method==='GET')return json(res,200,store.list(bookId));
 if(req.method!=='POST')return json(res,405,{error:'Phương thức không được hỗ trợ.'});
 const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`&&origin!=='http://127.0.0.1:5173'&&origin!=='http://localhost:5173')return json(res,403,{error:'Nguồn gửi không hợp lệ.'});
 if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Vui lòng gửi dữ liệu JSON.'});
 let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){json(res,413,{error:'Nội dung quá dài.'});return}chunks.push(chunk)}
 let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json(res,400,{error:'Dữ liệu JSON không hợp lệ.'})}
 try{return json(res,201,store.add(bookId,input))}catch(e){return json(res,400,{error:e.message})}
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
 let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{res.writeHead(400);return res.end()}
 if(pathname.startsWith('/images/')){
 const name=pathname.slice('/images/'.length);const mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif'};
 if(!name||name!==path.basename(name)||name.includes('\\')||!mime[path.extname(name).toLowerCase()]){res.writeHead(404);return res.end()}
 try{const data=await readFile(path.join(root,'Images',name));res.writeHead(200,{'Content-Type':mime[path.extname(name).toLowerCase()],'Content-Length':data.length,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});return res.end(req.method==='HEAD'?undefined:data)}catch{res.writeHead(404);return res.end()}
 }
 const base=path.join(root,'dist');let file=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end()}
 try{if(!(await stat(file)).isFile())throw Error();const data=await readFile(file);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data)}catch{res.writeHead(404);res.end('Không tìm thấy trang. Hãy chạy npm run build trước.')}
 }catch{if(!res.headersSent)json(res,500,{error:'Máy chủ gặp lỗi. Vui lòng thử lại.'});else res.end()}});
 server.on('close',()=>store.close());return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const server=await createApp();server.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>console.log(`Stillleaf: http://localhost:${server.address().port}`))}
