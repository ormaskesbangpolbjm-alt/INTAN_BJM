document.addEventListener('DOMContentLoaded', function() {
    
    // ==========================================
    // FITUR 1: LOGIKA PRATINJAU (PREVIEW) GAMBAR
    // ==========================================
    
    function setupImagePreview(inputId, containerId) {
        const fileInput = document.getElementById(inputId);
        const container = document.getElementById(containerId);

        if (!fileInput || !container) return;

        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];

            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();

                reader.onload = function(e) {
                    const svgIcon = container.querySelector('svg');
                    const spanText = container.querySelector('span');
                    if (svgIcon) svgIcon.classList.add('hidden');
                    if (spanText) spanText.classList.add('hidden');

                    let previewImg = container.querySelector('.preview-img-element');
                    
                    if (!previewImg) {
                        previewImg = document.createElement('img');
                        previewImg.className = 'preview-img-element absolute inset-0 w-full h-full object-cover rounded-md z-0 pointer-events-none';
                        container.appendChild(previewImg);
                        fileInput.classList.add('z-10'); 
                    }

                    previewImg.src = e.target.result;
                    container.classList.remove('border-dashed');
                    container.classList.add('border-solid', 'border-[#FA8112]');
                };

                reader.onerror = function() {
                    alert('Gagal membaca preview gambar dari perangkat Anda.');
                };

                reader.readAsDataURL(file);
            }
        });
    }

    setupImagePreview('file-ktp', 'container-ktp');
    setupImagePreview('file-npwp', 'container-npwp');
    // setupImagePreview untuk Rekening ditiadakan karena beralih ke input manual



    // ===============================================
    // FITUR 2: SIMULASI PENGGUNAAN OCR & VALIDASI MODAL
    // ===============================================

    const form = document.getElementById('pendataan-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText || 'Kirim Data';

    // Elemen DOM untuk Modal Validasi
    const modalOcr = document.getElementById('modal-ocr');
    const btnCancelOcr = document.getElementById('btn-cancel-ocr');
    const btnConfirmOcr = document.getElementById('btn-confirm-ocr');
    
    const inputOcrOrmas = document.getElementById('ocr-nama-ormas');
    const inputOcrNik = document.getElementById('ocr-nik');
    const inputOcrNama = document.getElementById('ocr-nama');
    const inputOcrAlamat = document.getElementById('ocr-alamat');
    const inputOcrJk = document.getElementById('ocr-jk');
    const inputOcrNorek = document.getElementById('ocr-norek');
    const inputOcrNpwp = document.getElementById('ocr-npwp');

    /**
     * Helper mereset kotak dropzone kembali seperti HTML awal
     */
    function resetPreviewContainer(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const previewImg = container.querySelector('.preview-img-element');
        if (previewImg) previewImg.remove();
        
        const svgIcon = container.querySelector('svg');
        const spanText = container.querySelector('span');
        if (svgIcon) svgIcon.classList.remove('hidden');
        if (spanText) spanText.classList.remove('hidden');
        
        container.classList.add('border-dashed');
        container.classList.remove('border-solid', 'border-[#FA8112]');
        
        const fileInput = document.getElementById(containerId.replace('container-', 'file-'));
        if (fileInput) fileInput.value = '';
    }

    // TAHAP 1: Mencegat pengiriman Form untuk memicu AI Pemindaian (Scan OCR)
    form.addEventListener('submit', async function(e) {
        e.preventDefault(); 
        
        if (!window.supabaseClient) {
            alert('Sistem belum terhubung ke Supabase. Periksa file config.js Anda.');
            return;
        }
        
        const fileKtp = document.getElementById('file-ktp').files[0];
        
        const inputNamaOrmas = document.getElementById('input-nama-ormas').value.trim();
        const inputBank = document.getElementById('input-bank').value;
        const inputNorekManual = document.getElementById('input-norek-manual').value.trim();
        const noWa = document.getElementById('input-wa').value.trim();

        // VALIDASI AWAL KELENGKAPAN BERKAS
        if (!fileKtp || !inputNamaOrmas || !inputBank || !inputNorekManual || !noWa) {
            alert('Mohon lengkapi Nama Ormas, dokumen KTP, Instansi Bank, Rekening, dan Nomor Whatsapp sebelum diverifikasi!');
            return;
        }

        // VALIDASI KETAT POLA NOMOR HP INDONESIA DI HALAMAN AWAL
        const waRegex = /^(08|\+628)\d{8,11}$/;
        if(!waRegex.test(noWa)) {
            alert('Nomor WhatsApp tidak valid! Pastikan diawali 08 atau +628 dengan kepanjangan 10-13 digit angka.');
            return;
        }

        if (typeof Tesseract === 'undefined') {
            alert('Library Tesseract AI belum siap. Pastikan koneksi internet stabil.');
            return;
        }

        // LOADING STATE: Mengunci Form sebagai ilustrasi sedang memproses AI OCR
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Memindai AI (Tunggu Sebentar)...
        `;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

        try {
            // PROSES 1: EKSTRAKSI KTP
            // Catatan: Model 'ind' (Indonesia), mengunduh worker pertama kali membutuhkan sedikit waktu ~3MB cache.
            const resultKtp = await Tesseract.recognize(fileKtp, 'ind', {
                logger: m => console.log('Tesseract Log (KTP):', m)
            });
            const textKtp = resultKtp.data.text;
            console.log('=== RAW OCR TEXT (KTP) ===\n', textKtp);
            
            // Fungsi pembantu: Bersihkan karakter OCR yang salah baca menjadi angka murni
            const bersihkanDigit = (str) => {
                return str
                    .replace(/[Oo]/g, '0')  // O sering salah baca jadi 0
                    .replace(/[IiLl|]/g, '1') // I/l sering salah baca jadi 1
                    .replace(/[Ss]/g, '5')  // S sering salah baca jadi 5
                    .replace(/[Bb]/g, '8')  // B sering salah baca jadi 8
                    .replace(/[^0-9]/g, ''); // Buang semua selain angka
            };

            // STRATEGI NIK: Multi-layer detection
            let foundNik = '';

            // Strategi 1: Cari baris dengan keyword "NIK" lalu ambil digit di sekitarnya
            for (let i = 0; i < textKtp.split('\n').length; i++) {
                const line = textKtp.split('\n')[i];
                if (line.toUpperCase().includes('NIK')) {
                    // Ambil digit dari baris ini sendiri
                    let digitLine = bersihkanDigit(line.replace(/NIK/i, '').replace(/[:=]/g, ''));
                    if (digitLine.length >= 16) {
                        foundNik = digitLine.substring(0, 16);
                        break;
                    }
                    // Jika tidak cukup, cek baris berikutnya
                    if (i + 1 < textKtp.split('\n').length) {
                        digitLine = bersihkanDigit(textKtp.split('\n')[i + 1]);
                        if (digitLine.length >= 16) {
                            foundNik = digitLine.substring(0, 16);
                            break;
                        }
                    }
                }
            }

            // Strategi 2: Fallback - cari 16 digit berurutan dari seluruh teks (strip semua non-digit)
            if (!foundNik) {
                const allDigits = bersihkanDigit(textKtp);
                const nikFallback = allDigits.match(/\d{16}/);
                if (nikFallback) foundNik = nikFallback[0];
            }

            // Strategi 3: Fallback terakhir - cari per baris, baris mana yang punya >=14 digit
            if (!foundNik) {
                const allLines = textKtp.split('\n');
                for (const line of allLines) {
                    const digits = bersihkanDigit(line);
                    if (digits.length >= 14 && digits.length <= 18) {
                        foundNik = digits.substring(0, 16);
                        break;
                    }
                }
            }
            
            // Heuristik Sederhana cari Nama Lengkap & Alamat
            let foundNama = '';
            let foundAlamat = '';
            const lines = textKtp.split('\n');
            for (let i = 0; i < lines.length; i++) {
                // Heuristik Nama
                if (lines[i].toUpperCase().includes('NAMA')) {
                    const parts = lines[i].split(/NAMA|Nama/i);
                    let rawName = '';

                    if (parts.length > 1 && parts[1].replace(/[:=]/g, '').trim().length > 3) {
                        rawName = parts[1].replace(/[:=]/g, '').trim();
                    } else if (i + 1 < lines.length) {
                        rawName = lines[i+1].replace(/[:=]/g, '').trim();
                    }

                    // CLEANUP: Bersihkan dari noise OCR umum
                    if (rawName) {
                        // 1. Potong jika ada label lain yang terbaca di baris yang sama
                        const commonLabels = ["NIK", "JENIS KELAMIN", "ALAMAT", "TEMPAT", "GOL. DARAH"];
                        commonLabels.forEach(lbl => {
                            const lblIdx = rawName.toUpperCase().indexOf(lbl);
                            if (lblIdx !== -1) rawName = rawName.substring(0, lblIdx);
                        });

                        // 2. Buang satu huruf sisa di akhir (seperti " p" atau " l") yang biasanya noise OCR
                        rawName = rawName.replace(/\s[a-zA-Z]$/, '').trim();

                        // 3. Konversi ke Uppercase agar konsisten dengan KTP
                        foundNama = rawName.toUpperCase();
                    }
                }
                
                // Heuristik Alamat
                if (lines[i].toUpperCase().includes('ALAMAT')) {
                    const parts = lines[i].split(/ALAMAT|Alamat/i);
                    let rawAlamat = '';

                    if (parts.length > 1 && parts[1].replace(/[:=]/g, '').trim().length > 3) {
                        rawAlamat = parts[1].replace(/[:=]/g, '').trim();
                    } else if (i + 1 < lines.length) {
                        rawAlamat = lines[i+1].replace(/[:=]/g, '').trim();
                    }

                    // CLEANUP: Bersihkan dari noise OCR umum pada bagian alamat
                    if (rawAlamat) {
                        // 1. Buang simbol sampah di akhir/awal baris (|, -, _, —, dll)
                        rawAlamat = rawAlamat.replace(/[|\\/_—\-\s]+$/, '').trim(); 
                        
                        // 2. Potong jika ada label baris berikutnya yang menyatu
                        const subLabels = ["RT/RW", "KEL/DESA", "KECAMATAN", "AGAMA", "STATUS"];
                        subLabels.forEach(lbl => {
                            const lblIdx = rawAlamat.toUpperCase().indexOf(lbl);
                            if (lblIdx !== -1) rawAlamat = rawAlamat.substring(0, lblIdx);
                        });

                        foundAlamat = rawAlamat.toUpperCase();
                    }
                }
            }

            // Heuristik Jenis Kelamin
            let foundJk = '';
            for (let i = 0; i < lines.length; i++) {
                const lineUpper = lines[i].toUpperCase();
                if (lineUpper.includes('JENIS KELAMIN') || lineUpper.includes('KELAMIN')) {
                    if (lineUpper.includes('LAKI')) {
                        foundJk = 'Laki-laki';
                        break;
                    } else if (lineUpper.includes('PEREMPUAN')) {
                        foundJk = 'Perempuan';
                        break;
                    }
                }
            }

            // PROSES 2: PEREKAMAN INPUT REKENING MANUAL (TANPA OCR)
            let foundRekening = `${inputBank} - ${inputNorekManual}`;

            // PROSES 3: EKSTRAKSI NPWP (Jika diunggah)
            let foundNpwp = '';
            const fileNpwp = document.getElementById('file-npwp').files[0];
            if (fileNpwp) {
                try {
                    const resultNpwp = await Tesseract.recognize(fileNpwp, 'ind', {
                        logger: m => console.log('Tesseract Log (NPWP):', m)
                    });
                    
                    // NPWP terdiri dari 15 digit angka. Angka non-digit akan dibersihkan dulu lalu dicari 15 deret
                    const cleanNpwpDigits = resultNpwp.data.text.replace(/[^\d]/g, '');
                    const npwpMatch = cleanNpwpDigits.match(/\d{15}/);
                    
                    if (npwpMatch) {
                        const rawNpwp = npwpMatch[0];
                        // Susun pola wajib: 99.999.999.9-999.999
                        foundNpwp = `${rawNpwp.substring(0,2)}.${rawNpwp.substring(2,5)}.${rawNpwp.substring(5,8)}.${rawNpwp.substring(8,9)}-${rawNpwp.substring(9,12)}.${rawNpwp.substring(12,15)}`;
                    }
                } catch (err) {
                    console.warn('Gagal memindai ekstraksi NPWP:', err);
                }
            }

            // Isi form modal dengan Hasil Tesseract
            inputOcrOrmas.value = inputNamaOrmas; // Diteruskan dari input manual frame 1
            inputOcrNik.value = foundNik;
            inputOcrNama.value = foundNama;
            inputOcrAlamat.value = foundAlamat;
            inputOcrJk.value = foundJk;
            inputOcrNorek.value = foundRekening;
            inputOcrNpwp.value = foundNpwp; // Masukkan format resmi ke Modal OCR

        } catch (error) {
            console.error('OCR Error:', error);
            alert('Pemindaian AI kesulitan membaca detail penuh dokumen Anda. Jangan khawatir, Anda dapat mengisinya secara manual berikut ini.');
            
            inputOcrOrmas.value = inputNamaOrmas || '';
            inputOcrNik.value = '';
            inputOcrNama.value = '';
            inputOcrAlamat.value = '';
            inputOcrJk.value = '';
            inputOcrNorek.value = '';
            inputOcrNpwp.value = ''; // Kosongkan
        }

        // Tampilkan Modal Validasi bagaimanapun hasilnya
        modalOcr.classList.remove('opacity-0', 'pointer-events-none');
    });

    // Pilihan aksi Batal: Menutup Modal Validasi
    btnCancelOcr.addEventListener('click', function() {
        modalOcr.classList.add('opacity-0', 'pointer-events-none');
        // Kembalikan tombol statis utama
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    });


    // ===============================================
    // FITUR 3: FINALISASI UPLOAD DATABASE
    // ===============================================

    async function uploadFile(file, prefix) {
        if (!file) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${prefix}-${Date.now()}.${fileExt}`;
            const { data, error } = await window.supabaseClient.storage
                .from('dokumen_ormas')
                .upload(fileName, file);

            if (error) throw error; 

            const { data: publicData } = window.supabaseClient.storage
                .from('dokumen_ormas')
                .getPublicUrl(fileName);
            return publicData.publicUrl;
        } catch (error) {
            error.message = `Gagal mengunggah foto ${prefix}. Detail: ` + error.message;
            throw error;
        }
    }

    // TAHAP 2: Jika Data di Modal Telah Konfirmasi, Kirim ke Database 
    btnConfirmOcr.addEventListener('click', async function() {
        const finalNamaOrmas = inputOcrOrmas.value.trim();
        const finalNik = inputOcrNik.value.trim();
        const finalNama = inputOcrNama.value.trim();
        const finalAlamat = inputOcrAlamat.value.trim();
        const finalJk = inputOcrJk.value.trim();
        const finalNorek = inputOcrNorek.value.trim();
        const finalNpwp = inputOcrNpwp.value.trim();
        const noWa = document.getElementById('input-wa').value.trim();
        
        const fileKtp = document.getElementById('file-ktp').files[0];
        const fileNpwp = document.getElementById('file-npwp').files[0];

        if (!fileKtp) {
            alert('File KTP gagal dimuat. Harap unggah ulang file KTP Anda!');
            return;
        }

        if (!finalNik || !finalNama || !finalAlamat || !finalNorek) {
            alert('Data wajib (NIK, Nama, Alamat, Rekening) hasil pindaian tidak boleh kosong!');
            return;
        }

        // Validasi Ekstra untuk NPWP sesuai pola (15 digit yang di format)
        const npwpRegex = /^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/;
        if (finalNpwp !== '' && !npwpRegex.test(finalNpwp)) {
            alert('Format NPWP pada modifikasi Anda tidak benar! Harus berupa pola: 99.999.999.9-999.999');
            return;
        }

        // Terapkan Loading UI pada tombol Modal
        const originalConfirmText = btnConfirmOcr.innerText;
        btnConfirmOcr.disabled = true;
        btnConfirmOcr.innerText = "Menyinkronisasi...";

        try {
            // PROSES 0: MENCEGAH DUPLIKASI BERANGKAT DARI NIK
            btnConfirmOcr.innerText = "Memeriksa Riwayat...";
            const { data: riwayatSama, error: errCek } = await window.supabaseClient
                .from('pendaftar_ormas')
                .select('id, status')
                .eq('nik', finalNik)
                .limit(1);
            
            if (errCek) throw new Error('Gagal memastikan riwayat pendaftaran Anda: ' + errCek.message);

            if (riwayatSama && riwayatSama.length > 0) {
                const statusRiwayat = riwayatSama[0].status === 'Valid' ? 'Telah DISAHKAN' : 'Sedang MENUNGGU ANTRETAN VALIDASI';
                alert(`⚠️ PERMOHONAN DITOLAK (DATA GANDA)\n\nSistem kami mengidentifikasi NIK Anda (${finalNik}) sudah terdaftar kok!\nStatus Berkas Anda Saat Ini: ${statusRiwayat}.\n\nAnda tidak perlu repot-repot mengirim pendaftaran ini berulang kali. Silakan pantau informasi selanjutnya dari pihak Kesbangpol.`);
                return; // Membatalkan unggahan
            }

            // PROSES 1: UPLOAD MENGGUNAKAN supabase.storage.from() secara async
            btnConfirmOcr.innerText = "Mengamankan Dokumen...";
            const urlKtp = await uploadFile(fileKtp, 'ktp');
            const urlNpwp = fileNpwp ? await uploadFile(fileNpwp, 'npwp') : null;
            const urlRekening = null; // Rekening kini cuma data string, tak ada foto fisik yang harus diedarkan

            // Pastikan WA terstandar format internasional agar tombol admin bekerja
            let formatWa = noWa;
            if (formatWa.startsWith('0')) formatWa = '62' + formatWa.substring(1);
            if (formatWa.startsWith('+62')) formatWa = '62' + formatWa.substring(3);

            // PROSES 2: SIMPAN DATABASE MENGGUNAKAN supabase.from()
            const { data, error } = await window.supabaseClient
                .from('pendaftar_ormas')
                .insert([
                    { 
                        nama_ormas: finalNamaOrmas,
                        no_wa: formatWa, 
                        no_rekening: finalNorek, // Divalidasi otomatis saat OCR
                        nama_lengkap: finalNama, // Disuplai oleh OCR Modal
                        alamat: finalAlamat,     // Disuplai oleh OCR Modal
                        jenis_kelamin: finalJk,  // Laki-laki / Perempuan
                        nik: finalNik,           // Disuplai oleh OCR Modal
                        npwp: finalNpwp,         // Pola format 99.999.999.9-999.999
                        foto_ktp_url: urlKtp, 
                        foto_npwp_url: urlNpwp, 
                        foto_rekening_url: urlRekening 
                    }
                ]);

            if (error) {
                if (error.code === '42501') throw new Error('Akses RLS ditolak.');
                throw error;
            }

            // HASIL PENYELESAIAN (SUKSES)
            alert('Berkas berhasil divalidasi dan dikirim!');
            
            // Tutup jandaela Modal
            modalOcr.classList.add('opacity-0', 'pointer-events-none');
            
            // Bersihkan Form Muka
            form.reset();
            resetPreviewContainer('container-ktp');
            resetPreviewContainer('container-npwp');
            resetPreviewContainer('container-rekening');

        } catch (error) {
            console.error('Proses Pengiriman Terhenti:', error);
            alert('Gagal mensubmit data: ' + error.message);
        } finally {
            // Kembalikan kedua jenis UI Button
            btnConfirmOcr.disabled = false;
            btnConfirmOcr.innerText = originalConfirmText;
            
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    });

});
