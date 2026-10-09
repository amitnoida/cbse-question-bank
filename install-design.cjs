/* Run from project root: node install-design.cjs */
const fs=require('fs'),path=require('path');
const root=process.cwd(), base=__dirname;
const check=path.join(root,'app','page.tsx');
if(!fs.existsSync(check)||!fs.existsSync(path.join(root,'package.json'))){console.error('Run this script inside your Next.js project folder.');process.exit(1)}
const backup=path.join(root,'design-backup-'+new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backup,{recursive:true});
function replaceFile(relative){const target=path.join(root,relative);const source=path.join(base,relative);if(fs.existsSync(target)){const old=path.join(backup,relative);fs.mkdirSync(path.dirname(old),{recursive:true});fs.copyFileSync(target,old)}fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);console.log('Updated:',relative)}
replaceFile('app/page.tsx');replaceFile('app/design-refresh.css');replaceFile('public/images/cbse-students.webp');
for(const [rel,scope] of [['app/admin/page.tsx','cbse-refreshed-admin'],['app/dashboard/page.tsx','cbse-refreshed-dashboard']]){
 const target=path.join(root,rel);if(!fs.existsSync(target)){console.log('Not found; left unchanged:',rel);continue}
 let s=fs.readFileSync(target,'utf8');const old=path.join(backup,rel);fs.mkdirSync(path.dirname(old),{recursive:true});fs.copyFileSync(target,old);
 if(!s.includes('design-refresh.css')){const m=s.match(/^([ \t]*["']use client["'];?[ \t]*\r?\n)/);if(m)s=s.replace(m[0],m[0]+'import "../design-refresh.css";\n');else s='import "../design-refresh.css";\n'+s}
 // Add scope to top-level main only, without changing event handlers, queries or permissions.
 const tag=/<main\b([^>]*?)className="([^"]*)"/;
 if(!s.includes(scope)&&tag.test(s))s=s.replace(tag,(full,attrs,classes)=>`<main${attrs}className="${scope} ${classes}"`);
 fs.writeFileSync(target,s,'utf8');console.log('Styled existing page:',rel)
}
console.log('Backups saved:',backup);console.log('Run: npm run build');
