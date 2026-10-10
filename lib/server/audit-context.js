import { AsyncLocalStorage } from 'node:async_hooks';
export const auditScope = new AsyncLocalStorage();
const rawStatement = Symbol('rawStatement');
export function setAuditActor(user) { const context=auditScope.getStore();if(context&&user)context.actor={id:user.id,name:user.name,role:user.role}; }
export function setAuditReason(reason) { const context=auditScope.getStore();if(context&&typeof reason==='string')context.reason=reason.trim().slice(0,500); }
// Context and mutations are serialized in the SAME D1 transaction, so parallel
// requests cannot borrow each other's identity and failed writes leave no log.
export function auditedDb(db) {
    async function batch(statements) {
        const context=auditScope.getStore(),actor=context?.actor;
        if(!context)return db.batch(statements.map(statement=>statement[rawStatement]||statement));
        const result=await db.batch([
            db.prepare('INSERT OR REPLACE INTO audit_context (id,request_id,actor_id,actor_name,actor_role,reason,operation) VALUES (1,?,?,?,?,?,?)').bind(context.id,actor?.id||null,actor?.name||'Khách chưa đăng nhập',actor?.role||'anonymous',context.reason||'',context.operation),
            ...statements.map(statement=>statement[rawStatement]||statement),
            db.prepare('DELETE FROM audit_context WHERE id=1'),
        ]);
        return result.slice(1,-1);
    }
    function wrap(raw) {return {[rawStatement]:raw,bind(...args){return wrap(raw.bind(...args));},first(...args){return raw.first(...args);},all(...args){return raw.all(...args);},raw(...args){return raw.raw(...args);},async run(){return (await batch([raw]))[0];}};}
    return {prepare:query=>wrap(db.prepare(query)),batch};
}
