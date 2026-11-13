"use client";
import { useEffect, useState } from 'react';
import EmailVerification, { emailRequest } from './EmailVerification';
export default function EmailPreferences() {
    const [data,setData]=useState(null),[challenge,setChallenge]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
    const load=async()=>setData(await emailRequest('/api/email/preferences',undefined,'GET'));
    useEffect(()=>{load().catch(error=>setError(error.message));},[]);
    async function action(task) {setBusy(true);setError('');setNotice('');try{await task();}catch(error){setError(error.message);}finally{setBusy(false);}}
    return <section className="email-settings"><h3>Thông báo qua email</h3>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        {!data ? <button type="button" onClick={()=>action(load)} disabled={busy}>Tải tùy chọn email</button> : <>
            <p><strong>{data.email}</strong> · {data.verified?'Đã xác minh':'Chưa xác minh'}</p>
            <p>Email xác nhận đặt vé, hủy vé và sự cố được gửi đến địa chỉ đã xác minh.</p>
            {!data.verified && !challenge && <button type="button" className="primary" disabled={busy} onClick={()=>action(async()=>setChallenge(await emailRequest('/api/email/verify-request',{})))}>Gửi mã xác minh</button>}
            {challenge && <EmailVerification challenge={challenge} onChallenge={setChallenge} onBack={()=>setChallenge(null)} onVerified={async()=>{setChallenge(null);await load();setNotice('Email đã được xác minh.');}}/>}
            <form onSubmit={event=>{event.preventDefault();action(async()=>{setData(await emailRequest('/api/email/preferences',{marketing:data.marketing,birthday:data.birthday},'PATCH'));setNotice('Đã lưu tùy chọn email.');});}}>
                <label className="email-check"><input type="checkbox" checked={data.marketing} onChange={e=>setData({...data,marketing:e.target.checked})}/>Nhận email về ưu đãi mới</label>
                <label className="email-check"><input type="checkbox" checked={data.birthday} onChange={e=>setData({...data,birthday:e.target.checked})}/>Nhận lời chúc và ưu đãi sinh nhật</label>
                <button type="submit" className="primary" disabled={busy}>Lưu tùy chọn</button>
            </form>
        </>}
    </section>;
}
