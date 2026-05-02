document.addEventListener('DOMContentLoaded', function () {

    // ==========================================
    // FITUR 1: LOGIKA PRATINJAU (PREVIEW) GAMBAR
    // ==========================================

    function setupImagePreview(inputId, containerId) {
        const fileInput = document.getElementById(inputId);
        const container = document.getElementById(containerId);
        if (!fileInput || !container) return;

        fileInput.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function (e) {
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
                reader.onerror = async function () { await showToast('error', 'Gagal membaca preview gambar.'); };
                reader.readAsDataURL(file);
            }
        });
    }

    setupImagePreview('file-ktp', 'container-ktp');
    setupImagePreview('file-npwp', 'container-npwp');
    setupImagePreview('file-rekening', 'container-rekening');


    // ===============================================
    // FITUR 2: AI GEMINI - PEMBACAAN DOKUMEN CERDAS
    // ===============================================

    const form = document.getElementById('pendataan-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText || 'Kirim Data';

    const modalOcr = document.getElementById('modal-ocr');
    const btnCancelOcr = document.getElementById('btn-cancel-ocr');
    const btnConfirmOcr = document.getElementById('btn-confirm-ocr');

    const inputOcrOrmas = document.getElementById('ocr-nama-ormas');
    const inputOcrNik = document.getElementById('ocr-nik');
    const inputOcrNama = document.getElementById('ocr-nama');
    const inputOcrAlamat = document.getElementById('ocr-alamat');
    const inputOcrNorek = document.getElementById('ocr-norek');
    const inputOcrNpwp = document.getElementById('ocr-npwp');
    const inputBankDepan = document.getElementById('input-bank');

    // ==========================================
    // KONFIGURASI LOCAL OCR BACKEND (FastAPI - Chandra)
    // Backend harus dijalankan di sisi localhost (e.g., port 8080)
    // ==========================================

    /**
     * Reset dropzone ke tampilan awal
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

    /**
     * Baca orientasi EXIF dari binary data (byte 0-65535 saja sudah cukup)
     * Mengembalikan nilai orientasi 1-8 (1 = normal)
     */
    function getExifOrientation(buffer) {
        const view = new DataView(buffer);
        if (view.getUint16(0, false) !== 0xFFD8) return 1; // Bukan JPEG
        let offset = 2;
        while (offset < view.byteLength) {
            const marker = view.getUint16(offset, false);
            offset += 2;
            if (marker === 0xFFE1) { // APP1 marker (EXIF)
                if (view.getUint32(offset += 2, false) !== 0x45786966) return 1;
                const little = view.getUint16(offset += 6, false) === 0x4949;
                offset += view.getUint32(offset + 4, little);
                const tags = view.getUint16(offset, little);
                offset += 2;
                for (let i = 0; i < tags; i++) {
                    if (view.getUint16(offset + (i * 12), little) === 0x0112) {
                        return view.getUint16(offset + (i * 12) + 8, little);
                    }
                }
            } else if ((marker & 0xFF00) !== 0xFF00) break;
            else offset += view.getUint16(offset, false);
        }
        return 1;
    }

    /**
     * Resize + Koreksi Rotasi EXIF gambar sebelum dikirim ke Gemini.
     * Penting untuk foto dari kamera HP yang sering tersimpan miring/terbalik.
     */
    const resizeForGemini = (file) => new Promise((resolve) => {
        if (!file) return resolve(null);

        // Baca sebagian kecil file untuk mendeteksi orientasi EXIF
        const sliceReader = new FileReader();
        sliceReader.onload = (sliceEvt) => {
            const orientation = getExifOrientation(sliceEvt.target.result);

            const fullReader = new FileReader();
            fullReader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Tentukan dimensi output (putar jika orientasi >= 5)
                    const MAX = 1024; // Lebih kecil dari 1280 agar lebih cepat dikirim
                    let sw = img.width, sh = img.height;
                    const needRotate = orientation >= 5 && orientation <= 8;
                    let tw = needRotate ? sh : sw;
                    let th = needRotate ? sw : sh;

                    // Scale down ke MAX
                    if (tw > MAX) { th = Math.round(th * MAX / tw); tw = MAX; }
                    if (th > MAX) { tw = Math.round(tw * MAX / th); th = MAX; }

                    const canvas = document.createElement('canvas');
                    canvas.width = tw;
                    canvas.height = th;
                    const ctx = canvas.getContext('2d');

                    // Terapkan transformasi berdasarkan orientasi EXIF
                    ctx.save();
                    switch (orientation) {
                        case 2: ctx.transform(-1, 0, 0, 1, tw, 0); break;
                        case 3: ctx.transform(-1, 0, 0, -1, tw, th); break;
                        case 4: ctx.transform(1, 0, 0, -1, 0, th); break;
                        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
                        case 6: ctx.transform(0, 1, -1, 0, th, 0); break;
                        case 7: ctx.transform(0, -1, -1, 0, th, tw); break;
                        case 8: ctx.transform(0, -1, 1, 0, 0, tw); break;
                        default: break; // orientation 1 = normal
                    }
                    ctx.drawImage(img, 0, 0, needRotate ? th : tw, needRotate ? tw : th);
                    ctx.restore();

                    // Kualitas adaptif: file besar → kompresi lebih tinggi
                    const quality = file.size > 3 * 1024 * 1024 ? 0.75 : 0.82;
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = () => resolve(e.target.result);
                img.src = e.target.result;
            };
            fullReader.onerror = () => resolve(null);
            fullReader.readAsDataURL(file);
        };
        sliceReader.onerror = () => {
            // Fallback tanpa koreksi rotasi
            const r = new FileReader();
            r.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const MAX = 1024;
                    let w = img.width, h = img.height;
                    if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
                    else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.80));
                };
                img.onerror = () => resolve(e.target.result);
                img.src = e.target.result;
            };
            r.readAsDataURL(file);
        };
        // Baca hanya 64KB pertama untuk parsing EXIF (lebih efisien)
        sliceReader.readAsArrayBuffer(file.slice(0, 65536));
    });

    /**
     * Parsing Text hasil Google Cloud Vision
     */
    function parseVisionText(text, docType) {
        let result = {};
        const lines = text.split('\n').map(l => l.trim().toUpperCase());
        const fullText = text.toUpperCase();

        if (docType === 'ktp') {
            let nik = '', nama = '', alamat = '', jk = '';

            // Ekstrak NIK (16 digit)
            const nikMatch = text.match(/\b\d{16}\b/);
            if (nikMatch) nik = nikMatch[0];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Ekstrak Nama
                if ((line.includes('NAMA') || line.includes('NAMA:')) && !nama) {
                    nama = line.replace(/.*NAMA[\s:]*/, '').replace(/[^A-Z\s]/g, '').trim();
                    if (!nama && i + 1 < lines.length) {
                        nama = lines[i + 1].replace(/[^A-Z\s]/g, '').trim();
                    }
                }

                // Ekstrak Alamat
                if ((line.includes('ALAMAT') || line.includes('ALAMAT:')) && !alamat) {
                    alamat = line.replace(/.*ALAMAT[\s:]*/, '').trim();
                    if (!alamat && i + 1 < lines.length) alamat = lines[i + 1].trim();
                }

                // Ekstrak Jenis Kelamin
                if (!jk) {
                    if (line.includes('LAKI') || line.includes('LELAKI')) jk = 'Laki-laki';
                    else if (line.includes('PEREMPUAN')) jk = 'Perempuan';
                }
            }
            result = { nik, nama, alamat, jenis_kelamin: jk };
        }
        else if (docType === 'npwp') {
            let npwp = '';
            // Mencari format NPWP, contoh: 99.999.999.9-999.999
            const npwpMatch = text.match(/\b\d{2}[\.\s]?\d{3}[\.\s]?\d{3}[\.\s]?\d{1}[\-\s]?\d{3}[\.\s]?\d{3}\b/);
            if (npwpMatch) {
                npwp = npwpMatch[0].replace(/[^0-9]/g, ''); // Ambil hanya angka
                if (npwp.length === 15) {
                    npwp = `${npwp.substring(0, 2)}.${npwp.substring(2, 5)}.${npwp.substring(5, 8)}.${npwp.substring(8, 9)}-${npwp.substring(9, 12)}.${npwp.substring(12, 15)}`;
                }
            }
            result = { npwp };
        }
        else if (docType === 'rekening') {
            let no_rekening = '', bank = '';

            // Ekstrak no rekening: cari deretan angka panjang, minimal 9 digit
            const numbers = text.match(/\b(?:\d[ -]*){9,20}\b/g);
            if (numbers) {
                no_rekening = numbers[0].replace(/[^0-9]/g, '');
            }

            // Tebak Bank
            if (fullText.includes('BCA') || fullText.includes('CENTRAL ASIA')) bank = 'BCA';
            else if (fullText.includes('MANDIRI')) bank = 'Mandiri';
            else if (fullText.includes('BRI') || fullText.includes('RAKYAT INDONESIA')) bank = 'BRI';
            else if (fullText.includes('BNI') || fullText.includes('NEGARA INDONESIA')) bank = 'BNI';
            else if (fullText.includes('BSI') || fullText.includes('SYARIAH INDONESIA')) bank = 'BSI';
            else if (fullText.includes('KALSEL')) bank = 'Bank Kalsel';
            else if (fullText.includes('BJB')) bank = 'BJB';
            else if (fullText.includes('BPD')) bank = 'BPD';

            result = { no_rekening, bank };
        }

        return result;
    }

    /**
     * Kirim gambar ke Google Cloud Vision API
     */
    async function scanWithGoogleVision(dataUrl, docType) {
        if (!dataUrl) return '{}';

        // Pastikan API Key ada
        const apiKey = window.GOOGLE_CLOUD_VISION_API_KEY;
        if (!apiKey || apiKey === 'YOUR_GOOGLE_CLOUD_API_KEY_HERE') {
            throw new Error('Google Cloud Vision API Key belum dikonfigurasi. Silakan isi di config.js');
        }

        // Ambil base64 string tanpa prefix "data:image/jpeg;base64,"
        const base64Image = dataUrl.split(',')[1];
        if (!base64Image) {
            throw new Error('Format gambar tidak valid');
        }

        const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
        const payload = {
            requests: [
                {
                    image: { content: base64Image },
                    features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
                }
            ]
        };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Google Vision API Error ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const textAnnotation = data.responses[0].fullTextAnnotation;

            if (!textAnnotation || !textAnnotation.text) {
                console.warn('Google Vision tidak menemukan teks pada ' + docType);
                return '{}';
            }

            const extractedText = textAnnotation.text;
            console.log(`=== RAW VISION TEXT (${docType}) ===\n`, extractedText);

            const parsedResult = parseVisionText(extractedText, docType);
            console.log(`=== PARSED JSON (${docType}) ===\n`, parsedResult);

            return JSON.stringify(parsedResult);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Set loading state pada submit button
     */
    function setLoadingState(label) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
        submitBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>${label}`;
    }

    function resetLoadingState() {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        submitBtn.innerHTML = originalBtnText;
    }


    // TAHAP 1: Intersep submit form → jalankan Gemini AI
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!window.supabaseClient) {
            await showToast('error', 'Sistem belum terhubung ke Supabase. Periksa file config.js Anda.');
            return;
        }

        const fileKtp = document.getElementById('file-ktp').files[0];
        const fileRekening = document.getElementById('file-rekening').files[0];
        const fileNpwp = document.getElementById('file-npwp').files[0];
        const inputNamaOrmas = document.getElementById('input-nama-ormas').value.trim();
        const noWa = document.getElementById('input-wa').value.trim();
        // Validasi form depan
        if (!fileKtp || !fileRekening || !inputNamaOrmas || !noWa) {
            await showToast('warning', 'Mohon lengkapi Nama Ormas, lampirkan dokumen KTP & Rekening, beserta Nomor WhatsApp sebelum diverifikasi!');
            return;
        }
        const waRegex = /^(08|\+628)\d{8,11}$/;
        if (!waRegex.test(noWa)) {
            await showToast('warning', 'Nomor WhatsApp tidak valid! Pastikan diawali 08 atau +628 dengan panjang 10–13 digit.');
            return;
        }

        try {
            // --- Tahap 1: Resize ---
            setLoadingState('(1/3) Mempersiapkan Dokumen...');
            const imgKtp = await resizeForGemini(fileKtp);
            const imgRekening = await resizeForGemini(fileRekening);
            const imgNpwp = fileNpwp ? await resizeForGemini(fileNpwp) : null;

            // --- Tahap 2: Baca KTP ---
            setLoadingState('(2/3) AI Membaca KTP...');
            let foundNik = '', foundNama = '', foundAlamat = '', foundJk = '';
            try {
                const ktpText = await scanWithGoogleVision(imgKtp, 'ktp');
                console.log('=== VISION API KTP ===\n', ktpText);
                const d = JSON.parse(ktpText);
                foundNik = d.nik || '';
                foundNama = d.nama || '';
                foundAlamat = d.alamat || '';
                foundJk = d.jenis_kelamin || '';
            } catch (err) {
                console.warn('Parse KTP gagal:', err);
                if (err.message.includes('API Error')) {
                    resetLoadingState();
                    await showToast('error', `Gagal Terhubung ke AI:\n\n${err.message}\n\nPastikan API Key dan Penagihan (Billing) Google Cloud Anda sudah aktif.`);
                    return;
                }
            }

            // --- Tahap 3: Baca Rekening ---
            setLoadingState('(3/3) AI Membaca Buku Rekening...');
            let foundNorek = '';
            let foundBank = '';
            try {
                const rekText = await scanWithGoogleVision(imgRekening, 'rekening');
                console.log('=== VISION API REKENING ===\n', rekText);
                const d = JSON.parse(rekText);
                foundNorek = d.no_rekening || '';
                foundBank = d.bank || '';
            } catch (err) {
                console.warn('Parse Rekening gagal:', err);
                if (err.message.includes('API Error')) {
                    resetLoadingState();
                    await showToast('error', `Gagal Terhubung ke AI:\n\n${err.message}`);
                    return;
                }
            }

            // --- Tahap 4: Baca NPWP (opsional) ---
            let foundNpwp = '';
            if (fileNpwp && imgNpwp) {
                try {
                    const npwpText = await scanWithGoogleVision(imgNpwp, 'npwp');
                    console.log('=== VISION API NPWP ===\n', npwpText);
                    const d = JSON.parse(npwpText);
                    foundNpwp = d.npwp || '';
                } catch (err) {
                    console.warn('Parse NPWP gagal:', err);
                    if (err.message.includes('API Error')) {
                        resetLoadingState();
                        await showToast('error', `Gagal Terhubung ke AI:\n\n${err.message}`);
                        return;
                    }
                }
            }

            // Validasi: KTP sebagian besar tidak terbaca
            if (!foundNik || !foundNama) {
                resetLoadingState();
                const lanjutManual = await showConfirm('KTP Tidak Terbaca Penuh \n(Gambar mungkin buram/silau)\n\nApakah Anda ingin mengisi sisa data secara MANUAL?\n\n📝 Klik [Ya, Lanjutkan] untuk Isi Manual\n📸 Klik [Batal] untuk Unggah Ulang Foto');

                if (!lanjutManual) {
                    return; // Hentikan proses, biarkan user upload ulang
                }
                // Jika user pilih OK/Manual, kita kosongkan kelamin agar tampil dropdown
                foundJk = '';
            }

            // Render field Jenis Kelamin di modal
            const jkContainer = document.getElementById('ocr-jk').parentNode;
            const jkNorm = foundJk.toLowerCase();
            if (jkNorm.includes('laki') || jkNorm.includes('perempuan')) {
                jkContainer.innerHTML = `
                    <label class="block text-sm font-semibold text-gray-700">Jenis Kelamin</label>
                    <input type="text" id="ocr-jk" class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none bg-gray-50 text-gray-800 font-bold cursor-not-allowed" value="${foundJk}" readonly required>`;
            } else {
                jkContainer.innerHTML = `
                    <label class="block text-sm font-semibold text-red-600">Jenis Kelamin (Pilih Manual) *</label>
                    <select id="ocr-jk" class="w-full px-4 py-3 rounded-xl border border-red-300 focus:outline-none focus:ring-2 focus:ring-[#FA8112] bg-red-50 text-gray-800 font-bold" required>
                        <option value="" disabled selected>Pilih Jenis Kelamin...</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                    </select>`;
            }

            // Render field Bank di modal
            const ocrBankReadonly = document.getElementById('ocr-bank-readonly');
            const bankDropdownContainer = document.getElementById('bank-dropdown-container');
            const labelBank = document.getElementById('label-bank');

            if (foundBank) {
                labelBank.className = "block text-sm font-semibold text-gray-700";
                labelBank.innerText = "Nama Instansi Bank";
                ocrBankReadonly.value = foundBank;
                ocrBankReadonly.classList.remove('hidden');
                bankDropdownContainer.classList.add('hidden');
                if (inputBankDepan) inputBankDepan.value = '';
            } else {
                labelBank.className = "block text-sm font-semibold text-red-600";
                labelBank.innerText = "Nama Instansi Bank (Pilih Manual) *";
                ocrBankReadonly.classList.add('hidden');
                ocrBankReadonly.value = '';
                bankDropdownContainer.classList.remove('hidden');
            }

            // Isi form modal
            inputOcrOrmas.value = inputNamaOrmas;
            inputOcrNik.value = foundNik;
            inputOcrNama.value = foundNama;
            inputOcrAlamat.value = foundAlamat;
            inputOcrNorek.value = foundNorek;
            inputOcrNpwp.value = foundNpwp;

        } catch (error) {
            console.error('Gemini Error:', error);
            await showToast('warning', 'AI Gemini kesulitan membaca dokumen.\n\nAnda dapat mengisi data secara manual di form berikut.', 'Tutup Ke Form Manual');
            inputOcrOrmas.value = inputNamaOrmas || '';
            inputOcrNik.value = '';
            inputOcrNama.value = '';
            inputOcrAlamat.value = '';
            inputOcrNorek.value = '';
            inputOcrNpwp.value = '';

            const ocrBankReadonly = document.getElementById('ocr-bank-readonly');
            const bankDropdownContainer = document.getElementById('bank-dropdown-container');
            const labelBank = document.getElementById('label-bank');
            labelBank.className = "block text-sm font-semibold text-red-600";
            labelBank.innerText = "Nama Instansi Bank (Pilih Manual) *";
            ocrBankReadonly.classList.add('hidden');
            bankDropdownContainer.classList.remove('hidden');
        }

        // Tampilkan modal validasi
        modalOcr.classList.remove('opacity-0', 'pointer-events-none');
    });


    // Tombol Batal Modal
    btnCancelOcr.addEventListener('click', function () {
        modalOcr.classList.add('opacity-0', 'pointer-events-none');
        resetLoadingState();
    });


    // ===============================================
    // FITUR 3: FINALISASI UPLOAD KE DATABASE
    // ===============================================

    async function uploadFile(file, prefix) {
        if (!file) return null;
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${prefix}-${Date.now()}.${fileExt}`;
            const { data, error } = await window.supabaseClient.storage
                .from('dokumen_ormas').upload(fileName, file);
            if (error) throw error;
            const { data: publicData } = window.supabaseClient.storage
                .from('dokumen_ormas').getPublicUrl(fileName);
            return publicData.publicUrl;
        } catch (error) {
            error.message = `Gagal mengunggah foto ${prefix}. ` + error.message;
            throw error;
        }
    }

    // Konfirmasi modal → kirim ke Supabase
    btnConfirmOcr.addEventListener('click', async function () {
        const finalNamaOrmas = inputOcrOrmas.value.trim();
        const finalNik = inputOcrNik.value.trim();
        const finalNama = inputOcrNama.value.trim();
        const finalAlamat = inputOcrAlamat.value.trim();
        const finalJk = document.getElementById('ocr-jk').value.trim();
        const ocrBankReadonly = document.getElementById('ocr-bank-readonly');
        let finalBank = '';
        if (ocrBankReadonly && !ocrBankReadonly.classList.contains('hidden')) {
            finalBank = ocrBankReadonly.value.trim();
        } else if (inputBankDepan) {
            finalBank = inputBankDepan.value.trim();
        }
        const finalNorekManual = inputOcrNorek.value.trim();
        const finalNpwp = inputOcrNpwp.value.trim();
        const noWa = document.getElementById('input-wa').value.trim();
        const fileKtp = document.getElementById('file-ktp').files[0];
        const fileNpwp = document.getElementById('file-npwp').files[0];
        const fileRekening = document.getElementById('file-rekening').files[0];

        if (!fileKtp || !fileRekening) {
            await showToast('error', 'File KTP / Rekening gagal dimuat. Harap periksa ulang form!');
            return;
        }
        if (!finalNik || !finalNama || !finalAlamat || !finalBank || !finalNorekManual) {
            await showToast('warning', 'Data wajib (NIK, Nama, Alamat, Bank, Nomor Rekening) tidak boleh kosong!');
            return;
        }

        const finalNorek = `${finalBank} - ${finalNorekManual}`;

        const npwpRegex = /^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/;
        if (finalNpwp !== '' && !npwpRegex.test(finalNpwp)) {
            await showToast('warning', 'Format NPWP tidak benar! Harus berupa pola: 99.999.999.9-999.999');
            return;
        }

        const originalConfirmText = btnConfirmOcr.innerText;
        btnConfirmOcr.disabled = true;
        btnConfirmOcr.innerText = 'Menyinkronisasi...';

        try {
            // Cek duplikasi NIK
            btnConfirmOcr.innerText = 'Memeriksa Riwayat...';
            const { data: riwayatSama, error: errCek } = await window.supabaseClient
                .from('pendaftar_ormas').select('id, status').eq('nik', finalNik).limit(1);

            if (errCek) throw new Error('Gagal memeriksa riwayat: ' + errCek.message);
            if (riwayatSama && riwayatSama.length > 0) {
                const st = riwayatSama[0].status === 'Valid' ? 'Telah DISAHKAN' : 'Sedang MENUNGGU VALIDASI';
                await showToast('error', `PERMOHONAN DITOLAK (DATA GANDA)\n\nNIK ${finalNik} sudah terdaftar.\nStatus: ${st}.\n\nSilakan pantau informasi dari pihak Kesbangpol.`);
                return;
            }

            // Upload dokumen
            btnConfirmOcr.innerText = 'Mengamankan Dokumen...';
            const urlKtp = await uploadFile(fileKtp, 'ktp');
            const urlNpwp = fileNpwp ? await uploadFile(fileNpwp, 'npwp') : null;
            const urlRekening = await uploadFile(fileRekening, 'rekening');

            // Format nomor WA ke internasional
            let formatWa = noWa;
            if (formatWa.startsWith('0')) formatWa = '62' + formatWa.substring(1);
            if (formatWa.startsWith('+62')) formatWa = '62' + formatWa.substring(3);

            // Insert ke database
            const { data, error } = await window.supabaseClient
                .from('pendaftar_ormas')
                .insert([{
                    nama_ormas: finalNamaOrmas,
                    no_wa: formatWa,
                    no_rekening: finalNorek,
                    nama_lengkap: finalNama,
                    alamat: finalAlamat,
                    jenis_kelamin: finalJk,
                    nik: finalNik,
                    npwp: finalNpwp,
                    foto_ktp_url: urlKtp,
                    foto_npwp_url: urlNpwp,
                    foto_rekening_url: urlRekening
                }]);

            if (error) {
                if (error.code === '42501') throw new Error('Akses RLS ditolak.');
                throw error;
            }

            await showToast('success', 'Berkas berhasil divalidasi dan dikirim!');
            modalOcr.classList.add('opacity-0', 'pointer-events-none');
            form.reset();
            resetPreviewContainer('container-ktp');
            resetPreviewContainer('container-npwp');
            resetPreviewContainer('container-rekening');

            // Reset tampilan dropdown bank
            if (inputBankDepan) inputBankDepan.value = '';
            const selText = document.getElementById('bank-selected-text');
            const selImg = document.getElementById('bank-selected-img-wrapper');
            if (selText) { selText.textContent = 'Pilih Bank...'; selText.classList.add('text-gray-400'); }
            if (selImg) selImg.classList.add('hidden');

        } catch (error) {
            console.error('Proses Pengiriman Terhenti:', error);
            await showToast('error', 'Gagal mengirim data: ' + error.message);
        } finally {
            btnConfirmOcr.disabled = false;
            btnConfirmOcr.innerText = originalConfirmText;
            resetLoadingState();
        }
    });

});
