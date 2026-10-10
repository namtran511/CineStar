export function accountAllowed(env, id) {
    return env.APP_ENV !== 'production' || !['admin-demo', 'staff-demo', 'user-demo'].includes(id);
}
export function seedAccounts(env) {
    if (env.APP_ENV !== 'production') return {
        password: 'Demo@123',
        accounts: [
            ['admin-demo', 'Quản trị CineStar', 'admin@cineverse.vn', 'admin'],
            ['staff-demo', 'Minh Anh', 'staff@cineverse.vn', 'staff'],
            ['user-demo', 'Khách CineStar', 'user@cineverse.vn', 'user'],
        ],
    };
    const email = String(env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
    const password = String(env.INITIAL_ADMIN_PASSWORD || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 16 || password.length > 128 || password !== password.trim()) {
        throw new Error('Configure INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (16–128 characters) in Worker secrets before initializing the production database.');
    }
    return { password, accounts: [['admin-production', 'Quản trị CineStar', email, 'admin']] };
}
