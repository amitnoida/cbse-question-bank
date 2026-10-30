const fs=require('node:fs');const path=require('node:path');
const target=path.join(process.cwd(),'public/document-readers');fs.mkdirSync(target,{recursive:true});
fs.copyFileSync(require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),path.join(target,'pdf.worker.min.mjs'));
fs.copyFileSync(require.resolve('pdfjs-dist/LICENSE'),path.join(target,'PDFJS-LICENSE.txt'));
fs.copyFileSync(require.resolve('mammoth/LICENSE'),path.join(target,'MAMMOTH-LICENSE.txt'));
