"use client";
import { useEffect, useState } from 'react';
import './email.css';
export async function emailRequest(url,body,method='POST') {
    const response = await fetch(url,{method,headers:{'Content-Type':'application/json'},...(body !== undefined ? {body:JSON.stringify(body)} : {}),cache:'no-store'});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Chưa hoàn tất yêu cầu email.');
    return result;
}
export default function EmailVerification({ challenge, onChallenge, onVerified, onBack }) {
    const [code,setCode] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState(''), [now,setNow] = useState(Date.now());
    useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer);},[]);
    const seconds=Math.max(0,Math.ceil((challenge.resendAt-now)/1000));
    async function verify(event) {
        event.preventDefault();setBusy(true);setError('');setNotice('');
        try { const result=await emailRequest('/api/auth/verify-email',{challengeId:challenge.challengeId,code}); await onVerified(result); }
        catch(error){setError(error.message);} finally{setBusy(false);}
    }
    async function resend() {
        setBusy(true);setError('');setNotice('');
        try {onChallenge(await emailRequest('/api/auth/resend-code',{challengeId:challenge.challengeId}));setCode('');setNotice('Đã gửi mã mới. Hãy dùng mã trong email mới nhất.');}
        catch(error){setError(error.message);}finally{setBusy(false);}
    }
    return <section className="email-verify"><p>Mã xác minh đã được gửi đến <strong>{challenge.email}</strong>. Mã có hiệu lực 10 phút. Kiểm tra cả thư mục Spam.</p>
        <form onSubmit={verify}><label>Mã xác minh<input aria-label="Mã xác minh email" className="email-code" autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>
        {now>=challenge.expiresAt && <p role="status">Mã đã hết hạn. Vui lòng yêu cầu mã mới.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        <button className="primary" disabled={busy || code.length!==6 || now>=challenge.expiresAt}>{busy?'Đang xử lý…':'Xác minh email'}</button></form>
        <div className="email-actions"><button type="button" disabled={busy || seconds>0} onClick={resend}>{seconds?`Gửi lại sau ${seconds}s`:'Gửi lại mã'}</button>{onBack && <button type="button" disabled={busy} onClick={onBack}>Nhập lại thông tin</button>}</div>
    </section>;
}
