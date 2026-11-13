"use client";
import { useState } from 'react';
import { emailRequest } from '../../components/EmailVerification';
export default function Unsubscribe() {
    const [done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
    async function unsubscribe(){setBusy(true);setError('');try{await emailRequest('/api/email/unsubscribe',{token:new URL(window.location.href).searchParams.get('token')});setDone(true);}catch(error){setError(error.message);}finally{setBusy(false);}}
    return <main className="email-unsubscribe"><h1>{done?'Đã cập nhật tùy chọn':'Ngừng nhận email ưu đãi và sinh nhật'}</h1><p>{done?'Bạn sẽ không nhận email ưu đãi và sinh nhật nữa.':'Xác nhận để ngừng nhận email ưu đãi và chúc mừng sinh nhật từ CineStar.'}</p><p>Email liên quan đến vé và sự cố vẫn được gửi để bạn theo dõi đơn hàng.</p>{error&&<p role="alert">{error}</p>}{!done&&<button className="primary" disabled={busy} onClick={unsubscribe}>{busy?'Đang xử lý…':'Xác nhận ngừng nhận'}</button>}<p><a href="/">Về CineStar</a></p></main>;
}
