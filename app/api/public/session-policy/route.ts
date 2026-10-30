import {NextResponse} from "next/server";
// Release marker contains no user data or secrets. Enforcement remains server-side.
export function GET(){return NextResponse.json({version:1,maxStudentSessions:2},{headers:{'Cache-Control':'no-store'}});}
