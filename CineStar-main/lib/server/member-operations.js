import { z } from 'zod';
import { getDb } from './db';
import { HttpError } from './http';
import { checkedBirthDate } from './users';
import { membershipCardNumber } from '../membership-rules';
const reason=z.string().trim().min(3).max(500);
function parse(schema,body){const result=schema.safeParse(body);if(!result.success)throw new HttpError(400,'Kiểm tra dữ liệu và nhập lý do từ 3 đến 500 ký tự.');return result.data;}
export async function findMembers(query){
 const q=query.trim();if(q.length<2)return [];
 if(q.length>100)throw new HttpError(400,'Từ khóa quá dài.');
 const db=await getDb();
 const result=await db.prepare("SELECT id,name,email,birth_date FROM users WHERE role='user' AND deleted_at IS NULL AND (instr(lower(name),lower(?))>0 OR instr(lower(email),lower(?))>0 OR instr('CV'||upper(replace(id,'-','')),upper(?))>0) ORDER BY name,id LIMIT 100").bind(q,q,q).all();
 return result.results.map(row=>({id:row.id,name:row.name,email:row.email,birthDate:row.birth_date,cardNumber:membershipCardNumber(row.id)}));
}
export async function editMemberBirthday(actor,id,body){
 if(!['staff','admin'].includes(actor.role))throw new HttpError(403,'Chỉ nhân viên hoặc admin được sửa ngày sinh khách hàng.');
 const data=parse(z.object({birthDate:z.string(),expectedBirthDate:z.string().nullable(),reason}).strict(),body);
 const date=checkedBirthDate(data.birthDate),db=await getDb();
 const result=await db.prepare("UPDATE users SET birth_date=? WHERE id=? AND role='user' AND deleted_at IS NULL AND birth_date IS ?").bind(date,id,data.expectedBirthDate).run();
 if(!result.meta.changes)throw new HttpError(409,'Ngày sinh hoặc tài khoản vừa thay đổi. Tải lại thông tin trước khi sửa.');
 return {id,birthDate:date};
}
export async function grantMemberPoints(actor,id,body){
 if(actor.role!=='admin')throw new HttpError(403,'Chỉ admin được cộng điểm thành viên.');
 const data=parse(z.object({points:z.number().int().min(1).max(1000000),reason,requestId:z.string().uuid()}).strict(),body);
 const db=await getDb(),event=`admin-grant:${data.requestId}`;
 const previous=await db.prepare('SELECT user_id,delta,description FROM membership_transactions WHERE event_key=?').bind(event).first();
 const description=`Admin cộng điểm: ${data.reason}`;
 if(previous){if(previous.user_id!==id||previous.delta!==data.points||previous.description!==description)throw new HttpError(409,'Mã yêu cầu đã được dùng cho giao dịch khác.');return {ok:true,replayed:true};}
 const member=await db.prepare("SELECT id FROM users WHERE id=? AND role='user' AND deleted_at IS NULL").bind(id).first();if(!member)throw new HttpError(404,'Thành viên không tồn tại hoặc đã ngừng hoạt động.');
 try{await db.batch([
  db.prepare("UPDATE users SET points=CASE WHEN role='user' AND deleted_at IS NULL AND points+?<=1000000000 THEN points+? ELSE -1 END WHERE id=?").bind(data.points,data.points,id),
  db.prepare('INSERT INTO membership_transactions(id,user_id,delta,description,event_key,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,data.points,description,event,new Date().toISOString()),
 ]);}catch(error){if(/UNIQUE/.test(String(error))){const existing=await db.prepare('SELECT user_id,delta,description FROM membership_transactions WHERE event_key=?').bind(event).first();if(existing?.user_id===id&&existing.delta===data.points&&existing.description===description)return {ok:true,replayed:true};throw new HttpError(409,'Mã yêu cầu đã được sử dụng.');}if(/CHECK/.test(String(error)))throw new HttpError(409,'Tài khoản vừa thay đổi hoặc số dư vượt giới hạn.');throw error;}
 return {ok:true,replayed:false};
}
