const API_URL = "https://script.google.com/macros/s/AKfycbymC-osfbzXW-HYXOBWnrBXUNveo_sRaHE2CztQy43ORPVwJxYLuby8V332g3gDJByc_A/exec";

let dataKaryawan = [];
let kalkulasiAktif = null;

function getTodayLocalStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const today = new Date();
  const tglHeader = document.getElementById("current-date");
  if (tglHeader) {
    tglHeader.innerText = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  
  const firstDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const todayStr = getTodayLocalStr();

  if (document.getElementById("laporan-tgl-mulai")) {
    document.getElementById("laporan-tgl-mulai").value = firstDayStr;
    document.getElementById("laporan-tgl-selesai").value = todayStr;
  }
  
  if (document.getElementById("add-tipe-gaji")) {
    updateDefaultRate();
  }
  
  loadKaryawan();
  loadAbsensiHariIni();
  registerServiceWorker();
});

function showToast(msg) {
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toast-text");
  if (!toast) return;
  if (toastText) toastText.innerText = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

function switchTab(tabName) {
  ['absensi', 'karyawan', 'laporan'].forEach(t => {
    const elTab = document.getElementById(`tab-${t}`);
    const elNav = document.getElementById(`nav-${t}`);
    if (elTab) elTab.classList.add('hidden');
    if (elNav) {
      elNav.classList.remove('text-indigo-400');
      elNav.classList.add('text-slate-500');
    }
  });
  
  const activeTab = document.getElementById(`tab-${tabName}`);
  const activeNav = document.getElementById(`nav-${tabName}`);
  if (activeTab) activeTab.classList.remove('hidden');
  if (activeNav) {
    activeNav.classList.remove('text-slate-500');
    activeNav.classList.add('text-indigo-400');
  }
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

async function loadKaryawan() {
  try {
    const res = await fetch(`${API_URL}?action=getKaryawan`);
    const json = await res.json();
    
    if (json.status === "success") {
      dataKaryawan = json.data || [];
      
      let options = '<option value="">-- Pilih Karyawan --</option>';
      dataKaryawan.forEach(k => {
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
          listContainer.innerHTML = '<p class="text-xs text-slate-500 py-2">Belum ada data karyawan.</p>';
        } else {
          listContainer.innerHTML = dataKaryawan.map(k => {
            const id = k.ID_Karyawan || k.id_karyawan || k.id || "";
            const nama = k.Nama || k.nama || "Tanpa Nama";
            const jabatan = k.Jabatan || k.jabatan || "Staf";
            const tipe = k.Tipe_Gaji || k.tipe_gaji || k.tipeGaji || "-";
            const rate = Number(k.Rate_Gaji || k.rate_gaji || k.rateGaji || 0);

            return `
              <div class="p-3 bg-slate-900/60 border border-slate-700/40 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <p class="font-bold text-slate-200">${nama}</p>
                  <p class="text-[10px] text-slate-500">${jabatan} &bull; <span class="text-indigo-400 font-medium">${tipe}</span> &bull; Rp ${rate.toLocaleString('id-ID')}</p>
                </div>
                <button onclick="bukaModalRiwayat('${id}', '${nama}')" class="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 font-semibold px-2.5 py-1.5 rounded-lg text-[10px] transition">
                  Cek Riwayat
                </button>
              </div>
            `;
          }).join("");
        }
      }
    }
  } catch (err) {
    showToast("Gagal menarik data karyawan.");
  }
}

async function loadAbsensiHariIni() {
  const container = document.getElementById("list-absen-hari-ini");
  const totalBadge = document.getElementById("total-absen-today");
  if (!container) return;

  try {
    const res = await fetch(`${API_URL}?action=getAbsensiHariIni`);
    const json = await res.json();

    if (json.status === "success") {
      const data = json.data || [];
      const totalSudahAbsen = data.filter(d => d.sudah_absen).length;
      if (totalBadge) totalBadge.innerText = `${totalSudahAbsen}/${data.length}`;

      if (data.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 py-2">Belum ada karyawan terdaftar.</p>';
        return;
      }

      container.innerHTML = data.map(item => {
        let badgeStyle = "bg-slate-700/50 text-slate-400 border-slate-600/50";
        if (item.status === "Hadir") badgeStyle = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        if (item.status === "Izin") badgeStyle = "bg-amber-500/20 text-amber-400 border-amber-500/30";
        if (item.status === "Alpa") badgeStyle = "bg-rose-500/20 text-rose-400 border-rose-500/30";

        return `
          <div class="p-3 bg-slate-900/60 border border-slate-700/40 rounded-xl flex justify-between items-center text-xs">
            <div>
              <p class="font-bold text-slate-200">${item.nama}</p>
              <p class="text-[10px] text-slate-500">
                ${item.sudah_absen ? 'Jam: ' + item.jam + ' WITA' : 'Belum Melakukan Absensi'} 
                ${item.catatan && item.catatan !== '-' ? '&bull; ' + item.catatan : ''}
              </p>
            </div>
            <span class="px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${badgeStyle}">
              ${item.status}
            </span>
          </div>
        `;
      }).join("");
    } else {
      container.innerHTML = `<p class="text-xs text-rose-400 py-2">Gagal: ${json.message}</p>`;
    }
  } catch (err) {
    container.innerHTML = '<p class="text-xs text-rose-400 py-2">Gagal memuat absensi hari ini.</p>';
  }
}

async function bukaModalRiwayat(idKaryawan, namaKaryawan) {
  const modal = document.getElementById("modal-riwayat");
  const modalNama = document.getElementById("modal-nama-karyawan");
  const modalContent = document.getElementById("modal-content-riwayat");

  if (!modal || !modalContent) return;

  modalNama.innerText = namaKaryawan;
  modalContent.innerHTML = '<p class="text-xs text-slate-500 py-6 text-center">Menarik riwayat absensi 30 hari terakhir...</p>';
  modal.classList.remove("hidden");

  try {
    const res = await fetch(`${API_URL}?action=getRiwayatKaryawan&id_karyawan=${idKaryawan}`);
    const json = await res.json();

    if (json.status === "success") {
      const riwayat = json.data || [];

      if (riwayat.length === 0) {
        modalContent.innerHTML = '<p class="text-xs text-slate-500 py-6 text-center">Tidak ada catatan absensi dalam 30 hari terakhir.</p>';
        return;
      }

      modalContent.innerHTML = riwayat.map(item => {
        let badgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
        if (item.status === "Izin") badgeColor = "bg-amber-500/20 text-amber-400 border-amber-500/30";
        if (item.status === "Alpa") badgeColor = "bg-rose-500/20 text-rose-400 border-rose-500/30";

        return `
          <div class="p-2.5 bg-slate-800/80 border border-slate-700/60 rounded-xl flex justify-between items-center text-xs">
            <div>
              <p class="font-bold text-slate-200">${item.tanggal}</p>
              <p class="text-[10px] text-slate-400">Jam: ${item.jam} WITA ${item.catatan !== '-' ? '&bull; ' + item.catatan : ''}</p>
            </div>
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-full border ${badgeColor}">
              ${item.status}
            </span>
          </div>
        `;
      }).join("");
    }
  } catch (err) {
    modalContent.innerHTML = '<p class="text-xs text-rose-400 py-6 text-center">Gagal memuat riwayat.</p>';
  }
}

function tutupModalRiwayat() {
  const modal = document.getElementById("modal-riwayat");
  if (modal) modal.classList.add("hidden");
}

const formAbsensi = document.getElementById("form-absensi");
if (formAbsensi) {
  formAbsensi.addEventListener("submit", async (e) => {
    e.preventDefault();
    showToast("Menyimpan absensi...");
    
    const radioStatus = document.querySelector('input[name="status"]:checked');
    const todayLocalStr = getTodayLocalStr();

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "catatAbsensi",
          id_karyawan: document.getElementById("absen-karyawan").value,
          tanggal: todayLocalStr,
          status: radioStatus ? radioStatus.value : "Hadir",
          catatan: document.getElementById("absen-catatan").value
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        showToast("Absensi Berhasil Tersimpan!");
        formAbsensi.reset();
        loadAbsensiHariIni();
      } else {
        showToast(json.message || "Gagal menyimpan absensi");
      }
    } catch (err) {
      showToast("Gagal koneksi ke server");
    }
  });
}

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
        loadKaryawan();
        loadAbsensiHariIni();
      } else {
        showToast(json.message);
      }
    } catch (err) {
      showToast("Gagal menyimpan data karyawan baru.");
    }
  });
}

const btnHitungGaji = document.getElementById("btn-hitung-gaji");
if (btnHitungGaji) {
  btnHitungGaji.addEventListener("click", async () => {
    const idKaryawan = document.getElementById("laporan-karyawan").value;
    const tglMulai = document.getElementById("laporan-tgl-mulai").value;
    const tglSelesai = document.getElementById("laporan-tgl-selesai").value;

    if (!idKaryawan || !tglMulai || !tglSelesai) {
      showToast("Lengkapi karyawan dan rentang tanggal.");
      return;
    }

    showToast("Memproses kalkulasi...");

    try {
      const resGaji = await fetch(`${API_URL}?action=hitungkalkulasiGaji&id_karyawan=${idKaryawan}&tgl_mulai=${tglMulai}&tgl_selesai=${tglSelesai}`);
      const jsonGaji = await resGaji.json();

      const periodeTag = `${tglMulai}_sd_${tglSelesai}`;
      const resStatus = await fetch(`${API_URL}?action=cekStatusGaji&id_karyawan=${idKaryawan}&bulan=${periodeTag}`);
      const jsonStatus = await resStatus.json();

      if (jsonGaji.status === "success") {
        const d = jsonGaji.data;
        kalkulasiAktif = { idKaryawan, bulan: periodeTag, total: d.totalGajiDiterima };

        document.getElementById("res-nama").innerText = d.karyawan.nama;
        document.getElementById("res-hadir").innerText = d.rekapKehadiran.hadir;
        document.getElementById("res-izin").innerText = d.rekapKehadiran.izin;
        document.getElementById("res-alpa").innerText = d.rekapKehadiran.alpa;
        document.getElementById("res-total").innerText = `Rp ${Number(d.totalGajiDiterima).toLocaleString('id-ID')}`;

        const badge = document.getElementById("badge-status");
        const areaAksi = document.getElementById("area-aksi-bayar");

        if (jsonStatus.dibayar) {
          badge.className = "px-2.5 py-1 rounded-full font-bold text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
          badge.innerText = "LUNAS";
          if (areaAksi) areaAksi.classList.add("hidden");
        } else {
          badge.className = "px-2.5 py-1 rounded-full font-bold text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30";
          badge.innerText = "BELUM DIBAYAR";
          if (areaAksi) areaAksi.classList.remove("hidden");
        }

        document.getElementById("hasil-gaji").classList.remove("hidden");
      }
    } catch (err) {
      showToast("Gagal mengambil data kalkulasi.");
    }
  });
}

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
