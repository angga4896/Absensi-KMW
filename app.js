// URL BACKEND API TERBARU DARI GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbzy5l_OKrU0GeGjtWupZ4Hxd0PPdJh9QPe38WKzG6rNZfMa9UZcswsZeR6NZ60_4UpLBA/exec";

let dataKaryawan = [];
let kalkulasiAktif = null;

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  const tglHeader = document.getElementById("current-date");
  if (tglHeader) {
    tglHeader.innerText = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  
  const inputBulan = document.getElementById("laporan-bulan");
  if (inputBulan) {
    inputBulan.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }
  
  if (document.getElementById("add-tipe-gaji")) {
    updateDefaultRate();
  }
  
  loadKaryawan();
  registerServiceWorker();
});

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

function switchTab(tabName) {
  ['absensi', 'karyawan', 'laporan'].forEach(t => {
    const elTab = document.getElementById(`tab-${t}`);
    const elNav = document.getElementById(`nav-${t}`);
    if (elTab) elTab.classList.add('hidden');
    if (elNav) elNav.className = 'text-slate-400 text-xs font-semibold';
  });
  
  const activeTab = document.getElementById(`tab-${tabName}`);
  const activeNav = document.getElementById(`nav-${tabName}`);
  if (activeTab) activeTab.classList.remove('hidden');
  if (activeNav) activeNav.className = 'text-blue-600 text-xs font-semibold';
}

function updateDefaultRate() {
  const tipeEl = document.getElementById("add-tipe-gaji");
  const inputRate = document.getElementById("add-rate-gaji");
  if (!tipeEl || !inputRate) return;
  
  const tipe = tipeEl.value;
  if (tipe === "Harian") {
    inputRate.value = 50000;
  } else if (tipe === "Bulanan") {
    inputRate.value = 1200000;
  } else if (tipe === "Mingguan") {
    inputRate.value = 300000;
  }
}

// FUNGSI UTAMA PENARIKAN DATA DARI GOOGLE SHEETS
async function loadKaryawan() {
  try {
    const res = await fetch(`${API_URL}?action=getKaryawan`);
    const json = await res.json();
    
    if (json.status === "success") {
      dataKaryawan = json.data || [];
      
      let options = '<option value="">-- Pilih Karyawan --</option>';
      dataKaryawan.forEach(k => {
        // Pembacaan fleksibel untuk mengatasi variasi penulisan header kolom
        const id = k.ID_Karyawan || k.id_karyawan || k.id || "";
        const nama = k.Nama || k.nama || "Tanpa Nama";
        const tipe = k.Tipe_Gaji || k.tipe_gaji || k.tipeGaji || "-";
        
        options += `<option value="${id}">${nama} (${tipe})</option>`;
      });

      const selectAbsen = document.getElementById("absen-karyawan");
      const selectLaporan = document.getElementById("laporan-karyawan");
      if (selectAbsen) selectAbsen.innerHTML = options;
      if (selectLaporan) selectLaporan.innerHTML = options;
      
      const listContainer = document.getElementById("list-karyawan");
      if (listContainer) {
        if (dataKaryawan.length === 0) {
          listContainer.innerHTML = '<p class="text-xs text-slate-400">Belum ada data karyawan di Google Sheets.</p>';
        } else {
          listContainer.innerHTML = dataKaryawan.map(k => {
            const nama = k.Nama || k.nama || "Tanpa Nama";
            const jabatan = k.Jabatan || k.jabatan || "Staf";
            const tipe = k.Tipe_Gaji || k.tipe_gaji || k.tipeGaji || "-";
            const rate = Number(k.Rate_Gaji || k.rate_gaji || k.rateGaji || 0);

            return `
              <div class="p-3 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center text-xs">
                <div>
                  <p class="font-bold text-slate-700">${nama}</p>
                  <p class="text-slate-400">${jabatan} &bull; <span class="text-blue-600">${tipe}</span></p>
                </div>
                <div class="font-semibold text-slate-600">
                  Rp ${rate.toLocaleString('id-ID')}
                </div>
              </div>
            `;
          }).join("");
        }
      }
    }
  } catch (err) {
    console.error("Error loading karyawan:", err);
    showToast("Gagal menarik data dari Google Sheets");
  }
}

// Simpan Absensi Harian
const formAbsensi = document.getElementById("form-absensi");
if (formAbsensi) {
  formAbsensi.addEventListener("submit", async (e) => {
    e.preventDefault();
    showToast("Menyimpan absensi...");
    
    const radioStatus = document.querySelector('input[name="status"]:checked');
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "catatAbsensi",
          id_karyawan: document.getElementById("absen-karyawan").value,
          tanggal: new Date().toISOString().split('T')[0],
          status: radioStatus ? radioStatus.value : "Hadir",
          catatan: document.getElementById("absen-catatan").value
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        showToast("Absensi Berhasil Tersimpan!");
        formAbsensi.reset();
      } else {
        showToast(json.message || "Gagal menyimpan absensi");
      }
    } catch (err) {
      showToast("Gagal koneksi ke server");
    }
  });
}

// Tambah Karyawan Baru
const formTambahKaryawan = document.getElementById("form-tambah-karyawan");
if (formTambahKaryawan) {
  formTambahKaryawan.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const nama = document.getElementById("add-nama").value;
    const jabatan = document.getElementById("add-jabatan").value;
    const tipeGaji = document.getElementById("add-tipe-gaji").value;
    const rateGaji = document.getElementById("add-rate-gaji").value;

    showToast("Menyimpan ke Google Sheets...");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "tambahKaryawan",
          nama: nama,
          jabatan: jabatan,
          tipe_gaji: tipeGaji,
          rate_gaji: rateGaji
        })
      });
      
      const json = await res.json();
      if (json.status === "success") {
        showToast("Karyawan Berhasil Ditambahkan!");
        formTambahKaryawan.reset();
        updateDefaultRate();
        loadKaryawan(); // Refresh data instan
      } else {
        showToast(json.message);
      }
    } catch (err) {
      showToast("Gagal menyimpan data karyawan baru.");
    }
  });
}

// Cek & Hitung Gaji
const btnHitungGaji = document.getElementById("btn-hitung-gaji");
if (btnHitungGaji) {
  btnHitungGaji.addEventListener("click", async () => {
    const idKaryawan = document.getElementById("laporan-karyawan").value;
    const bulan = document.getElementById("laporan-bulan").value;

    if (!idKaryawan || !bulan) {
      showToast("Pilih karyawan dan periode bulan terlebih dahulu");
      return;
    }

    showToast("Menarik rekapan gaji...");

    try {
      const resGaji = await fetch(`${API_URL}?action=hitungkalkulasiGaji&id_karyawan=${idKaryawan}&bulan=${bulan}`);
      const jsonGaji = await resGaji.json();

      const resStatus = await fetch(`${API_URL}?action=cekStatusGaji&id_karyawan=${idKaryawan}&bulan=${bulan}`);
      const jsonStatus = await resStatus.json();

      if (jsonGaji.status === "success") {
        const d = jsonGaji.data;
        kalkulasiAktif = { idKaryawan, bulan, total: d.totalGajiDiterima };

        document.getElementById("res-nama").innerText = d.karyawan.nama;
        document.getElementById("res-hadir").innerText = d.rekapKehadiran.hadir;
        document.getElementById("res-izin").innerText = d.rekapKehadiran.izin;
        document.getElementById("res-alpa").innerText = d.rekapKehadiran.alpa;
        document.getElementById("res-total").innerText = `Rp ${Number(d.totalGajiDiterima).toLocaleString('id-ID')}`;

        const badge = document.getElementById("badge-status");
        const areaAksi = document.getElementById("area-aksi-bayar");

        if (jsonStatus.dibayar) {
          badge.className = "px-2.5 py-1 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-700";
          badge.innerText = "LUNAS (SUDAH DIBAYAR)";
          if (areaAksi) areaAksi.classList.add("hidden");
        } else {
          badge.className = "px-2.5 py-1 rounded-full font-bold text-[10px] bg-amber-100 text-amber-700";
          badge.innerText = "BELUM DIBAYAR";
          if (areaAksi) areaAksi.classList.remove("hidden");
        }

        document.getElementById("hasil-gaji").classList.remove("hidden");
      }
    } catch (err) {
      showToast("Gagal mengambil data dari server");
    }
  });
}

// Bayar Gaji
const btnBayarGaji = document.getElementById("btn-bayar-gaji");
if (btnBayarGaji) {
  btnBayarGaji.addEventListener("click", async () => {
    if (!kalkulasiAktif) return;
    if (!confirm("Tandai gaji ini sebagai SUDAH DIBAYAR?")) return;

    showToast("Memproses Pembayaran...");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "bayarGaji",
          id_karyawan: kalkulasiAktif.idKaryawan,
          periode: kalkulasiAktif.bulan,
          total_gaji: kalkulasiAktif.total,
          catatan: "Pencairan via Web App"
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        showToast("Gaji Berhasil Dibayar!");
        btnHitungGaji.click();
      } else {
        showToast(json.message);
      }
    } catch (err) {
      showToast("Gagal memproses pembayaran");
    }
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch(err => console.error('SW Failed', err));
  }
}
