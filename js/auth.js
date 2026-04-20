document.addEventListener('DOMContentLoaded', async function () {
    // Pastikan koneksi global Supabase ada dari config.js
    if (!window.supabaseClient) {
        console.error('Supabase Client tidak ditemukan. Pastikan config.js dimuat sebelum auth.js');
        return;
    }

    const { supabaseClient } = window;
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    /**
     * =========================================================
     * FITUR 1: PROTEKSI HALAMAN (Session Check)
     * =========================================================
     */
    async function checkSession() {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        const isLoginPage = window.location.pathname.includes('login.html');
        
        if (session && isLoginPage) {
            // Jika sudah login dan di halaman login, pindah ke admin
            window.location.href = 'admin.html';
        } else if (!session && !isLoginPage) {
            // Jika belum login dan mencoba akses admin, tendang ke login
            window.location.href = 'login.html';
        }
    }

    // Jalankan cek sesi segera
    checkSession();

    /**
     * =========================================================
     * FITUR 2: LOGIKA LOGIN
     * =========================================================
     */
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            // Reset UI
            errorMessage.classList.add('hidden');
            loginBtn.disabled = true;
            loginBtn.innerHTML = `
                <svg class="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>`;

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) throw error;

                // Success
                window.location.href = 'admin.html';
            } catch (err) {
                console.error('Login error:', err.message);
                errorMessage.classList.remove('hidden');
                errorText.innerText = err.message || 'Email atau password salah!';
                
                // Reset button
                loginBtn.disabled = false;
                loginBtn.innerText = 'Masuk Sekarang';
            }
        });
    }

    /**
     * =========================================================
     * FITUR 3: LOGIKA LOGOUT (Hanya di halaman admin)
     * =========================================================
     */
    window.handleLogout = async function () {
        const isConfirmed = await showConfirm('Anda yakin ingin keluar dari sistem?');
        if (!isConfirmed) return;
        
        try {
            await supabaseClient.auth.signOut();
            window.location.href = 'login.html';
        } catch (err) {
            await showToast('error', 'Gagal logout: ' + err.message);
        }
    };

});
