import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

export function inferCategory(title,author=''){
  const text=(title+' '+author).normalize('NFC').toLocaleLowerCase('vi-VN');
  const groups=[
    ['Kinh doanh',/(kinh doanh|marketing|kinh t\u1ebf|t\u00e0i ch\u00ednh|\u0111\u1ea7u t\u01b0|doanh nh\u00e2n|buffett|gates|jobs|startup)/u],
    ['T\u00e2m l\u00fd',/(t\u00e2m l\u00fd|c\u1ea3m x\u00fac|h\u1ea1nh ph\u00fac|kh\u00e1t khao|\u0111\u1ecdc v\u1ecb|tr\u1ea7m c\u1ea3m|h\u00e0nh vi)/u],
    ['Tri\u1ebft h\u1ecdc',/(tri\u1ebft|stoic|kh\u1eafc k\u1ef7|ph\u1ea9m gi\u00e1|\u00fd th\u1ee9c|hi\u1ec7n sinh)/u],
    ['L\u00e3nh \u0111\u1ea1o',/(l\u00e3nh \u0111\u1ea1o|nh\u00e2n vi\u00ean|giao ti\u1ebfp|qu\u1ea3n tr\u1ecb|t\u1ed5 ch\u1ee9c|\u0111\u1ed9i nh\u00f3m)/u],
    ['V\u0103n h\u1ecdc',/(ti\u1ec3u thuy\u1ebft|truy\u1ec7n|v\u0103n h\u1ecdc|th\u01a1|ti\u1ec3u lu\u1eadn|tr\u00e0 hoa)/u],
    ['Thi\u00ean nhi\u00ean',/(thi\u00ean nhi\u00ean|m\u00f4i tr\u01b0\u1eddng|\u0111\u1ed9ng v\u1eadt|th\u1ef1c v\u1eadt|r\u1eebng|\u0111\u1ea5t)/u]
  ];
  for(const [category,pattern] of groups)if(pattern.test(text))return category;
  return 'K\u1ef9 n\u0103ng s\u1ed1ng';
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
    const placeholderDescription=/^(N\u1ed9i dung s\u00e1ch \u0111ang \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt\.|A description will be added soon\.)$/i;
    const placeholderCategory=/^(Ch\u01b0a ph\u00e2n lo\u1ea1i|Uncategorised)$/i;
    const needsDescription=!book.description||placeholderDescription.test(book.description);
    const needsCategory=!book.category||placeholderCategory.test(book.category);
    if(!needsDescription&&!needsCategory)return book;
    const category=needsCategory?inferCategory(book.title,book.author):book.category;
    const fallbackDescription=book.title+' \u0111\u01b0\u1ee3c g\u1ee3i \u00fd cho b\u1ea1n \u0111\u1ecdc quan t\u00e2m \u0111\u1ebfn ch\u1ee7 \u0111\u1ec1 '+category+'. M\u00f4 t\u1ea3 \u0111ang \u0111\u01b0\u1ee3c b\u1ed5 sung; vui l\u00f2ng tham kh\u1ea3o th\u00f4ng tin xu\u1ea5t b\u1ea3n \u0111\u1ec3 bi\u1ebft th\u00eam chi ti\u1ebft.';
    if(!apiKey)return {...book,category,description:needsDescription?fallbackDescription:book.description};
    const prompt='Act as a Vietnamese bookshop editor. Write a cautious two or three sentence Vietnamese description using only reliable information; do not invent plot details. Classify into exactly one English label: business, psychology, philosophy, leadership, fiction, nature, or life skills. Return JSON with description and category.\nBook: '+JSON.stringify(book.title)+'\nAuthor: '+JSON.stringify(book.author||'unknown');
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
      const categoryLabels={business:'K\u0069nh doanh',psychology:'T\u00e2m l\u00fd',philosophy:'Tri\u1ebft h\u1ecdc',leadership:'L\u00e3nh \u0111\u1ea1o',fiction:'V\u0103n h\u1ecdc',nature:'Thi\u00ean nhi\u00ean','life skills':'K\u1ef9 n\u0103ng s\u1ed1ng'};
      const category=categoryLabels[String(result.category||'').trim().toLowerCase()]||inferCategory(book.title,book.author);
      return {...book,description:needsDescription&&description?description:book.description,category:needsCategory&&category?category:book.category};
    }catch{return {...book,category,description:needsDescription?fallbackDescription:book.description}}

  }
  async function enrich(books){
    await load();
    const enriched=await Promise.all(books.map(async book=>{
      const key=String(book.id);
      if(cache[key]){
        const missingCategory=!book.category||book.category==='Ch\u01b0a ph\u00e2n lo\u1ea1i'||book.category==='Uncategorised';
        return {...book,description:cache[key].description||book.description,category:missingCategory?cache[key].category||book.category:book.category};
      }
      const result=await generate(book);
      if(result.description&&result.category){
        cache[key]={description:result.description,category:result.category};
        await save();
      }
      return result;
    }));
    return enriched;
  }
  return {enrich};
}
