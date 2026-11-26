import test from 'node:test';
import assert from 'node:assert/strict';
import {inferCategory,createAiCatalogEnrichment} from './ai-catalog.js';

test('infers a useful category without AI',()=>{assert.equal(inferCategory('Đọc vị bất kỳ ai'),'Tâm lý');assert.equal(inferCategory('TikTok Marketing'),'Kinh doanh');assert.equal(inferCategory('Triết học cuộc đời'),'Triết học')});

test('uses Gemini JSON and caches it',async(t)=>{const cacheFile=t.mock?null:null;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"description":"Cuốn sách giúp người đọc rèn luyện tư duy và hiểu rõ hơn nội dung quanh mình.","category":"Tâm lý"}'}]}}]}),{headers:{'content-type':'application/json'}});try{const ai=createAiCatalogEnrichment({apiKey:'test-key',cacheFile:null});const [book]=await ai.enrich([{id:1,title:'Đọc vị bất kỳ ai',author:'',category:'Chưa phân loại',description:'Nội dung sách đang được cập nhật.'}]);assert.equal(book.category,'Tâm lý');assert.match(book.description,/người đọc/)}finally{globalThis.fetch=originalFetch}});
