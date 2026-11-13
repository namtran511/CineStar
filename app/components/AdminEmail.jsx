"use client";
import { useEffect, useState } from 'react';
import { emailRequest } from './EmailVerification';
const labels={pending:'Chờ gửi',sending:'Đang gửi',sent:'Dịch vụ đã nhận',failed:'Gửi lỗi',skipped:'Đã bỏ qua'};
const kinds={booking:'Đặt vé',cancel:'Hủy vé',promotion:'Ưu đãi',birthday:'Sinh nhật',incident:'Sự cố'};
const when=value=>new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
const errors={email_not_configured:'Chưa cấu hình email',email_network_error:'Không kết nối được dịch vụ',email_provider_401:'API key không hợp lệ',email_provider_403:'Kiểm tra tên miền gửi và quyền API',email_provider_429:'Đang chờ hạn mức gửi',retry_window_expired:'Đã hết thời gian thử lại an toàn',recipient_or_event_changed:'Tài khoản, tùy chọn hoặc sự kiện đã thay đổi'};
export default function AdminEmail({data}) {
    const [status,setStatus]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState(false);
    const [draft,setDraft]=useState({showtimeId:'',subject:'Thông báo về suất chiếu',message:'',requestId:''});
    const load=async()=>setStatus(await emailRequest('/api/admin/email',undefined,'GET'));
    useEffect(()=>{load().catch(error=>setError(error.message));},[]);
    async function action(task){setBusy(true);setError('');setNotice('');try{await task();await load();}catch(error){setError(error.message);}finally{setBusy(false);}}
    const description=show=>`${data.movies.find(movie=>movie.id===show.movieId)?.title || 'Phim'} · ${when(show.startTime)} · ${data.rooms.find(room=>room.id===show.roomId)?.name || 'Phòng'}`;
    const shows=[...data.showtimes].sort((a,b)=>Date.parse(b.startTime)-Date.parse(a.startTime));
    return <section className="email-admin">
        {error&&<p className="mg-alert mg-alert-error" role="alert">{error}</p>}{notice&&<p className="mg-alert mg-alert-success" role="status">{notice}</p>}
        <section className="mg-card"><h2>Gửi thông báo qua email</h2><p>{status?.configured?'Dịch vụ email đã được cấu hình.':'Chưa sẵn sàng gửi email. Cấu hình Resend ở môi trường máy chủ.'}</p>{status?.missing?.length>0&&<p>Còn thiếu: <code>{status.missing.join(', ')}</code></p>}
            <p>Đặt/hủy vé được gửi tự động. Ưu đãi mới hoặc được bật gửi đến khách đã đồng ý; mỗi mã ưu đãi chỉ thông báo một lần cho mỗi khách. Lời chúc sinh nhật gửi từ 08:00 giờ Việt Nam.</p>
            <div className="email-admin-summary">{status?.counts.map(row=><span key={row.status}>{labels[row.status]}: <strong>{row.total}</strong></span>)}</div>
            <div className="mg-row-actions"><button className="mg-secondary" disabled={busy} onClick={()=>action(load)}>Tải lại</button><button className="mg-primary" disabled={busy||!status?.configured} onClick={()=>action(async()=>{const result=await emailRequest('/api/admin/email',{});setNotice(`Đã xử lý ${result.processed} email. Các email còn lại tiếp tục theo lịch.`);})}>Xử lý hàng đợi</button></div>
        </section>
        <section className="mg-card"><h2>Thông báo sự cố suất chiếu</h2><p>Gửi một email cho mỗi khách có vé còn hiệu lực và email đã xác minh. Thông báo này không tự sửa lịch hay hủy vé.</p>
            <form onSubmit={event=>{event.preventDefault();setDraft({...draft,requestId:draft.requestId||crypto.randomUUID()});setPreview(true);}}>
                <label className="mg-field">Suất chiếu<select required value={draft.showtimeId} disabled={busy||preview} onChange={e=>setDraft({...draft,showtimeId:e.target.value,requestId:''})}><option value="">Chọn suất chiếu</option>{shows.map(show=><option value={show.id} key={show.id}>{description(show)}</option>)}</select></label>
                <label className="mg-field">Tiêu đề<input required minLength={3} maxLength={150} disabled={busy||preview} value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value,requestId:''})}/></label>
                <label className="mg-field">Nội dung<textarea required minLength={10} maxLength={3000} disabled={busy||preview} value={draft.message} placeholder="Mô tả sự cố, hướng xử lý và cách khách liên hệ…" onChange={e=>setDraft({...draft,message:e.target.value,requestId:''})}/></label>
                {!preview&&<button className="mg-primary" disabled={busy||!status?.configured}>Xem trước thông báo</button>}
            </form>
            {preview&&<div><div className="email-admin-preview"><strong>{draft.subject}</strong><p>{shows.find(show=>show.id===draft.showtimeId)&&description(shows.find(show=>show.id===draft.showtimeId))}</p>{draft.message}</div><div className="mg-modal-actions"><button className="mg-secondary" disabled={busy} onClick={()=>setPreview(false)}>Chỉnh sửa</button><button className="mg-primary" disabled={busy} onClick={()=>action(async()=>{const result=await emailRequest('/api/admin/email/incidents',draft);setNotice(`Đã xếp ${result.queued} email sự cố vào hàng đợi.`);setPreview(false);setDraft({showtimeId:'',subject:'Thông báo về suất chiếu',message:'',requestId:''});})}>{busy?'Đang xử lý…':'Gửi thông báo cho khách'}</button></div></div>}
        </section>
        <section className="mg-card"><h2>50 email gần nhất</h2><p>“Dịch vụ đã nhận” nghĩa là Resend đã chấp nhận gửi; chưa khẳng định email vào hộp thư đến.</p><div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Loại / Thời gian</th><th>Người nhận</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{status?.recent.map(row=><tr key={row.id}><td>{kinds[row.kind]}<small>{when(row.created_at)}</small></td><td>{row.recipient}</td><td>{labels[row.status]}{row.last_error&&<small>{errors[row.last_error]||'Dịch vụ gửi email báo lỗi. Kiểm tra trong Resend.'}</small>}</td><td>{row.status==='failed'&&Date.now()-row.created_at<23*3600000&&<button className="mg-small-button" disabled={busy||!status?.configured} onClick={()=>action(()=>emailRequest('/api/admin/email',{retryId:row.id}))}>Thử lại</button>}</td></tr>)}</tbody></table>{!status?.recent.length&&<p>Chưa có email thông báo.</p>}</div></section>
    </section>;
}
