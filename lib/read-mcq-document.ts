import {MAX_IMPORT_TEXT} from './mcq-document-parser';
export async function readMcqDocument(bytes:ArrayBuffer,name:string,progress:(message:string)=>void):Promise<string>{
 if(bytes.byteLength>10485760)throw Error('Maximum file size is 10 MB.');
 if(/\.pdf$/i.test(name)){
 progress('Reading PDF pages…');
 const pdfjs=await import('pdfjs-dist');
 pdfjs.GlobalWorkerOptions.workerSrc='/document-readers/pdf.worker.min.mjs';
 const loading=pdfjs.getDocument({data:new Uint8Array(bytes),useSystemFonts:true});
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
 const doc=await Promise.race([loading.promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('PDF reader timed out. Source retained; retry or use a simpler text PDF.')),45000);})]);
 if(timer)clearTimeout(timer);
 if(doc.numPages>300)throw Error('Maximum 300 PDF pages in this POC. Split the file before retrying.');
 let text='';
 for(let i=1;i<=doc.numPages;i++){
 progress(`Reading PDF page ${i} of ${doc.numPages}…`);
 const page=await doc.getPage(i);const content=await page.getTextContent();let lastY:number|null=null;
 for(const item of content.items){if(!('str' in item))continue;const y=item.transform[5];if(lastY!==null&&Math.abs(y-lastY)>3)text+='\n';text+=item.str+' ';if(item.hasEOL)text+='\n';lastY=y;}
 text+='\n';page.cleanup();if(text.length>MAX_IMPORT_TEXT)throw Error('Document is too large to process in one batch. Split it before retrying.');
 }
 if(text.trim().length<20)throw Error('No readable PDF text found. Scans and screenshots are not supported; upload a selectable-text PDF.');
 return text;
 }finally{if(timer)clearTimeout(timer);await loading.destroy();}
 }
 if(/\.docx$/i.test(name)){
 progress('Reading Word document…');
 const mammoth=await import('mammoth/mammoth.browser');
 const result=await mammoth.convertToHtml({arrayBuffer:bytes},{externalFileAccess:false,convertImage:mammoth.images.imgElement(async()=>({src:'data:,',alt:'[[UNSUPPORTED_IMAGE]]'}))});
 // Never render document HTML. Read inert text only and mark image-dependent blocks for skipping.
 const doc=new DOMParser().parseFromString(result.value,'text/html');
 doc.querySelectorAll('img').forEach(img=>img.replaceWith(doc.createTextNode(' [[UNSUPPORTED_IMAGE]] ')));
 doc.querySelectorAll('br').forEach(br=>br.replaceWith(doc.createTextNode('\n')));
 const text=Array.from(doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6')).map(p=>p.textContent||'').join('\n');
 if(text.length>MAX_IMPORT_TEXT)throw Error('Word document is too large. Split it before retrying.');
 if(text.trim().length<20)throw Error('No readable document text found.');return text;
 }
 throw Error('Use a text-based PDF or Word .docx document.');
}
