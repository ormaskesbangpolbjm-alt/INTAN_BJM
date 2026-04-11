document.addEventListener('DOMContentLoaded', function () {

    // Pastikan koneksi global Supabase ada dari config.js
    if (!window.supabaseClient) {
        alert('Library Supabase belum dimuat. Pastikan file config.js terbaca dengan sempurna.');
        return;
    }

    const tbody = document.querySelector('tbody');
    // Mencari tombol export dengan cara mendeteksi teks khusus di dalamnya secara dinamis
    const exportBtn = Array.from(document.querySelectorAll('button')).find(btn =>
        btn.textContent.includes('Export ke Excel')
    );

    // Variabel penampung di level global untuk fitur Export CSV nanti
    let globalDataRecords = [];

    /**
     * =========================================================
     * FITUR 1: FUNGSI fetchData() - Menarik data dari Supabase
     * =========================================================
     */
    async function fetchData() {
        // Render State Loading List ke dalam tabel
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-10 text-gray-500 font-medium">
                    <svg class="animate-spin h-8 w-8 text-[#FA8112] mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sedang menarik antrean pendaftar...
                </td>
            </tr>`;

        try {
            // Membaca baris dari tabel dengan order terbaru (ascending: false bernilai DESC)
            const { data, error } = await window.supabaseClient
                .from('pendaftar_ormas')
                .select('*')
                .order('created_at', { ascending: false });

            // Jika error dalam membaca Supabase
            if (error) throw error;

            // Sinkronkan ke memori utama UI yang dipakai Export CSV
            globalDataRecords = data;

            // Kondisi kosong (Tidak ada hasil)
            if (!data || data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500 italic">Belum ada satupun antrean masuk. Coba kirimkan formulir pada portofolio Anda.</td></tr>`;

                const pagingText = document.querySelector('.px-6.py-4.border-t span');
                if (pagingText) pagingText.innerText = `Menampilkan 0 data masuk`;
                return;
            }

            // Sapu bersih seluruh data dummy baris tabel HTML
            tbody.innerHTML = '';

            // Kustomisasi teks penghitungan row dinamis
            const pagingText = document.querySelector('.px-6.py-4.border-t span');
            if (pagingText) pagingText.innerText = `Menampilkan total ${data.length} antrean ORMAS`;

            // Loop untuk setiap rekaman Array yang dimuntahkan Supabase
            data.forEach((item, index) => {

                // 1. Logika Status: Menyalakan visual lencana Valid/Pending kuning/hijau Tailwind
                const isStatusValid = item.status && item.status.toLowerCase() === 'valid';

                const statusBadge = isStatusValid
                    ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300 shadow-sm"><svg class="w-3.5 h-3.5 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>Valid</span>`
                    : `<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-sm"><span class="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5 animate-pulse"></span>Pending</span>`;

                // 2. Logika Dokumen: Anchor target "_blank" untuk membuahkan elemen URL Storage
                let docLinks = '';
                if (item.foto_ktp_url) {
                    docLinks += `<a href="${item.foto_ktp_url}" target="_blank" class="px-2.5 py-1.5 bg-gray-100 border border-gray-200 hover:bg-[#FA8112]/15 hover:text-[#FA8112] hover:border-[#FA8112] text-gray-600 rounded-md text-xs font-bold transition-all shadow-sm mx-0.5" title="Buka KTP di Tab Baru">KTP</a>`;
                }
                if (item.foto_npwp_url) {
                    docLinks += `<a href="${item.foto_npwp_url}" target="_blank" class="px-2.5 py-1.5 bg-gray-100 border border-gray-200 hover:bg-[#FA8112]/15 hover:text-[#FA8112] hover:border-[#FA8112] text-gray-600 rounded-md text-xs font-bold transition-all shadow-sm mx-0.5" title="Buka NPWP di Tab Baru">NPWP</a>`;
                }
                
                // Dimunculkan kembali sesuai permintaan (Buka link Buku Rekening)
                if (item.foto_rekening_url) {
                    docLinks += `<a href="${item.foto_rekening_url}" target="_blank" class="px-2.5 py-1.5 bg-gray-100 border border-gray-200 hover:bg-[#FA8112]/15 hover:text-[#FA8112] hover:border-[#FA8112] text-gray-600 rounded-md text-xs font-bold transition-all shadow-sm mx-0.5" title="Buka Buku Rekening di Tab Baru">REKENING</a>`;
                }

                // 3. Logika Nomor Whatsapp ('0' diganti menhadi -> '62' Format Internasional Default)
                let linkWa = item.no_wa || '';
                if (linkWa.startsWith('0')) {
                    linkWa = '62' + linkWa.slice(1);
                }

                // 4. Logika Tombol Aksi Verifikasi ACC dan Hapus
                const btnAcc = isStatusValid
                    // Kalau Valid: Warna dikusamkan / abu-abu (disable)
                    ? `<button class="inline-flex items-center justify-center bg-gray-200 text-gray-400 cursor-not-allowed px-3 py-1.5 rounded-md text-xs font-bold" disabled>✔️ ACC</button>`
                    // Kalau masih Pending: Tombol hijau tajam (Hidupkan Fungsi di Window)
                    : `<button onclick="window.terimaPeserta('${item.id}')" class="inline-flex items-center justify-center bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md shadow-sm text-xs font-bold transition-transform active:scale-95" title="Setujui/Validasi">✔️ ACC</button>`;

                const btnHapus = `<button onclick="window.hapusPeserta('${item.id}')" class="inline-flex items-center justify-center bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md shadow-sm text-xs font-bold transition-transform active:scale-95" title="Hapus Permanen">🗑️</button>`;

                // Konstruksi elemen <TR> Tabel HTML Native
                const tr = document.createElement('tr');
                tr.className = 'bg-white hover:bg-orange-50/60 transition-colors border-b border-gray-100';

                // Pemisahan string bank dan rekening murni untuk tampilan antrean dashboard
                let dashBank = '-';
                let dashNorek = item.no_rekening || '-';
                if (item.no_rekening && item.no_rekening.includes(' - ')) {
                    const rParts = item.no_rekening.split(' - ');
                    dashBank = rParts[0].trim();
                    dashNorek = rParts.slice(1).join(' - ').trim();
                }

                // Implementasi Kolom Permintaan 
                tr.innerHTML = `
                    <td class="px-5 py-4 text-center text-gray-500 font-medium">${index + 1}</td>
                    <td class="px-5 py-4 font-bold text-[#FA8112] text-sm">${item.nama_ormas || '-'}</td>
                    <td class="px-5 py-4 font-semibold text-[#454545]">${item.nama_lengkap || '<span class="text-xs text-gray-400 italic">Menunggu Hasil Scan</span>'}</td>
                    <td class="px-5 py-4 text-center font-bold text-gray-600">${item.jenis_kelamin || '-'}</td>
                    <td class="px-5 py-4 font-mono font-medium text-gray-600">${item.nik || '-'}</td>
                    <td class="px-5 py-4 font-mono font-medium text-gray-600">${item.alamat || '-'}</td>
                    <td class="px-5 py-4 font-mono font-medium text-gray-600">${item.no_wa || '-'}</td>
                    <td class="px-5 py-4 font-mono font-medium text-gray-600">${dashBank}</td>
                    <td class="px-5 py-4 font-mono font-bold text-[#FA8112] text-sm">${dashNorek}</td>
                    <td class="px-5 py-4 font-mono font-medium text-gray-600 tracking-wide">${item.npwp || '-'}</td>
                    <td class="px-5 py-4 text-center">
                        <div class="flex items-center justify-center space-x-1.5">
                            ${docLinks || '<span class="text-xs text-red-400 px-2">Dokumen Kosong</span>'}
                        </div>
                    </td>
                    <td class="px-5 py-4 text-center">
                        ${statusBadge}
                    </td>
                    <td class="px-5 py-4">
                        <div class="flex items-center justify-center space-x-2">
                            ${btnAcc}
                            ${btnHapus}
                            <!-- API Format Whatsapp Me dengan rel noopener -->
                            <a href="https://wa.me/${linkWa}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center bg-[#FA8112] hover:bg-[#e07510] text-white px-3 py-1.5 rounded-md shadow-sm text-xs font-bold transition-transform active:scale-95 text-center">
                                💬 WA
                            </a>
                        </div>
                    </td>
                `;

                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error('Fetch error:', error);
            tbody.innerHTML = `<tr><td colspan="12" class="text-center py-6 text-red-500 font-bold bg-red-50">Koneksi Timeout: ${error.message}. Pastikan izin SELECT RLS telah diperbolehkan.</td></tr>`;
        }
    }

    // Melakukan inisialisasi awal render di layar sesaat sesudah script berjalan
    async function init() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            fetchData();
        }
    }
    init();


    /**
     * =========================================================
     * FITUR 2: LOGIKA TOMBOL 'ACC' DI SETIAP BARIS (Update Supabase)
     * =========================================================
     */
    window.terimaPeserta = async function (id) {
        // Melindungi operator salah klik lewat konfirmasi visual bawaan
        if (!confirm('Anda yakin seluruh berkas dokumen tersebut sudah sah dan pendaftar ini di-ACC?')) return;

        try {
            // Meluncurkan Query UPDATE berbasis 'id' relasional
            const { error } = await window.supabaseClient
                .from('pendaftar_ormas')
                .update({ status: 'Valid' })
                .eq('id', id);

            if (error) throw error;

            // Status Berhasil diubah
            alert('Pemohon berhasil ditandai sebagai Valid!');

            // Panggil fetchData() lagi untuk merefresh UI Tabel seketika membuang tombol acc
            fetchData();
        } catch (error) {
            alert('Gagal mengeksekusi validasi: ' + error.message);
        }
    };

    /**
     * =========================================================
     * FITUR 2.5: LOGIKA TOMBOL 'HAPUS' DATA PERMANEN
     * =========================================================
     */
    window.hapusPeserta = async function (id) {
        // Melindungi kehilangan data akibat salah raba tak disengaja
        if (!confirm('🚨 PERINGATAN HATI-HATI: Tindakan ini permanen. File yang telah diunggah orang ini juga akan melayang. Lanjutkan Hapus?')) return;

        try {
            // TAHAP 1: Cari referensi datanya di memori lokal tabel untuk mencomot URL fotonya
            const barisData = globalDataRecords.find(item => String(item.id) === String(id));

            if (barisData) {
                const fileYangAkanDihapus = [];

                // Fungsi cerdik mengekstrak HANYA nama file paling ujung dari sebuah lautan URL panjang
                const ekstrakNamaFile = (url) => {
                    if (!url) return null;
                    const pecahan = url.split('/');
                    // URL Public selalu berujung ke nama file (Contoh: "ktp-170123...jpg")
                    return pecahan[pecahan.length - 1];
                };

                // Kumpulkan mangsanya
                const namaKtp = ekstrakNamaFile(barisData.foto_ktp_url);
                if (namaKtp) fileYangAkanDihapus.push(namaKtp);

                const namaNpwp = ekstrakNamaFile(barisData.foto_npwp_url);
                if (namaNpwp) fileYangAkanDihapus.push(namaNpwp);

                const namaRekening = ekstrakNamaFile(barisData.foto_rekening_url);
                if (namaRekening) fileYangAkanDihapus.push(namaRekening);

                // Eksekusi peledakan file sampah secara masal ke dalam Supabase Storage
                if (fileYangAkanDihapus.length > 0) {
                    const { error: errStorage } = await window.supabaseClient.storage
                        .from('dokumen_ormas')
                        .remove(fileYangAkanDihapus);

                    if (errStorage) {
                        console.warn("Storage gagal menghapus murni beberapa berkas gambar (Berpotensi masalah RLS Storage):", errStorage.message);
                    }
                }
            }

            // TAHAP 2: Meluncurkan Query DELETE baris dokumen di Database setelah fotonya hancur
            const { error: errData } = await window.supabaseClient
                .from('pendaftar_ormas')
                .delete()
                .eq('id', id);

            if (errData) throw errData;

            // Status Berhasil dihapus
            alert('Aset Foto beserta Identitasnya sukses ditumpas habis dari Database Kesbangpol!');

            // Refresh seketika
            fetchData();
        } catch (error) {
            alert('Wah gagal menghapus, periksa izin DELETE (RLS): ' + error.message);
        }
    };


    /**
     * =========================================================
     * FITUR 3: EKSPOR KE EXCEL (.CSV) MENGGGUNAKAN BLOB DATA
     * =========================================================
     */
    if (exportBtn) {
        exportBtn.addEventListener('click', function () {
            // Pencegahan unduhan kosong murni Array memory
            if (globalDataRecords.length === 0) {
                alert('Tabel masih kosong, tidak ada data yang bisa diekstrasi.');
                return;
            }

            // Memperbaiki urutan kolom, dan menambahkan tempat khusus untuk NOMOR NPWP resmi
            const headers = [
                'NO',
                'NAMA LENGKAP',
                'NOMOR WHATSAPP',
                'NOMOR REKENING',
                'NOMOR NPWP',
                'STATUS',
                'TANGGAL PENDAFTARAN'
            ];

            // Langkah 1: Merakit Array Object Javascript secara kaku (Sesuai Konvensi ExcelJS)
            const data = globalDataRecords.map((item, idx) => {
                let tglDaftar = '-';
                if (item.created_at) {
                    try {
                        tglDaftar = item.created_at.split('T')[0];
                    } catch (e) {
                        tglDaftar = '-';
                    }
                }

                // Memisahkan String "Bank Baru - 123456" menjadi Institusi dan Nomornya murni
                let bankInstansi = '-';
                let noRekMurni = item.no_rekening || '-';
                if (item.no_rekening && item.no_rekening.includes(' - ')) {
                    const parts = item.no_rekening.split(' - ');
                    bankInstansi = parts[0].trim();
                    noRekMurni = parts.slice(1).join(' - ').trim();
                }

                return {
                    no: idx + 1,
                    ormas: item.nama_ormas || '-',
                    nama: item.nama_lengkap || '-',
                    nik: item.nik || '-',
                    alamat: item.alamat || '-',
                    jk: item.jenis_kelamin || '-',
                    whatsapp: item.no_wa || '-',
                    bank: bankInstansi,
                    rekening: noRekMurni,
                    npwp: item.npwp || '-',
                    status: item.status && item.status.toLowerCase() === 'valid' ? 'Valid' : 'Pending',
                    tanggal: tglDaftar
                };
            });

            // Langkah 2: Menggunakan Library ExcelJS untuk Membuat Workbook Asli (.xlsx)
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Data Ormas');

            // Menyusun Struktur Kolom Laporan Sesuai Instruksi Tambahan (NIK, Alamat, Bank Pisah)
            sheet.columns = [
                { header: 'NO', key: 'no', width: 5 },
                { header: 'NAMA ORMAS', key: 'ormas', width: 35 },
                { header: 'NAMA LENGKAP', key: 'nama', width: 30 },
                { header: 'JENIS KELAMIN', key: 'jk', width: 15 },
                { header: 'NIK PENDUDUK', key: 'nik', width: 20 },
                { header: 'ALAMAT', key: 'alamat', width: 35 },
                { header: 'NOMOR WHATSAPP', key: 'whatsapp', width: 20 },
                { header: 'NAMA BANK', key: 'bank', width: 20 },
                { header: 'NOMOR REKENING', key: 'rekening', width: 22 },
                { header: 'NOMOR NPWP', key: 'npwp', width: 25 },
                { header: 'STATUS', key: 'status', width: 15 },
                { header: 'TANGGAL PENDAFTARAN', key: 'tanggal', width: 22 }
            ];

            // Mewarnai Header Gelap dan Teks Tebal (Tampilan Rapi Bebas Manual)
            sheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF454545' } // Warna abu-abu gelap klasik
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            // Menyalin seluruh data Array kita ke dalam rak Tabel ExcelJS
            sheet.addRows(data);

            // Memberikan bingkai pinggiran (Border) dan menengahkan teks data
            sheet.eachRow((row, rowNumber) => {
                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (rowNumber > 1) { // Agar header tak terganti rataannya
                        cell.alignment = { vertical: 'middle', horizontal: 'left' };
                        // Tengah untuk Nomor dan Status
                        if (cell._column.key === 'no' || cell._column.key === 'status') {
                            cell.alignment.horizontal = 'center';
                        }
                    }
                });
            });

            // Menghasilkan File Biner (.xlsx) kemudian Memicu Unduhan Paksa (Download)
            workbook.xlsx.writeBuffer().then((dataBuffer) => {
                const blob = new Blob([dataBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const fileUrl = URL.createObjectURL(blob);

                const forceDownloadEl = document.createElement('a');
                forceDownloadEl.setAttribute('href', fileUrl);
                forceDownloadEl.setAttribute('download', 'Laporan_Pendaftaran_Ormas.xlsx');
                document.body.appendChild(forceDownloadEl);

                forceDownloadEl.click();

                document.body.removeChild(forceDownloadEl);
                URL.revokeObjectURL(fileUrl);
            });
        });
    }

});
