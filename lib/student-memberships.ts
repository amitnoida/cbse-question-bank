export type MembershipClass = {id:number;name:string;number:number;is_home:boolean;paid:boolean};
export type MembershipProduct = {code:string;name:string;price_inr:number|null;available?:boolean;description:string;class_numbers?:number[];class_ids?:number[];revision?:number};
export type StudentMembership = {id:number;code:string|null;name:string;class_ids:number[];class_names:string[];start_date:string;end_date:string|null;status:string;legacy:boolean};
export type MembershipState = {simple_class12:boolean;profile:{full_name:string;class_id:number|null;home_class_id:number|null};paid_current_class:boolean;classes:MembershipClass[];products:MembershipProduct[];legacy_offer:MembershipProduct|null;memberships:StudentMembership[];checkout_available:boolean};
export type MembershipQuote = {code:string;name:string;class_ids:number[];price_inr:number;discount_inr:number;payable_inr:number;start_date:string;end_date:string;activation:string;coupon_code:string;renewal:boolean;price_revision:number|null};
export const membershipDate = (s:string|null) => s ? new Date(s).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "No expiry";
export const membershipPrice = (n:number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(n);
