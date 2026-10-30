import { createClient } from "@supabase/supabase-js";
import {createSessionPolicyFetch,SESSION_REVOKED_EVENT} from "./student-session-policy";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabaseStorageKey=`sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {auth:{storageKey:supabaseStorageKey},global:{fetch:createSessionPolicyFetch(supabaseUrl,supabaseAnonKey,(input,init)=>globalThis.fetch(input,init),(sessionId)=>{
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent(SESSION_REVOKED_EVENT,{detail:{sessionId}}));
  })}}
);