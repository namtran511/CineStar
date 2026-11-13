import { getEnv } from './db';
import { CHARTS } from '../analytics-rules.js';
import { basicInsights, insightSnapshot, requestAnalyticsInsights } from '../analytics-insights.js';
const cache=new Map();
export async function analyzeReport(report,chart='all') {
    const keys=chart==='all'?Object.keys(CHARTS):[chart], env=getEnv(), key=env.GEMINI_API_KEY?.trim();
    if(!key)return {mode:'basic',message:'Chưa cấu hình Gemini. Đang hiển thị gợi ý cơ bản; số liệu vẫn lấy trực tiếp từ CSDL.',insights:basicInsights(report,keys)};
    const snapshot=insightSnapshot(report);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({snapshot,chart,model:env.GEMINI_MODEL}))))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const found=cache.get(hash);if(found&&found.expires>Date.now())return found.promise;
    const promise=(async()=>{try{return {mode:'gemini',message:'Nhận xét Gemini từ số liệu tổng hợp. Gợi ý cần được đối chiếu trước khi ra quyết định.',insights:await requestAnalyticsInsights(snapshot,keys,{key,model:env.GEMINI_MODEL||'gemini-2.5-flash'})};}catch{return {mode:'basic',message:'Gemini tạm không khả dụng hoặc phản hồi chưa hợp lệ. Đang hiển thị gợi ý cơ bản, không thay đổi số liệu.',insights:basicInsights(report,keys)};}})();
    if(cache.size>=30)cache.delete(cache.keys().next().value);cache.set(hash,{expires:Date.now()+300000,promise});return promise;
}
