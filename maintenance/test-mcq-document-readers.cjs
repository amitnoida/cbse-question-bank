const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
const vm=require("node:vm");
const mammoth=require("mammoth");
const path=require("node:path");
const fixture=filename=>path.join(__dirname,"../e2e/fixtures-generated",filename);
const moduleExports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,"../lib/mcq-document-parser.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:moduleExports});
const parse=moduleExports.parseMcqDocument;
function validate(label,text){
 const result=parse(text);
 assert.equal(result.total,2,label+" should contain two numbered questions");
 assert.equal(result.questions.length,1,label+" should accept only complete questions");
 assert.equal(result.skipped,1,label+" should skip incomplete question");
 assert.equal(result.questions[0].correct_option,"D");
 assert.match(result.questions[0].explanation,/Adding two and two gives four/);
}
test("Selectable-text PDF fixture is extractable with production pdfjs-dist",async()=>{
 const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
 const loading=pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(fixture("sample-mcqs.pdf"))),useSystemFonts:true,disableFontFace:true});
 try{
  const pdf=await loading.promise;assert.equal(pdf.numPages,1);
  const content=await(await pdf.getPage(1)).getTextContent();
  const text=content.items.map(x=>"str"in x?x.str+(x.hasEOL?"\n":" "):"").join("");
  validate("PDF",text);
 }finally{await loading.destroy();}
});
test("Real Word DOCX fixture is extractable with production mammoth",async()=>{
 const result=await mammoth.extractRawText({buffer:fs.readFileSync(fixture("sample-mcqs.docx"))});
 validate("DOCX",result.value);
});
