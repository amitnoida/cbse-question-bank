export type AdminStudentInput={requestId:string;fullName:string;email:string;password:string;classId:number;membership:"FREE"|"PAID";accountRole:"STUDENT"|"TEACHER"};
export function parseAdminStudent(value:unknown):AdminStudentInput|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const b=value as Record<string,unknown>;
 if(typeof b.requestId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.requestId))return null;
 if(typeof b.fullName!=="string"||!b.fullName.trim()||b.fullName.trim().length>120)return null;
 if(typeof b.email!=="string"||b.email.trim().length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim()))return null;
 if(typeof b.password!=="string"||b.password.length<12||b.password.length>128)return null;
 if(typeof b.classId!=="number"||!Number.isSafeInteger(b.classId)||b.classId<1||!['FREE','PAID'].includes(String(b.membership)))return null;
 if(b.accountRole!==undefined&&!['STUDENT','TEACHER'].includes(String(b.accountRole)))return null;
 if(b.accountRole==='TEACHER'&&b.membership!=='PAID')return null;
 return {accountRole:(b.accountRole||'STUDENT') as 'STUDENT'|'TEACHER',requestId:b.requestId,fullName:b.fullName.trim(),email:b.email.trim().toLowerCase(),password:b.password,classId:b.classId,membership:b.membership as 'FREE'|'PAID'};
}
