import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
export function createStore(filename){
 const db=new DatabaseSync(filename);db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY,book_id INTEGER NOT NULL,name TEXT NOT NULL,body TEXT NOT NULL,spoiler INTEGER NOT NULL,parent_id TEXT REFERENCES posts(id),created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS posts_book ON posts(book_id,created_at);`);
 const map=r=>({id:r.id,bookId:r.book_id,name:r.name,body:r.body,spoiler:!!r.spoiler,parentId:r.parent_id,createdAt:r.created_at});
 return {close:()=>db.close(),list(bookId){return db.prepare('SELECT * FROM posts WHERE book_id=? ORDER BY created_at,rowid').all(bookId).map(map)},add(bookId,input){
 if(!input||typeof input!=='object')throw Error('Dữ liệu không hợp lệ.');
 const name=typeof input.name==='string'?input.name.trim():'',body=typeof input.body==='string'?input.body.trim():'';
 if(!name||name.length>60)throw Error('Tên hiển thị phải có từ 1 đến 60 ký tự.');if(body.length<3||body.length>2000)throw Error('Nội dung phải có từ 3 đến 2000 ký tự.');if(typeof input.spoiler!=='boolean')throw Error('Nhãn tiết lộ nội dung không hợp lệ.');
 let parentId=input.parentId??null;if(parentId!==null){if(typeof parentId!=='string')throw Error('Bài trả lời không hợp lệ.');const parent=db.prepare('SELECT book_id,parent_id,id FROM posts WHERE id=?').get(parentId);if(!parent||parent.book_id!==bookId)throw Error('Không tìm thấy bài thảo luận trong sách này.');parentId=parent.parent_id||parent.id;}
 const p={id:randomUUID(),bookId,name,body,spoiler:input.spoiler,parentId,createdAt:new Date().toISOString()};db.prepare('INSERT INTO posts VALUES (?,?,?,?,?,?,?)').run(p.id,bookId,name,body,p.spoiler?1:0,parentId,p.createdAt);return p;
 }};
}


