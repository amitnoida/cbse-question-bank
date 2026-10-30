declare module 'mammoth/mammoth.browser' {
 export function convertToHtml(input:{arrayBuffer:ArrayBuffer},options:{externalFileAccess:boolean;convertImage:unknown}):Promise<{value:string;messages:unknown[]}>;
 export const images:{imgElement:(fn:()=>Promise<{src:string;alt:string}>)=>unknown};
}
