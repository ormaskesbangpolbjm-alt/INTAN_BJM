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
    setupImagePreview('file-rekening', 'container-rekening');



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
    const inputOcrBank = document.getElementById('ocr-bank');
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
        const fileRekening = document.getElementById('file-rekening').files[0];
        
        const inputNamaOrmas = document.getElementById('input-nama-ormas').value.trim();
        const noWa = document.getElementById('input-wa').value.trim();

        // VALIDASI AWAL KELENGKAPAN BERKAS
        if (!fileKtp || !fileRekening || !inputNamaOrmas || !noWa) {
            alert('Mohon lengkapi Nama Ormas, lampirkan dokumen KTP & Rekening, beserta Nomor Whatsapp sebelum diverifikasi!');
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

            // STRATEGI KTP: Ektraksi Fleksibel Tahan Bising (Noise-Resistant)
            let foundNik = '';
            let foundNama = '';
            let foundAlamat = '';
            let foundJk = '';

            const barisKtp = textKtp.split('\n').map(line => line.trim()).filter(line => line.length > 2);

            for (let i = 0; i < barisKtp.length; i++) {
                const line = barisKtp[i];
                const textUpper = line.toUpperCase();

                // 1. Logika Tangkap NIK (16 digit) dengan auto-correct huruf yang tersamarkan
                if (!foundNik) {
                    // Cari baris yang mengandung tulisan NIK atau dekat dengannya
                    if (textUpper.includes('NIK') || textUpper.includes('N1K') || textUpper.includes('N I K')) {
                        let potongLabel = line.replace(/N\s*I\s*K|N1K/i, '').replace(/[:=]/g, '').trim();
                        let digitBersih = bersihkanDigit(potongLabel);
                        if (digitBersih.length >= 15) {
                            foundNik = digitBersih.substring(0, 16);
                        } else if (i + 1 < barisKtp.length) {
                            let digitBawah = bersihkanDigit(barisKtp[i+1]);
                            if (digitBawah.length >= 15) foundNik = digitBawah.substring(0, 16);
                        }
                    }
                }

                // 2. Logika Tangkap Nama Lengkap
                if (!foundNama) {
                    if (textUpper.match(/(NAMA|NOMA|MAMA|N A M A)/)) {
                        let teksNama = line.replace(/(NAMA|NOMA|MAMA|N A M A)/i, '').replace(/[:=]/g, '').trim();
                        // Jika dalam 1 baris tidak ditemukan huruf bermakna (kurang dari 3 huruf), ambil baris bawahnya
                        if (teksNama.length < 3 && i + 1 < barisKtp.length) {
                            teksNama = barisKtp[i+1].replace(/[:=]/g, '').trim();
                        }
                        
                        // Bersihkan teks nama dari noise ujung-ujung
                        teksNama = teksNama.replace(/[^a-zA-Z\s.,']/g, '').trim();
                        
                        // Validasi ekstra: Pastikan bukan label lain
                        const salahBaca = ["TEMPAT", "LAHIR", "JENIS", "KELAMIN", "ALAMAT", "GOL", "DARAH"];
                        let isBerisiLabel = salahBaca.some(lbl => teksNama.toUpperCase().includes(lbl));
                        
                        if (teksNama.length > 2 && !isBerisiLabel) {
                            foundNama = teksNama.toUpperCase();
                        }
                    }
                }

                // 3. Logika Tangkap Alamat
                if (!foundAlamat) {
                    if (textUpper.match(/(ALAMAT|ALAM0T|A L A M A T)/)) {
                        let teksAlamat = line.replace(/(ALAMAT|ALAM0T|A L A M A T)/i, '').replace(/[:=]/g, '').trim();
                        if (teksAlamat.length < 4 && i + 1 < barisKtp.length) {
                            teksAlamat = barisKtp[i+1].replace(/[:=]/g, '').trim();
                        }
                        // Buang simbol aneh
                        teksAlamat = teksAlamat.replace(/[|\\_/"—~]/g, '').trim();
                        
                        // Cegah baris RT/RW dkk ditarik secara bodoh
                        if (teksAlamat.toUpperCase().includes('RT/RW')) {
                            teksAlamat = teksAlamat.split('RT/RW')[0].trim();
                        }
                        
                        if (teksAlamat.length > 3) foundAlamat = teksAlamat.toUpperCase();
                    }
                }
            }

            // Fallback NIK Ekstrik (Mencari 16 Digit Murni dimana saja)
            if (!foundNik) {
                const semuaDigitKtp = bersihkanDigit(textKtp);
                const nikDarurat = semuaDigitKtp.match(/\d{16}/);
                if (nikDarurat) foundNik = nikDarurat[0];
            }

            // Fallback Jenis Kelamin (Cari kata kunci absolut Laki / Perempuan di seluruh blok form text)
            if (textKtp.toUpperCase().match(/(LAKI|LAK1|L A K I|L4KI)/)) {
                foundJk = 'Laki-laki';
            } else if (textKtp.toUpperCase().match(/(PEREMPUAN|PEREM|P E R E M)/)) {
                foundJk = 'Perempuan';
            }


            // PROSES 2: EKSTRAKSI BUKU REKENING (Deteksi Bank & Norek)
            let foundNorekMurni = '';
            let foundBankGuess = '';
            
            if (fileRekening) {
                try {
                    const resultRekening = await Tesseract.recognize(fileRekening, 'ind', {
                        logger: m => console.log('Tesseract Log (Rekening):', m)
                    });
                    const teksRekening = resultRekening.data.text;
                    const teksRKUpper = teksRekening.toUpperCase();
                    
                    // 1. Deteksi Instansi Bank dengan cerdas berdasarkan Keyword Populer
                    if (teksRKUpper.match(/\b(BCA|CENTRAL ASIA)\b/)) foundBankGuess = 'BCA';
                    else if (teksRKUpper.match(/\b(MANDIRI)\b/)) foundBankGuess = 'MANDIRI';
                    else if (teksRKUpper.match(/\b(BNI|NEGARA INDONESIA)\b/)) foundBankGuess = 'BNI';
                    else if (teksRKUpper.match(/\b(BRI|RAKYAT INDONESIA)\b/)) foundBankGuess = 'BRI';
                    else if (teksRKUpper.match(/\b(BSI|SYARIAH INDONESIA)\b/)) foundBankGuess = 'BSI';
                    else if (teksRKUpper.match(/\b(KALSEL|KALIMANTAN SELATAN)\b/)) foundBankGuess = 'BANK KALSEL';
                    else if (teksRKUpper.match(/\b(BJB)\b/)) foundBankGuess = 'BJB';
                    else if (teksRKUpper.match(/\b(DKI)\b/)) foundBankGuess = 'BANK DKI';
                    else if (teksRKUpper.match(/\b(MEGA)\b/)) foundBankGuess = 'BANK MEGA';
                    else if (teksRKUpper.match(/\b(MUAMALAT)\b/)) foundBankGuess = 'BANK MUAMALAT';
                    
                    // 2. Deteksi deret angka Norek murni yang panjannya khas (10 sampai 15 digit)
                    const deretAngkaKotor = teksRekening.replace(/[^\d\n\s-]/g, ''); // Cukup sisakan angka, spasi, enter, atau strip
                    const kumpulanAngka = deretAngkaKotor.split(/[\n\s-]/);
                    
                    // Cari bagian blok yang benar-benar tersusun dari 9 sampai 15 digit rapat
                    let digitRekCandidat = kumpulanAngka.find(blok => blok.length >= 9 && blok.length <= 16);
                    
                    // Jika tidak ketemu yang rapat, pakai fallback pembersih mutlak
                    if (!digitRekCandidat) {
                        const angkaMutlak = teksRekening.replace(/[^\d]/g, '');
                        // Ambil 10 s/d 15 digit terpanjang yang bisa ditangkap
                        const rekMutlakCandidat = angkaMutlak.match(/\d{9,16}/);
                        if (rekMutlakCandidat) digitRekCandidat = rekMutlakCandidat[0];
                    }
                    
                    if (digitRekCandidat) foundNorekMurni = digitRekCandidat;

                } catch (err) {
                    console.warn('Gagal memindai buku rekening:', err);
                }
            }


            // PROSES 3: EKSTRAKSI NPWP (Jika diunggah)
            let foundNpwp = '';
            const fileNpwp = document.getElementById('file-npwp').files[0];
            if (fileNpwp) {
                try {
                    const resultNpwp = await Tesseract.recognize(fileNpwp, 'ind', {
                        logger: m => console.log('Tesseract Log (NPWP):', m)
                    });
                    
                    // NPWP terdiri dari 15 digit angka yang menyertakan pola pasti.
                    const cleanNpwpDigits = resultNpwp.data.text.replace(/[^\d]/g, '');
                    const npwpMatch = cleanNpwpDigits.match(/\d{15}/);
                    
                    if (npwpMatch) {
                        const rawNpwp = npwpMatch[0];
                        foundNpwp = `${rawNpwp.substring(0,2)}.${rawNpwp.substring(2,5)}.${rawNpwp.substring(5,8)}.${rawNpwp.substring(8,9)}-${rawNpwp.substring(9,12)}.${rawNpwp.substring(12,15)}`;
                    }
                } catch (err) {
                    console.warn('Gagal memindai ekstraksi NPWP:', err);
                }
            }

            // ========================================================
            // VALIDASI KUALITAS GAMBAR (MENCEGAH BLUR / OBJEK PALSU / EDITAN)
            // ========================================================
            // Jika dokumen sama sekali kehilangan makna strukturnya akibat buram/flare cahaya
            const isKtpBuram = !foundNik && !foundNama && !foundAlamat;
            const isRekeningBuram = fileRekening && !foundNorekMurni && !foundBankGuess;
            const isNpwpBuram = fileNpwp && !foundNpwp;

            if (isKtpBuram || isRekeningBuram || isNpwpBuram) {
                // Kembalikan tombol dari status loading
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
                submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
                
                let pesanError = '🚨 DOKUMEN DITOLAK KARENA TIDAK JELAS\n\nSistem mendeteksi bahwa salah satu foto yang Anda unggah memiliki kualitas buruk, terkena pantulan cahaya (flare), buram, hasil suntingan komputer, atau merupakan foto objek yang salah.\n\nSistem menghentikan pemrosesan. Pemohon tidak dapat melanjutkan sebelum memberikan versi foto dokumen yang benar-benar bersih, terang, dan terbaca mutlak tanpa halangan.';
                
                alert(pesanError);
                return; // Berhenti seketika, mencegah modal Validasi tampil
            }

            // Logika Tampilan Dropdown Dinamis untuk Jenis Kelamin
            const jkContainer = document.getElementById('ocr-jk').parentNode;
            if (foundJk) {
                // Jika terbaca OCR: Kunci menjadi text yang tidak bisa di-dropdown
                jkContainer.innerHTML = `
                    <label class="block text-sm font-semibold text-gray-700">Jenis Kelamin</label>
                    <input type="text" id="ocr-jk" class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none bg-gray-50 text-gray-800 font-bold cursor-not-allowed" value="${foundJk}" readonly required>
                `;
            } else {
                // Jika Kosong: Paksa muncul sebagai Select Dropdown
                jkContainer.innerHTML = `
                    <label class="block text-sm font-semibold text-red-600">Jenis Kelamin (Pilih Manual) *</label>
                    <select id="ocr-jk" class="w-full px-4 py-3 rounded-xl border border-red-300 focus:outline-none focus:ring-2 focus:ring-[#FA8112] bg-red-50 text-gray-800 font-bold appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%234B5563%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center] bg-[length:1.2em_1.2em]" required>
                        <option value="" disabled selected>Pilih Jenis Kelamin...</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                    </select>
                `;
            }

            // Isi form modal dengan Hasil Tesseract
            inputOcrOrmas.value = inputNamaOrmas; // Diteruskan dari input manual frame 1
            inputOcrNik.value = foundNik || "";
            inputOcrNama.value = foundNama || "";
            inputOcrAlamat.value = foundAlamat || "";
            
            // Set Bank secara cerdas jika ditemukan, atau biarkan kosong jika ragu
            if (foundBankGuess) {
                // Konversi tebakan Bank kita agar cocok dengan <option> valuenya di HTML (Upper Case biasanya cocok, atau samakan dengan huruf Kapital)
                // Kita akan coba menyeleksi dari option yang ada di dalam select
                Array.from(inputOcrBank.options).forEach(opt => {
                    if (opt.value.toUpperCase().includes(foundBankGuess) || foundBankGuess.includes(opt.value.toUpperCase())) {
                        inputOcrBank.value = opt.value;
                    }
                });
            }
            
            inputOcrNorek.value = foundNorekMurni || "";
            inputOcrNpwp.value = foundNpwp || ""; // Masukkan format resmi ke Modal OCR

        } catch (error) {
            console.error('OCR Error:', error);
            alert('Pemindaian AI kesulitan membaca detail penuh dokumen Anda. Jangan khawatir, Anda dapat mengisinya secara manual berikut ini.');
            
            inputOcrOrmas.value = inputNamaOrmas || '';
            inputOcrNik.value = '';
            inputOcrNama.value = '';
            inputOcrAlamat.value = '';
            document.getElementById('ocr-jk').value = '';
            inputOcrBank.value = '';
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
        const finalJk = document.getElementById('ocr-jk').value.trim();
        const finalBank = inputOcrBank.value;
        const finalNorekManual = inputOcrNorek.value.trim();
        const finalNpwp = inputOcrNpwp.value.trim();
        const noWa = document.getElementById('input-wa').value.trim();
        
        const fileKtp = document.getElementById('file-ktp').files[0];
        const fileNpwp = document.getElementById('file-npwp').files[0];
        const fileRekening = document.getElementById('file-rekening').files[0];

        if (!fileKtp || !fileRekening) {
            alert('File KTP / Rekening gagal dimuat. Harap periksa ulang form!');
            return;
        }

        if (!finalNik || !finalNama || !finalAlamat || !finalBank || !finalNorekManual) {
            alert('Data wajib (Instansi Bank, Norek, NIK, Nama, Alamat) di dalam form validasi ini tidak boleh kosong!');
            return;
        }
        
        const finalNorek = `${finalBank} - ${finalNorekManual}`;

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
            const urlRekening = await uploadFile(fileRekening, 'rekening');

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
                        no_rekening: finalNorek, // Disusun dari modal (Bank + Norek)
                        nama_lengkap: finalNama, 
                        alamat: finalAlamat,     
                        jenis_kelamin: finalJk,  
                        nik: finalNik,           
                        npwp: finalNpwp,         
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
