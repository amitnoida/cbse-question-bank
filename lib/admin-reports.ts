export type ReportCategory = "mcq" | "students" | "system";
export type ReportDefinition = {
  id: string;
  title: string;
  category: ReportCategory;
  source: string;
  columns: readonly string[];
  viewer: boolean;
  description: string;
};

export const REPORTS: readonly ReportDefinition[] = [
  { id:"mcq-summary", title:"Original MCQ Summary", category:"mcq", source:"subjects", columns:["class","subject","active","inactive","total"], viewer:true, description:"Class- and subject-wise question availability." },
  { id:"mcq-master", title:"Complete MCQ Master", category:"mcq", source:"questions", columns:["id","class","subject","chapter","question_text","option_a","option_b","option_c","option_d","correct_option","explanation","difficulty","question_usage","content_review_status","is_active"], viewer:true, description:"Full question bank and original answer data." },
  { id:"academic-master", title:"Academic Master Data", category:"mcq", source:"chapters", columns:["class","subject","id","chapter_number","chapter_name","hindi_course","is_active"], viewer:true, description:"Class, subject and chapter reference records." },
  { id:"chapter-counts", title:"Chapter-wise MCQ Counts", category:"mcq", source:"chapters", columns:["class","subject","chapter","active","inactive","total"], viewer:true, description:"Active and inactive MCQ counts for each chapter." },
  { id:"mcq-quality", title:"MCQ Quality Audit", category:"mcq", source:"questions", columns:["id","class","subject","chapter","question_text","correct_option","explanation","content_review_status","is_active"], viewer:true, description:"Questions with missing explanations or incomplete content." },
  { id:"mcq-inactive", title:"Inactive & Pending Review MCQs", category:"mcq", source:"questions", columns:["id","class","subject","chapter","question_text","is_active","content_review_status","question_usage"], viewer:true, description:"Inactive questions and questions awaiting academic clearance." },
  { id:"media-audit", title:"Image & Media Audit", category:"mcq", source:"questions", columns:["id","class","subject","chapter","question_text","question_media","media_ready","content_review_status","is_active"], viewer:true, description:"Questions containing an attached media reference." },
  { id:"mock-readiness", title:"Mock Test Readiness", category:"mcq", source:"subjects", columns:["class","subject","mock","shared","total_pool","required_mock","required_shared","ready"], viewer:true, description:"Eligibility against the 48 MOCK + 12 SHARED question rule." },
  { id:"student-directory", title:"Student Directory", category:"students", source:"student_profiles", columns:["id","full_name","email","email_verified","class","membership","account_type","is_active","created_at"], viewer:false, description:"Authorized student account records; Full Admin only." },
  { id:"student-activity", title:"Student Activity Summary", category:"students", source:"quiz_attempts", columns:["class","subject","attempts","completed","average_percentage"], viewer:true, description:"Aggregated quiz activity, never student identities for viewers." },
  { id:"subscriptions", title:"Subscription & Expiry", category:"students", source:"subscriptions", columns:["id","student_id","plan_id","status","start_date","end_date","amount_paid"], viewer:false, description:"Membership status and subscription expiry." },
  { id:"coupons", title:"Coupon Usage", category:"students", source:"coupons", columns:["id","coupon_code","discount_percentage","is_active","usage_count","usage_limit","valid_from","valid_until"], viewer:false, description:"Coupon lifecycle and redemption totals." },
  { id:"mock-performance", title:"Mock Test Performance", category:"students", source:"quiz_attempts", columns:["class","subject","attempts","completed","average_percentage"], viewer:true, description:"Aggregated mock scores by class and subject." },
  { id:"free-usage", title:"Free Usage & Conversion", category:"students", source:"free_usage", columns:["id","student_id","subject","questions_used","questions_allowed","last_used_at"], viewer:false, description:"Per-subject free usage; Full Admin only." },
  { id:"function-audit", title:"Function/RLS Audit", category:"system", source:"metadata", columns:["object_type","name","detail"], viewer:false, description:"Live privileged database metadata; requires a dedicated read-only audit RPC." },
  { id:"db-size", title:"Database Size & Performance", category:"system", source:"stats", columns:["metric","value","unit"], viewer:false, description:"Live database totals and largest tables." },
  { id:"rls-policies", title:"RLS Policy Details", category:"system", source:"metadata", columns:["schema","table","policy","command"], viewer:false, description:"Live row-level security policy details; requires a dedicated read-only audit RPC." },
  { id:"integrity", title:"Data Integrity Audit", category:"system", source:"questions", columns:["id","class","subject","chapter","question_text","correct_option","explanation","is_active"], viewer:false, description:"Potential missing values in stored questions (not a full relational integrity verification)." },
  { id:"admin-access", title:"Admin Access Report", category:"system", source:"admin_profiles", columns:["id","full_name","email","role","is_active","must_change_password","created_at"], viewer:false, description:"Administrative roles and activation state." },
];

export function findReport(id:string){ return REPORTS.find(r=>r.id===id); }
