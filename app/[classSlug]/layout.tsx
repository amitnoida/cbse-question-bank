import type { ReactNode } from "react";
import { PublicHeader, PublicFooter } from "../public-navigation";
export default function PublicClassLayout({children}:{children:ReactNode}){return <div className="min-h-screen bg-slate-50 text-slate-900"><PublicHeader/><div id="main-content" tabIndex={-1}>{children}</div><PublicFooter/></div>}
