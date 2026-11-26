import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

export function inferCategory(title,author=''){
  const text=`${title} ${author}`.normalize('NFC').toLocaleLowerCase('vi-VN');
  const groups=[
    ['Kinh doanh',['marketing','kinh tế','tài chính','đầu tư','doanh','buffett','gates','jobs','steve']],
    ['Tâm lý',['tâm lý','cảm xúc','hạnh phúc','khát khao','giàu','thành công','hiện tại','đọc vị bất kỳ ai']],
    ['Triết học',['triết','stoic','khắc kỹ','lý quang','phẩm giá']],
    ['Lãnh đạo',['lãnh đạo','nhân viên','giao tiếp','quản trị','kỹ năng','tổ chức','khích lệ']],
    ['Văn học',['tiểu thuyết','truyện','văn học','đời','trà hoa','nghệ thuật']],
  ];
  for(const [category,words] of groups){
    if(words.some(word=>text.includes(word)))return category;
  }
  return 'Kỹ năng sống';
}

export function createAiCatalogEnrichment({apiKey=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL||'gemini-2.5-flash',cacheFile}={}){
  let cache=null;
  async function load(){
    if(cache)return cache;
    if(!cacheFile)return cache={};
    try{cache=JSON.parse(await readFile(cacheFile,'utf8'))}catch{cache={}}
    return cache;
  }
  async function save(){
    if(!cacheFile)return;
    await mkdir(path.dirname(cacheFile),{recursive:true});
    await writeFile(cacheFile,JSON.stringify(cache,null,2),'utf8');
  }
  async function generate(book){
    const needsDescription=!book.description||book.description==='Nội dung sách đang được cập nhật.'||book.description==='A description will be added soon.';
    const needsCategory=!book.category||book.category==='Chưa phân loại'||book.category==='Uncategorised';
    if(!needsDescription&&!needsCategory)return book;
    if(!apiKey)return {...book,category:needsCategory?inferCategory(book.title,book.author):book.category};
    const prompt=`Bạn là biên tập viên nhà sách Việt Nam. Trả JSON thuần, không markdown.
Sách: "${book.title}"
Tác giả/thương hiệu: "${book.author||'Không rõ'}"
Viết mô tả ngắn bằng tiếng Việt, trung lập, 2-3 câu, không phỏng đoán tác giả.
Chọn một thể loại: Kinh doanh, Tâm lý, Triết học, Lãnh đạo, Văn học, Thiên nhiên, Kỹ năng sống.
Trả về {"description":"...","category":"..."}`;
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.4,maxOutputTokens:180,responseMimeType:'application/json'}}),
        signal:AbortSignal.timeout(15000),
      });
      if(!res.ok)throw Error(`Gemini ${res.status}`);
      const data=await res.json();
      const text=data.candidates?.[0]?.content?.parts?.map(part=>part.text||'').join('');
      const result=JSON.parse(text.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
      const description=typeof result.description==='string'?result.description.trim():book.description;
      const category=typeof result.category==='string'?result.category.trim():inferCategory(book.title,book.author);
      return {...book,description:needsDescription&&description?description:book.description,category:needsCategory&&category?category:book.category};
    }catch{
      return {...book,category:needsCategory?inferCategory(book.title,book.author):book.category};
    }
  }
  async function enrich(books){
    await load();
    const enriched=await Promise.all(books.map(async book=>{
      const key=String(book.id);
      if(cache[key])return {...book,description:cache[key].description||book.description,category:book.category==='Chưa phân loại'?cache[key].category||book.category:book.category};
      const result=await generate(book);
      if(result.description!=='Nội dung sách đang được cập nhật.'||result.category!=='Chưa phân loại'){
        cache[key]={description:result.description,category:result.category};
        await save();
      }
      return result;
    }));
    return enriched;
  }
  return {enrich};
}
