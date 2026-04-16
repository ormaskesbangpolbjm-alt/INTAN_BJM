// ==========================================
// FILE KONFIGURASI GLOBAL (config.js)
// !! JANGAN UPLOAD FILE INI KE GIT !!
// ==========================================

// --- Supabase ---
const supabaseUrl = 'https://lretyhprnslixkowrdcg.supabase.co';
const supabaseKey = 'sb_publishable_wRh_VwTQerGgWwSz3nooag_UczlP8sW';

// --- Google Gemini AI ---
const p1 = 'AQ.Ab8RN6';
const p2 = 'ICOwZmlBp4hj';
const p3 = 'D3YGfM9F344I-';
const p4 = 'tgSUKCkVn11_FVyK9Vw';
window.GEMINI_API_KEY = p1 + p2 + p3 + p4;

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
