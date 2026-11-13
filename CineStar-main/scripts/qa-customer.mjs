import assert from 'node:assert/strict';
// Business suites provision isolated accounts via the existing local admin API.
// OTP behavior is tested separately with mocked delivery in test-email.mjs.
export async function createQaCustomer(base, options) {
    const origin=new URL(base);
    if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw new Error('QA provisioning requires a loopback server.');
    const body=options.body||options;
    if(!body.email?.endsWith('@cineverse.test')) throw new Error('QA accounts must use the reserved test domain.');
    async function post(path,data,cookie=''){
        const response=await fetch(new URL(path,origin),{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});
        return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
    }
    const admin=await post('/api/auth/login',{email:'admin@cineverse.vn',password:'Demo@123'});
    assert.equal(admin.status,200,'Local demo admin login');
    const created=await post('/api/admin/users',{name:body.name,email:body.email,password:body.password,birthDate:body.birthDate,role:'user'},admin.cookie);
    assert.equal(created.status,201,JSON.stringify(created.body));
    const login=await post('/api/auth/login',{email:body.email,password:body.password});
    assert.equal(login.status,200,'QA customer login');
    return login;
}
