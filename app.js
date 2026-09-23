// URL BACKEND API GOOGLE APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbzLK0xQcu9BZELQDn2NK1WlGsCKlUvlI4Bhn9m0mEBEJV3XqhEI4LhWWxBUrnRzkYBnIg/exec";

// KOORDINAT KEDAI MATTOWA (Jl. Palawija 7X, Kel. Tamansari, Kota Mataram)
const KEDAI_LAT = -8.580793; 
const KEDAI_LNG = 116.082494; 
const MAX_RADIUS_METERS = 100; 

let dataKaryawan = [];
let kalkulasiAktif = null;
let karyawanDipilih = null;

let canvasSig = null;
let ctxSig = null;
let isDrawing = false;

function hitungJarakMeter(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

function getTodayLocalStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateRealtimeClock() {
  const now = new Date();
  const optionsTgl = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' };
  const optionsJam = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Makassar' };

  const headerDateEl = document.getElementById("header-date");
  const headerTimeEl = document.getElementById("header-time");

  if (headerDateEl) headerDateEl.innerText = now.toLocaleDateString('id-ID', optionsTgl);
  if (headerTimeEl) headerTimeEl.innerText = `${now.toLocaleTimeString('id-ID', optionsJam)} WITA`;
}

document.addEventListener("DOMContentLoaded", () => {
  updateRealtimeClock();
  setInterval(updateRealtimeClock, 1000);

  const today = new Date();
  const firstDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const todayStr = getTodayLocalStr();

  const tglMulaiEl = document.getElementById("laporan-tgl-mulai");
  const tglSelesaiEl = document.getElementById("laporan-tgl-selesai");

  if (tglMulaiEl) tglMulaiEl.value = firstDayStr;
  if (tglSelesaiEl) tglSelesaiEl.value = todayStr;

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
  toast.style.display = 'flex';
  setTimeout(() => {
    toast.classList.add("hidden");
    toast.style.display = 'none';
  }, 3500);
}

function switchTab(tabName) {
  ['absensi', 'karyawan', 'laporan'].forEach(t => {
    const elTab = document.getElementById(`tab-${t}`);
    const elNav = document.getElementById(`nav-${t}`);
    if (elTab) {
      if (t === tabName) {
        elTab.classList.remove('hidden');
        elTab.style.display = 'block';
      } else {
        elTab.classList.add('hidden');
        elTab.style.display = 'none';
      }
    }
    if (elNav) {
      elNav.className = (t === tabName) 
        ? 'flex flex-col items-center gap-1 text-brand-600 dark:text-indigo-400 font-bold'
        : 'flex flex-col items-center gap-1 text-slate-400 font-medium hover:text-slate-600 dark:hover:text-slate-200 transition';
    }
  });
}

function switchKaryawanSubTab(subTab) {
  const btnAktif = document.getElementById("subtab-btn-aktif");
  const btnNonaktif = document.getElementById("subtab-btn-nonaktif");
  const listAktif = document.getElementById("list-karyawan-aktif");
  const listNonaktif = document.getElementById("list-karyawan-nonaktif");

  if (subTab === 'aktif') {
    if (btnAktif) btnAktif.className = "py-2 text-center text-xs font-bold rounded-xl bg-brand-600 text-white transition shadow-sm";
    if (btnNonaktif) btnNonaktif.className = "py-2 text-center text-xs font-bold rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition";
    if (listAktif) { listAktif.classList.remove("hidden"); listAktif.style.display = 'block'; }
    if (listNonaktif) { listNonaktif.classList.add("hidden"); listNonaktif.style.display = 'none'; }
  } else {
    if (btnNonaktif) btnNonaktif.className = "py-2 text-center text-xs font-bold rounded-xl bg-rose-600 text-white transition shadow-sm";
    if (btnAktif) btnAktif.className = "py-2 text-center text-xs font-bold rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition";
    if (listNonaktif) { listNonaktif.classList.remove("hidden"); listNonaktif.style.display = 'block'; }
    if (listAktif) { listAktif.classList.add("hidden"); listAktif.style.display = 'none'; }
  }
}

function updateDefaultRate() {
  const tipeEl = document.getElementById("add-tipe-gaji");
  const inputRate = document.getElementById("add-rate-gaji");
  if (!tipeEl || !inputRate) return;
  
  const tipe = tipeEl.value;
  if (tipe === "Harian") inputRate.value = 50000;
  else if (tipe === "Bulanan") inputRate.value = 1200000;
  else if (tipe === "Mingguan") inputRate.value = 300000;
}

// AMBIL DAFTAR KARYAWAN
async function loadKaryawan() {
  try {
    const res = await fetch(`${API_URL}?action=getKaryawan`);
    const json = await res.json();
    
    if (json.status === "success") {
      dataKaryawan = json.data || [];
      
      let optionsAbsen = '<option value="">-- Pilih Nama Karyawan --</option>';
      let optionsLaporan = '<option value="">-- Pilih Karyawan --</option>';

      let karyawanAktifList = [];
      let karyawanNonaktifList = [];

      dataKaryawan.forEach(k => {
        const id = k.ID_Karyawan || k.id || "";
        const nama = k.Nama || k.nama || "Tanpa Nama";
        const stAktif = k.Status_Aktif || "Aktif";
        const isAktif = stAktif.toLowerCase() === "aktif";

        if (isAktif) {
          optionsAbsen += `<option value="${id}">${nama} (${id})</option>`;
          karyawanAktifList.push(k);
        } else {
          karyawanNonaktifList.push(k);
        }

        optionsLaporan += `<option value="${id}">${nama} ${!isAktif ? "(Nonaktif)" : ""}</option>`;
      });

      const selectAbsen = document.getElementById("absen-karyawan");
      const selectLaporan = document.getElementById("laporan-karyawan");
      if (selectAbsen) selectAbsen.innerHTML = optionsAbsen;
      if (selectLaporan) selectLaporan.innerHTML = optionsLaporan;

      const countAktifEl = document.getElementById("count-karyawan-aktif");
      const countNonaktifEl = document.getElementById("count-karyawan-nonaktif");
      if (countAktifEl) countAktifEl.innerText = karyawanAktifList.length;
      if (countNonaktifEl) countNonaktifEl.innerText = karyawanNonaktifList.length;

      const containerAktif = document.getElementById("list-karyawan-aktif");
      if (containerAktif) {
        containerAktif.innerHTML = karyawanAktifList.length === 0 
          ? '<p class="text-xs text-slate-400 py-3 text-center">Tidak ada karyawan aktif.</p>'
          : karyawanAktifList.map(k => renderCardKaryawanMinimalis(k)).join("");
      }

      const containerNonaktif = document.getElementById("list-karyawan-nonaktif");
      if (containerNonaktif) {
        containerNonaktif.innerHTML = karyawanNonaktifList.length === 0 
          ? '<p class="text-xs text-slate-400 py-3 text-center">Tidak ada karyawan nonaktif.</p>'
          : karyawanNonaktifList.map(k => renderCardKaryawanMinimalis(k)).join("");
      }
    }
  } catch (err) {
    showToast("Gagal memuat data karyawan.");
  }
}

function renderCardKaryawanMinimalis(k) {
  const id = k.ID_Karyawan || k.id || "";
  const nama = k.Nama || k.nama || "Tanpa Nama";
  const jabatan = k.Jabatan || "Staf";

  return `
    <div onclick="bukaModalDetailKaryawan('${id}')" class="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl flex justify-between items-center cursor-pointer hover:border-brand-500/50 transition active:scale-[0.98] shadow-sm">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">
          ${nama.charAt(0).toUpperCase()}
        </div>
        <div>
          <p class="font-bold text-xs text-slate-900 dark:text-slate-100">${nama}</p>
          <p class="text-[10px] text-slate-500 dark:text-slate-400">${jabatan}</p>
        </div>
      </div>
      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
      </svg>
    </div>
  `;
}

function bukaModalDetailKaryawan(idKaryawan) {
  const k = dataKaryawan.find(item => (item.ID_Karyawan || item.id) === idKaryawan);
  if (!k) return;

  karyawanDipilih = k;
  const id = k.ID_Karyawan || k.id;
  const nama = k.Nama || k.nama;
  const jabatan = k.Jabatan || "Staf";
  const tipe = k.Tipe_Gaji || "Harian";
  const rate = Number(k.Rate_Gaji || 0);
  const stAktif = (k.Status_Aktif || "Aktif");
  const isAktif = stAktif.toLowerCase() === "aktif";

  document.getElementById("detail-id").innerText = id;
  document.getElementById("detail-nama").innerText = nama;
  document.getElementById("detail-jabatan").innerText = jabatan;
  document.getElementById("detail-tipe").innerText = tipe;
  document.getElementById("detail-rate").innerText = `Rp ${rate.toLocaleString('id-ID')}`;

  const badgeStatus = document.getElementById("detail-status-badge");
  badgeStatus.innerText = stAktif;
  badgeStatus.className = isAktif 
    ? "px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
    : "px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30";

  document.getElementById("btn-action-absen").onclick = () => {
    tutupModalDetailKaryawan();
    bukaModalRiwayat(id, nama);
  };

  document.getElementById("btn-action-gaji").onclick = () => {
    tutupModalDetailKaryawan();
    bukaModalRiwayatGaji(id, nama);
  };

  document.getElementById("btn-action-edit").onclick = () => {
    tutupModalDetailKaryawan();
    bukaModalEditKaryawan(k);
  };

  const btnToggle = document.getElementById("btn-action-toggle");
  btnToggle.innerText = isAktif ? "Nonaktifkan Karyawan" : "Aktifkan Karyawan";
  btnToggle.className = isAktif
    ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold py-2.5 rounded-xl text-xs transition"
    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold py-2.5 rounded-xl text-xs transition";

  btnToggle.onclick = async () => {
    tutupModalDetailKaryawan();
    await toggleStatusKaryawan(id, isAktif ? "Nonaktif" : "Aktif");
  };

  const modal = document.getElementById("modal-detail-karyawan");
  modal.classList.remove("hidden");
  modal.style.display = "flex";
}

function tutupModalDetailKaryawan() {
  const modal = document.getElementById("modal-detail-karyawan");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

function bukaModalEditKaryawan(k) {
  document.getElementById("edit-id").value = k.ID_Karyawan || k.id;
  document.getElementById("edit-nama").value = k.Nama || k.nama;
  document.getElementById("edit-jabatan").value = k.Jabatan || "Staf";
  document.getElementById("edit-tipe-gaji").value = k.Tipe_Gaji || "Harian";
  document.getElementById("edit-rate-gaji").value = k.Rate_Gaji || 0;

  const modal = document.getElementById("modal-edit-karyawan");
  modal.classList.remove("hidden");
  modal.style.display = "flex";
}

function tutupModalEditKaryawan() {
  const modal = document.getElementById("modal-edit-karyawan");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

const formEditKaryawan = document.getElementById("form-edit-karyawan");
if (formEditKaryawan) {
  formEditKaryawan.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("edit-id").value;
    const nama = document.getElementById("edit-nama").value;
    const jabatan = document.getElementById("edit-jabatan").value;
    const tipe = document.getElementById("edit-tipe-gaji").value;
    const rate = document.getElementById("edit-rate-gaji").value;

    showToast("Menyimpan perubahan...");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "tambahKaryawan",
          id_karyawan: id,
          nama: nama,
          jabatan: jabatan,
          tipe_gaji: tipe,
          rate_gaji: rate
        })
      });

      const json = await res.json();
      if (json.status === "success") {
        showToast("Data Karyawan Berhasil Diperbarui!");
        tutupModalEditKaryawan();
        loadKaryawan();
      } else {
        showToast(json.message || "Gagal mengubah data");
      }
    } catch (err) {
      showToast("Gagal terhubung ke server.");
    }
  });
}

function bukaModalTambahKaryawan() {
  const modal = document.getElementById("modal-tambah-karyawan");
  modal.classList.remove("hidden");
  modal.style.display = "flex";
}

function tutupModalTambahKaryawan() {
  const modal = document.getElementById("modal-tambah-karyawan");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

// LOGIKA KWITANSI & TANDA TANGAN DIGITAL
function initSignaturePad() {
  canvasSig = document.getElementById("canvas-signature");
  if (!canvasSig) return;
  ctxSig = canvasSig.getContext("2d");

  ctxSig.strokeStyle = "#2563eb";
  ctxSig.lineWidth = 2.5;
  ctxSig.lineCap = "round";

  canvasSig.addEventListener("mousedown", startDrawing);
  canvasSig.addEventListener("mousemove", draw);
  canvasSig.addEventListener("mouseup", stopDrawing);

  canvasSig.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startDrawing(e.touches[0]);
  });
  canvasSig.addEventListener("touchmove", (e) => {
    e.preventDefault();
    draw(e.touches[0]);
  });
  canvasSig.addEventListener("touchend", stopDrawing);
}

function startDrawing(e) {
  isDrawing = true;
  const rect = canvasSig.getBoundingClientRect();
  ctxSig.beginPath();
  ctxSig.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
  if (!isDrawing) return;
  const rect = canvasSig.getBoundingClientRect();
  ctxSig.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctxSig.stroke();
}

function stopDrawing() {
  isDrawing = false;
}

function clearSignature() {
  if (ctxSig && canvasSig) {
    ctxSig.clearRect(0, 0, canvasSig.width, canvasSig.height);
  }
}

function bukaModalKwitansi(nama, jabatan, periode, total) {
  document.getElementById("kwitansi-no").innerText = `KW-${Date.now().toString().slice(-6)}`;
  document.getElementById("kwitansi-tgl").innerText = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  document.getElementById("kwitansi-nama").innerText = nama;
  document.getElementById("kwitansi-jabatan").innerText = jabatan;
  document.getElementById("kwitansi-periode").innerText = periode.replace(/_sd_/g, ' s/d ');
  document.getElementById("kwitansi-total").innerText = `Rp ${Number(total).toLocaleString('id-ID')}`;

  const modal = document.getElementById("modal-kwitansi");
  modal.classList.remove("hidden");
  modal.style.display = "flex";

  setTimeout(initSignaturePad, 200);
}

function tutupModalKwitansi() {
  const modal = document.getElementById("modal-kwitansi");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
  clearSignature();
}

function simpanDanCetakKwitansi() {
  window.print();
}

// GEOLOCATION ABSENSI
function verifikasiDanAbsen(idKaryawan, statusCustom, catatanCustom) {
  if (!navigator.geolocation) {
    showToast("Fitur GPS lokasi tidak didukung di HP ini.");
    return;
  }

  showToast("Mengecek posisi lokasi Anda...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      const jarakM = hitungJarakMeter(userLat, userLng, KEDAI_LAT, KEDAI_LNG);

      if (jarakM > MAX_RADIUS_METERS) {
        showToast(`Absen Ditolak! Anda di luar area Kedai (${jarakM}m dari lokasi).`);
        return;
      }

      const labelLokasi = `Kel. Tamansari (${jarakM}m dari Kedai)`;
      kirimAbsensiKeServer(idKaryawan, statusCustom, catatanCustom, labelLokasi, userLat, userLng);
    },
    () => {
      showToast("Gagal mengambil lokasi! Harap aktifkan GPS HP Anda.");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

async function kirimAbsensiKeServer(idKaryawan, statusCustom, catatanCustom, labelLokasi, lat, lng) {
  showToast("Menyimpan Absensi...");
  const todayLocalStr = getTodayLocalStr();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "catatAbsensi",
        id_karyawan: idKaryawan,
        tanggal: todayLocalStr,
        status: statusCustom,
        catatan: catatanCustom,
        lokasi: labelLokasi,
        latitude: lat,
        longitude: lng
      })
    });
    
    const json = await res.json();
    if (json.status === "success") {
      showToast("Absensi Berhasil Disimpan!");
      const selectAbsen = document.getElementById("absen-karyawan");
      if (selectAbsen) selectAbsen.value = "";
      loadAbsensiHariIni();
    } else {
      showToast(json.message || "Gagal menyimpan absensi");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server.");
  }
}

const formAbsensi = document.getElementById("form-absensi");
if (formAbsensi) {
  formAbsensi.addEventListener("submit", (e) => {
    e.preventDefault();
    const idVal = document.getElementById("absen-karyawan").value;
    const radioStatus = document.querySelector('input[name="status"]:checked');
    const inputCatatan = document.getElementById("absen-catatan");

    if (!idVal) {
      showToast("Pilih nama karyawan terlebih dahulu.");
      return;
    }

    const st = radioStatus ? radioStatus.value : "Hadir";
    const ct = inputCatatan && inputCatatan.value ? inputCatatan.value : "-";

    verifikasiDanAbsen(idVal, st, ct);
  });
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
        container.innerHTML = '<p class="text-xs text-slate-400 py-3 text-center">Belum ada karyawan aktif.</p>';
        return;
      }

      container.innerHTML = data.map(item => {
        let statusTeks = "Belum Absen";
        let badgeStyle = "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";

        if (item.sudah_absen) {
          statusTeks = item.status;
          if (item.status === "Hadir") badgeStyle = "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400";
          if (item.status === "Setengah Hari") badgeStyle = "bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-400";
          if (item.status === "Izin") badgeStyle = "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400";
          if (item.status === "Alpa") badgeStyle = "bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400";
        }

        return `
          <div class="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs mb-2">
            <div>
              <p class="font-bold text-slate-900 dark:text-slate-200">${item.nama}</p>
              <p class="text-[10px] text-slate-500 dark:text-slate-400">
                ${item.sudah_absen ? 'Jam: ' + item.jam + ' WITA &bull; ' + (item.lokasi || 'Tamansari') : 'Belum Melakukan Absensi'} 
              </p>
            </div>
            <span class="px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${badgeStyle}">
              ${statusTeks}
            </span>
          </div>
        `;
      }).join("");
    }
  } catch (err) {
    container.innerHTML = '<p class="text-xs text-rose-400 py-2 text-center">Gagal memuat status harian.</p>';
  }
}

async function toggleStatusKaryawan(idKaryawan, statusBaru) {
  showToast("Memproses...");
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "toggleStatusKaryawan",
        id_karyawan: idKaryawan,
        status_aktif: statusBaru
      })
    });
    
    const json = await res.json();
    if (json.status === "success") {
      showToast(json.message);
      loadKaryawan();
      loadAbsensiHariIni();
    } else {
      showToast(json.message || "Gagal mengubah status");
    }
  } catch (err) {
    showToast("Gagal koneksi ke server.");
  }
}

async function bukaModalRiwayat(idKaryawan, namaKaryawan) {
  const modal = document.getElementById("modal-riwayat");
  const modalNama = document.getElementById("modal-nama-karyawan");
  const modalContent = document.getElementById("modal-content-riwayat");

  if (!modal || !modalContent) return;

  modalNama.innerText = namaKaryawan;
  modalContent.innerHTML = '<p class="text-xs text-slate-400 py-6 text-center">Memuat riwayat...</p>';
  modal.classList.remove("hidden");
  modal.style.display = 'flex';

  try {
    const res = await fetch(`${API_URL}?action=getRiwayatKaryawan&id_karyawan=${idKaryawan}`);
    const json = await res.json();

    if (json.status === "success") {
      const riwayat = json.data || [];
      if (riwayat.length === 0) {
        modalContent.innerHTML = '<p class="text-xs text-slate-400 py-6 text-center">Belum ada catatan absensi.</p>';
        return;
      }

      modalContent.innerHTML = riwayat.map(item => {
        let badgeColor = "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
        if (item.status === "Setengah Hari") badgeColor = "bg-sky-500/15 text-sky-600 border-sky-500/30";
        if (item.status === "Izin") badgeColor = "bg-amber-500/15 text-amber-600 border-amber-500/30";
        if (item.status === "Alpa") badgeColor = "bg-rose-500/15 text-rose-600 border-rose-500/30";

        return `
          <div class="p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs mb-2">
            <div>
              <p class="font-bold text-slate-900 dark:text-slate-200">${item.tanggal}</p>
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
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = 'none';
  }
}

async function bukaModalRiwayatGaji(idKaryawan, namaKaryawan) {
  const modal = document.getElementById("modal-riwayat-gaji");
  const modalNama = document.getElementById("modal-gaji-nama-karyawan");
  const modalContent = document.getElementById("modal-content-riwayat-gaji");

  if (!modal || !modalContent) return;

  modalNama.innerText = namaKaryawan;
  modalContent.innerHTML = '<p class="text-xs text-slate-400 py-6 text-center">Memuat riwayat gaji...</p>';
  modal.classList.remove("hidden");
  modal.style.display = 'flex';

  try {
    const res = await fetch(`${API_URL}?action=getRiwayatGajiKaryawan&id_karyawan=${idKaryawan}`);
    const json = await res.json();

    if (json.status === "success") {
      const riwayat = json.data || [];
      if (riwayat.length === 0) {
        modalContent.innerHTML = '<p class="text-xs text-slate-400 py-6 text-center">Belum ada riwayat gaji yang dibayar.</p>';
        return;
      }

      modalContent.innerHTML = riwayat.map(item => {
        const periodeTxt = String(item.periode || "").replace(/_sd_/g, ' s/d ');
        const totalRp = Number(item.totalGaji || 0).toLocaleString('id-ID');

        return `
          <div class="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 text-xs mb-2">
            <div class="flex justify-between items-center">
              <span class="font-bold text-emerald-600 dark:text-emerald-400 text-sm">Rp ${totalRp}</span>
              <span class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                ${item.status}
              </span>
            </div>
            <div class="flex justify-between items-center text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-1.5 mt-1">
              <span>Periode: <b class="text-slate-700 dark:text-slate-200">${periodeTxt}</b></span>
              <span>Dibayar: ${item.tanggalBayar}</span>
            </div>
          </div>
        `;
      }).join("");
    }
  } catch (err) {
    modalContent.innerHTML = '<p class="text-xs text-rose-400 py-6 text-center">Gagal memuat riwayat gaji.</p>';
  }
}

function tutupModalRiwayatGaji() {
  const modal = document.getElementById("modal-riwayat-gaji");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = 'none';
  }
}

const formTambahKaryawan = document.getElementById("form-tambah-karyawan");
if (formTambahKaryawan) {
  formTambahKaryawan.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const nama = document.getElementById("add-nama").value;
    const jabatan = document.getElementById("add-jabatan").value;
    const tipeGaji = document.getElementById("add-tipe-gaji").value;
    const rateGaji = document.getElementById("add-rate-gaji").value;

    showToast("Menyimpan karyawan...");

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
        tutupModalTambahKaryawan();
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
      showToast("Lengkapi nama karyawan & rentang tanggal.");
      return;
    }

    showToast("Menghitung kalkulasi...");

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
        const resSetengah = document.getElementById("res-setengah");
        if (resSetengah) resSetengah.innerText = d.rekapKehadiran.setengahHari || 0;
        document.getElementById("res-izin").innerText = d.rekapKehadiran.izin;
        document.getElementById("res-alpa").innerText = d.rekapKehadiran.alpa;
        document.getElementById("res-total").innerText = `Rp ${Number(d.totalGajiDiterima).toLocaleString('id-ID')}`;

        const badge = document.getElementById("badge-status");
        const areaAksi = document.getElementById("area-aksi-bayar");

        if (jsonStatus.dibayar) {
          badge.className = "px-2.5 py-1 rounded-full font-bold text-[10px] bg-emerald-500/15 text-emerald-600 border border-emerald-500/30";
          badge.innerText = "LUNAS";
          if (areaAksi) { areaAksi.classList.add("hidden"); areaAksi.style.display = 'none'; }
        } else {
          badge.className = "px-2.5 py-1 rounded-full font-bold text-[10px] bg-amber-500/15 text-amber-600 border border-amber-500/30";
          badge.innerText = "BELUM DIBAYAR";
          if (areaAksi) { areaAksi.classList.remove("hidden"); areaAksi.style.display = 'block'; }
        }

        const hasilGajiEl = document.getElementById("hasil-gaji");
        if (hasilGajiEl) {
          hasilGajiEl.classList.remove("hidden");
          hasilGajiEl.style.display = 'block';
        }
      }
    } catch (err) {
      showToast("Gagal mengambil kalkulasi gaji.");
    }
  });
}

const btnBayarGaji = document.getElementById("btn-bayar-gaji");
if (btnBayarGaji) {
  btnBayarGaji.addEventListener("click", async () => {
    if (!kalkulasiAktif) return;
    if (!confirm("Tandai gaji ini sebagai SUDAH DIBAYAR dan buat kwitansi?")) return;

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
        
        const k = dataKaryawan.find(item => (item.ID_Karyawan || item.id) === kalkulasiAktif.idKaryawan);
        const nama = k ? (k.Nama || k.nama) : "Karyawan";
        const jabatan = k ? (k.Jabatan || "Staf") : "Staf";

        bukaModalKwitansi(nama, jabatan, kalkulasiAktif.bulan, kalkulasiAktif.total);
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
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
