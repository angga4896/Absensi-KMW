// URL BACKEND API TERHUBUNG LANGSUNG DENGAN GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycby4k-n13DP9duRP90eAzWbvd89EYZsk_ecfmNdaJBw7yjiygvqXz46Omp2ynmcPEy8axQ/exec";

let dataKaryawan = [];
let kalkulasiAktif = null;

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  document.getElementById("current-date").innerText = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  document.getElementById("laporan-bulan").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  if (document.getElementById("add-tipe-gaji")) {
    updateDefaultRate();
  }
  
  loadKaryawan();
  registerServiceWorker();
});

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

function switchTab(tabName) {
  ['absensi', 'karyawan', 'laporan'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.add('hidden');
    document.getElementById(`nav-${t}`).className = 'text-slate-400 text-xs font-semibold';
  });
  document.getElementById(`tab-${tabName}`).classList.remove('hidden');
  document.getElementById(`nav-${tabName}`).className = 'text-blue-600 text-xs font-semibold';
}

function updateDefaultRate() {
  const tipe = document.getElementById("add-tipe-gaji").value;
  const inputRate = document.getElementById("add-rate-gaji");
  
  if (tipe === "Harian") {
    inputRate.value = 50000;
  } else if (tipe === "Bulanan") {
    inputRate.value = 1200000;
  } else if (tipe === "Mingguan") {
    inputRate.value = 300000;
  }
}

async function loadKaryawan() {
  try {
    const res = await fetch(`${API_URL}?action=getKaryawan`);
    const json = await res.json();
    if (json.status === "success") {
      dataKaryawan = json.data;
      
      let options = '<option value="">-- Pilih Karyawan --</option>';
      dataKaryawan.forEach(k => {
        // Penanganan fallback jika properti bernama 'Nama' atau 'nama'
        const id = k.ID_Karyawan || k.id || "";
        const nama = k.Nama || k.nama || "Tanpa Nama";
        const tipe = k.Tipe_Gaji || k.tipe_gaji || k.tipeGaji || "-";
        
        options += `<option value="${id}">${nama} (${tipe})</option>`;
      });

      document.getElementById("absen-karyawan").innerHTML = options;
      document.getElementById("laporan-karyawan").innerHTML = options;
      
      document.getElementById("list-karyawan").innerHTML = dataKaryawan.map(k => {
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
  } catch (err) {
    showToast("Gagal memuat data karyawan");
  }
}
// Form Catat Absensi
document.getElementById("form-absensi").addEventListener("submit", async (e) => {
  e.preventDefault();
  showToast("Menyimpan absensi...");
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "catatAbsensi",
        id_karyawan: document.getElementById("absen-karyawan").value,
        tanggal: new Date().toISOString().split('T')[0],
        status: document.querySelector('input[name="status"]:checked').value,
        catatan: document.getElementById("absen-catatan").value
      })
    });
    const json = await res.json();
    if (json.status === "success") {
      showToast("Absensi Berhasil!");
      document.getElementById("form-absensi").reset();
    }
  } catch (err) {
    showToast("Gagal mencatat absensi.");
  }
});

// Form Tambah Karyawan Baru
document.getElementById("form-tambah-karyawan")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const nama = document.getElementById("add-nama").value;
  const jabatan = document.getElementById("add-jabatan").value;
  const tipeGaji = document.getElementById("add-tipe-gaji").value;
  const rateGaji = document.getElementById("add-rate-gaji").value;

  showToast("Menyimpan karyawan baru...");

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
      document.getElementById("form-tambah-karyawan").reset();
      updateDefaultRate();
      loadKaryawan();
    } else {
      showToast(json.message);
    }
  } catch (err) {
    showToast("Gagal menambah karyawan baru.");
  }
});

// Hitung Gaji & Cek Status
document.getElementById("btn-hitung-gaji").addEventListener("click", async () => {
  const idKaryawan = document.getElementById("laporan-karyawan").value;
  const bulan = document.getElementById("laporan-bulan").value;

  if (!idKaryawan || !bulan) {
    showToast("Pilih karyawan dan periode bulan");
    return;
  }

  showToast("Memproses kalkulasi...");

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
        areaAksi.classList.add("hidden");
      } else {
        badge.className = "px-2.5 py-1 rounded-full font-bold text-[10px] bg-amber-100 text-amber-700";
        badge.innerText = "BELUM DIBAYAR";
        areaAksi.classList.remove("hidden");
      }

      document.getElementById("hasil-gaji").classList.remove("hidden");
    }
  } catch (err) {
    showToast("Gagal mengambil kalkulasi gaji");
  }
});

// Bayar Gaji (Tandai Lunas)
document.getElementById("btn-bayar-gaji").addEventListener("click", async () => {
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
      document.getElementById("btn-hitung-gaji").click();
    } else {
      showToast(json.message);
    }
  } catch (err) {
    showToast("Gagal memproses pembayaran");
  }
});

// Register PWA Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch(err => console.error('SW Failed', err));
  }
}
