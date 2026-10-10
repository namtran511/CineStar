import { requireUser } from '@/lib/server/auth';
import { api,HttpError } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
export const GET=api(async request=>{
 await requireUser(request,['admin']);const params=new URL(request.url).searchParams,values=[],filters=[];
 for(const field of ['entity','actor_id','entity_id','request_id']){const value=params.get(field);if(value){if(value.length>100)throw new HttpError(400,'Bộ lọc không hợp lệ.');filters.push(`${field}=?`);values.push(value);}}
 const q=(params.get('q')||'').trim();if(q){if(q.length>100)throw new HttpError(400,'Từ khóa quá dài.');filters.push("instr(lower(actor_name||' '||entity_id||' '||reason||' '||coalesce(before_json,'')||' '||coalesce(after_json,'')),lower(?))>0");values.push(q);}
 const before=params.get('before');if(before){if(!/^\d+$/.test(before)||!Number.isSafeInteger(Number(before)))throw new HttpError(400,'Mốc nhật ký không hợp lệ.');filters.push('id<?');values.push(Number(before));}
 const db=await getDb();const result=await db.prepare(`SELECT * FROM audit_logs ${filters.length?'WHERE '+filters.join(' AND '):''} ORDER BY id DESC LIMIT 51`).bind(...values).all();
 const rows=result.results.slice(0,50).map(row=>({...row,before:row.before_json?JSON.parse(row.before_json):null,after:row.after_json?JSON.parse(row.after_json):null,before_json:undefined,after_json:undefined}));
 return Response.json({logs:rows,nextCursor:result.results.length>50?rows.at(-1).id:null});
});
