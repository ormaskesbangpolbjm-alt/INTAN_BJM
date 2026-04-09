// ==========================================
// FILE KONFIGURASI SUPABASE GLOBAL (config.js)
// ==========================================

const supabaseUrl = 'https://lretyhprnslixkowrdcg.supabase.co';
const supabaseKey = 'sb_publishable_wRh_VwTQerGgWwSz3nooag_UczlP8sW';

// Inisialisasi client dengan pengecekan aman
try {
    if (typeof window.supabase !== 'undefined') {
        window.supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.info("Supabase Client (config.js): Berhasil diinisialisasi.");
    } else {
        console.error("Supabase Client (config.js): Library CDN Supabase belum dimuat di HTML!");
    }
} catch (error) {
    console.error("Supabase Client (config.js): Gagal membuat client.", error);
}
