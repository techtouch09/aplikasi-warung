let barangList = JSON.parse(localStorage.getItem('sembako_barang')) || [];
let pengeluaranList = JSON.parse(localStorage.getItem('sembako_pengeluaran')) || [];
let transaksiList = JSON.parse(localStorage.getItem('sembako_transaksi')) || [];
let kasbonList = JSON.parse(localStorage.getItem('sembako_kasbon')) || [];
let keranjangList = [];
let currentSelectedKasirBarcode = "";

let keranjangScanner = [];
let selectedProdukAktif = null;
let html5QrCode = null;
let lastScannedCode = "";
let lastScannedTime = 0;

let currentFilteredTransaksi = [];

let adminCreds = JSON.parse(localStorage.getItem('sembako_admin')) || {
  username: 'admin',
  password: 'admin',
  avatar: ''
};

let tokoProfile = JSON.parse(localStorage.getItem('sembako_toko')) || {
  nama: 'TOKO SEMBAKO',
  telp: '087877611218',
  alamat: 'Jl. Bojonegoro Kp. Kernaden rt 05 05',
  notes: 'Terima kasih atas kunjungan Anda!',
  logo: ''
};

let tempAvatarBase64 = '';
let tempLogoBase64 = '';

document.addEventListener('DOMContentLoaded', () => {
  loadProfilData();
  
  const isSessionLoggedIn = sessionStorage.getItem('sembako_logged_in');
  if (isSessionLoggedIn === 'true') {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    showTab('berandaTab');
  } else {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
  }

  renderBarangTable();
  renderPengeluaranTable();
  renderRiwayatTransaksi();
  renderKasbonTable();
  renderKeranjangScanner();
  populateBarangDatalist();
  populateKasbonDatalist();
  populateLaporanBarangSelect();
  updateDashboardStats();
  updateFinancialSummary();
  updateNotifications();
  updateKasbonNotifications();
  
  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById('pengTgl')) document.getElementById('pengTgl').value = today;
  if(document.getElementById('barExpired')) document.getElementById('barExpired').value = today;
  if(document.getElementById('kasbonTgl')) document.getElementById('kasbonTgl').value = today;
  
  if(document.getElementById('trxTglDari')) document.getElementById('trxTglDari').value = '';
  if(document.getElementById('trxTglSampai')) document.getElementById('trxTglSampai').value = '';
});

function handleLogin(e) {
  e.preventDefault();
  const uInput = document.getElementById('loginUsername').value.trim();
  const pInput = document.getElementById('loginPassword').value.trim();

  if(uInput === adminCreds.username && pInput === adminCreds.password) {
    sessionStorage.setItem('sembako_logged_in', 'true');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    showTab('berandaTab');
  } else {
    alert("Username atau Password salah! (Default: admin / admin)");
  }
}

function logout() {
  if(confirm("Keluar dari sesi ini dan kembali ke halaman login?")) {
    sessionStorage.removeItem('sembako_logged_in');
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
  }
}

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if(targetTab) targetTab.classList.add('active');

  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if(activeBtn) activeBtn.classList.add('active');

  if(tabId === 'berandaTab') {
    updateDashboardStats();
    updateFinancialSummary();
  }
  if(tabId === 'barangTab') populateBarangDatalist();
  if(tabId === 'kasirTab') {
    populateKasbonDatalist();
    if(!document.getElementById('transaksiEditIndex').value) {
      resetKasirForm();
    }
  }
  if(tabId === 'scannerTab') {
    populateKasbonDatalist();
    initScannerCamera();
  } else {
    if(html5QrCode) {
      try { html5QrCode.stop(); } catch(e){}
    }
  }
  if(tabId === 'laporanTab') {
    const tbody = document.getElementById('laporanTbody');
    if(tbody && !tbody.hasAttribute('data-filtered')) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Silakan pilih tanggal dan klik 'Tampilkan Laporan'.</td></tr>`;
    }
  }
  if(tabId === 'kasbonTab') {
    if(!document.getElementById('kasbonEditIndex').value) {
      document.getElementById('kasbonTgl').value = new Date().toISOString().split('T')[0];
    }
  }

  const sidebar = document.getElementById('appSidebar');
  if(sidebar && window.innerWidth <= 768) {
    sidebar.classList.remove('mobile-open');
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('appSidebar');
  if(sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
}

function toggleForm(formId, iconId) {
  const formCard = document.getElementById(formId);
  const icon = document.getElementById(iconId);
  if(formCard.classList.contains('collapsed')) {
    formCard.classList.remove('collapsed');
    icon.innerText = '▲';
  } else {
    formCard.classList.add('collapsed');
    icon.innerText = '...';
  }
}

function saveDataToStorage() {
  localStorage.setItem('sembako_barang', JSON.stringify(barangList));
  localStorage.setItem('sembako_pengeluaran', JSON.stringify(pengeluaranList));
  localStorage.setItem('sembako_transaksi', JSON.stringify(transaksiList));
  localStorage.setItem('sembako_kasbon', JSON.stringify(kasbonList));
  localStorage.setItem('sembako_admin', JSON.stringify(adminCreds));
  localStorage.setItem('sembako_toko', JSON.stringify(tokoProfile));
  updateNotifications();
  updateKasbonNotifications();
}

function updateDashboardStats() {
  document.getElementById('statTotalBarang').innerText = barangList.length;
  document.getElementById('statTotalTransaksi').innerText = transaksiList.length;
  document.getElementById('statTotalPengeluaran').innerText = pengeluaranList.length;
}

function updateFinancialSummary() {
  const totalPengeluaran = pengeluaranList.reduce((sum, p) => sum + (parseFloat(p.modal) || parseFloat(p.nominal) || 0), 0);
  const totalPembelianStok = barangList.reduce((sum, b) => sum + ((parseFloat(b.modal) || 0) * (parseInt(b.stok) || 0)), 0);
  const totalOmset = transaksiList.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

  if(document.getElementById('finPengeluaran')) {
    document.getElementById('finPengeluaran').innerText = `Rp ${formatNumber(totalPengeluaran)}`;
    document.getElementById('finPembelianStok').innerText = `Rp ${formatNumber(totalPembelianStok)}`;
    document.getElementById('finOmset').innerText = `Rp ${formatNumber(totalOmset)}`;
  }
}

function formatDateID(dateString) {
  if(!dateString) return '-';
  const parts = dateString.split('-');
  if(parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

function updateKasbonNotifications() {
  const notifList = document.getElementById('kasbonNotifListContainer');
  const notifCountBadge = document.getElementById('kasbonNotifCount');
  if(!notifList || !notifCountBadge) return;

  const belumLunasList = kasbonList.filter(k => {
    const trx = transaksiList.filter(t => t.namaKasbon && t.namaKasbon.toLowerCase() === k.nama.toLowerCase());
    const totalBelanja = trx.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const sudahDibayar = trx.reduce((sum, t) => {
      let subSudah = 0;
      if (t.isLunasKasbon === true) subSudah += (parseFloat(t.total) || 0);
      if (t.items && Array.isArray(t.items)) {
        t.items.forEach(i => {
          if (i.isLunasItem === true) subSudah += (parseFloat(i.subtotal) || 0);
        });
      }
      return sum + subSudah;
    }, 0);
    const sisa = totalBelanja - sudahDibayar;
    return (trx.length > 0 && sisa > 0);
  });

  notifCountBadge.innerText = belumLunasList.length;

  if(belumLunasList.length === 0) {
    notifList.innerHTML = `<div class="notif-empty">Tidak ada piutang belum lunas.</div>`;
    return;
  }

  let html = '';
  belumLunasList.forEach((k) => {
    const origIdx = kasbonList.indexOf(k);
    
    const trx = transaksiList.filter(t => t.namaKasbon && t.namaKasbon.toLowerCase() === k.nama.toLowerCase());
    const totalBelanja = trx.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const sudahDibayar = trx.reduce((sum, t) => {
      let subSudah = 0;
      if (t.isLunasKasbon === true) subSudah += (parseFloat(t.total) || 0);
      if (t.items && Array.isArray(t.items)) {
        t.items.forEach(i => {
          if (i.isLunasItem === true) subSudah += (parseFloat(i.subtotal) || 0);
        });
      }
      return sum + subSudah;
    }, 0);
    const sisa = totalBelanja - sudahDibayar;

    let keteranganSisa = sisa > 0 ? ` (sisa: Rp ${formatNumber(sisa)})` : ` (Belum Lunas)`;

    html += `<div class="notif-item stok-warning" onclick="navigateToKasbon(${origIdx})">
      <span>📑</span>
      <div>Piutang: <b>${k.nama}</b><br><small style="color: #dc2626; font-weight: 600;">Belum Lunas${keteranganSisa}</small></div>
    </div>`;
  });
  notifList.innerHTML = html;
}

function toggleKasbonNotifDropdown() {
  const dropdown = document.getElementById('kasbonNotifDropdown');
  const otherDropdown = document.getElementById('notifDropdown');
  if(otherDropdown && !otherDropdown.classList.contains('hidden')) otherDropdown.classList.add('hidden');
  if(dropdown) dropdown.classList.toggle('hidden');
}

function navigateToKasbon(idx) {
  toggleKasbonNotifDropdown();
  showTab('kasbonTab');
  setTimeout(() => {
    const row = document.getElementById(`kasbonRow_${idx}`);
    if(row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelectorAll('.highlight-row-yellow').forEach(el => el.classList.remove('highlight-row-yellow'));
      row.classList.add('highlight-row-yellow');
      setTimeout(() => row.classList.remove('highlight-row-yellow'), 4000);

      const detailRow = document.getElementById(`kasbonDetailRow_${idx}`);
      const btn = document.getElementById(`btnDetailKasbon_${idx}`);
      if(detailRow && detailRow.classList.contains('hidden')) {
        detailRow.classList.remove('hidden');
        if(btn) {
          btn.innerText = '❌ Tutup';
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
        }
      }
    }
  }, 100);
}

function updateNotifications() {
  const notifList = document.getElementById('notifListContainer');
  const notifCountBadge = document.getElementById('notifCount');
  if(!notifList || !notifCountBadge) return;

  let warnings = [];
  const today = new Date();
  today.setHours(0,0,0,0);

  barangList.forEach((b, idx) => {
    if(b.stok < 3) {
      warnings.push({
        type: 'stok',
        text: `Stok menipis: <b>${b.nama}</b> tersisa ${b.stok} ${b.satuan}`,
        index: idx,
        class: 'stok-warning'
      });
    }

    if(b.expired) {
      const expDate = new Date(b.expired);
      expDate.setHours(0,0,0,0);
      const diffTime = expDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if(diffDays <= 15) {
        const formattedExp = formatDateID(b.expired);
        let msg = diffDays < 0 ? `Sudah kadaluarsa (${formattedExp})` : `Kadaluarsa dalam ${diffDays} hari (${formattedExp})`;
        warnings.push({
          type: 'expired',
          text: `Masa aktif habis: <b>${b.nama}</b> - ${msg}`,
          index: idx,
          class: 'expired-warning'
        });
      }
    }
  });

  notifCountBadge.innerText = warnings.length;

  if(warnings.length === 0) {
    notifList.innerHTML = `<div class="notif-empty">Tidak ada peringatan.</div>`;
    return;
  }

  let html = '';
  warnings.forEach(w => {
    let icon = w.type === 'stok' ? '⚠️ [Stok]' : '⏰ [Exp]';
    html += `<div class="notif-item ${w.class}" onclick="navigateToBarang(${w.index})">
      <span>${icon}</span>
      <div>${w.text}</div>
    </div>`;
  });
  notifList.innerHTML = html;
}

function toggleNotifDropdown() {
  const dropdown = document.getElementById('notifDropdown');
  const otherDropdown = document.getElementById('kasbonNotifDropdown');
  if(otherDropdown && !otherDropdown.classList.contains('hidden')) otherDropdown.classList.add('hidden');
  if(dropdown) dropdown.classList.toggle('hidden');
}

function navigateToBarang(idx) {
  toggleNotifDropdown();
  showTab('barangTab');
  setTimeout(() => {
    const row = document.getElementById(`barangRow_${idx}`);
    if(row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('highlight-row');
      setTimeout(() => row.classList.remove('highlight-row'), 3000);

      const detailRow = document.getElementById(`barangDetailRow_${idx}`);
      const btn = document.getElementById(`btnDetail_${idx}`);
      if(detailRow && detailRow.classList.contains('hidden')) {
        detailRow.classList.remove('hidden');
        if(btn) {
          btn.innerText = '❌ Tutup';
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
        }
      }
    }
  }, 100);
}

window.addEventListener('click', function(e) {
  if(!e.target.closest('.notification-wrapper')) {
    const dropdown = document.getElementById('notifDropdown');
    if(dropdown && !dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
    }
    const kasbonDropdown = document.getElementById('kasbonNotifDropdown');
    if(kasbonDropdown && !kasbonDropdown.classList.contains('hidden')) {
      kasbonDropdown.classList.add('hidden');
    }
  }
});

// PENGELUARAN BULK DELETE & CRUD
function toggleSelectAllPengeluaran(source) {
  const checkboxes = document.querySelectorAll('.pengeluaran-checkbox');
  checkboxes.forEach(cb => { cb.checked = source.checked; });
}

function savePengeluaran(e) {
  e.preventDefault();
  const idx = document.getElementById('pengeluaranEditIndex').value;
  
  const newItem = {
    tanggal: document.getElementById('pengTgl').value,
    keterangan: document.getElementById('pengKeterangan').value.trim(),
    modal: parseFloat(document.getElementById('pengHargaModal').value) || 0,
    jual: parseFloat(document.getElementById('pengHargaJual').value) || 0,
    barcode: document.getElementById('pengBarcodeCode').value.trim()
  };

  if(idx === "") {
    pengeluaranList.push(newItem);
  } else {
    const oldItem = pengeluaranList[idx];
    pengeluaranList[idx] = newItem;

    barangList.forEach(b => {
      if(b.kode === oldItem.barcode || b.nama.toUpperCase() === oldItem.keterangan.toUpperCase()) {
        b.nama = newItem.keterangan.toUpperCase();
        b.kode = newItem.barcode;
        b.modal = newItem.modal;
        b.jual = newItem.jual;
      }
    });
  }

  saveDataToStorage();
  renderPengeluaranTable();
  renderBarangTable();
  populateBarangDatalist();
  updateFinancialSummary();
  resetPengeluaranForm();
}

function renderPengeluaranTable() {
  const tbody = document.getElementById('pengeluaranTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const selectAllCb = document.getElementById('selectAllPengeluaranCheckbox');
  if(selectAllCb) selectAllCb.checked = false;

  const keyword = (document.getElementById('searchPengeluaranInput')?.value || '').toLowerCase();
  const filtered = pengeluaranList.filter(p => p.keterangan.toLowerCase().includes(keyword) || p.barcode.toLowerCase().includes(keyword));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #777;">Belum ada data pengeluaran.</td></tr>`;
    return;
  }

  filtered.forEach((p, idx) => {
    const origIdx = pengeluaranList.indexOf(p);
    const svgId = `tableBarcode_peng_${origIdx}`;
    tbody.innerHTML += `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="pengeluaran-checkbox" value="${origIdx}" style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td>${idx + 1}</td>
        <td>${formatDateID(p.tanggal)}</td>
        <td><b>${p.keterangan}</b></td>
        <td>Rp ${formatNumber(p.modal)}</td>
        <td>Rp ${formatNumber(p.jual)}</td>
        <td><svg id="${svgId}" class="table-barcode-svg"></svg></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="editPengeluaran(${origIdx})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deletePengeluaran(${origIdx})">Hapus</button>
        </td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, p.barcode, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 14 }); } catch(err){}
    }, 50);
  });
}

function hapusPengeluaranTerpilih() {
  const selected = document.querySelectorAll('.pengeluaran-checkbox:checked');
  if(selected.length === 0) {
    alert("Pilih minimal satu data pengeluaran yang ingin dihapus!");
    return;
  }
  if(confirm(`Yakin ingin menghapus ${selected.length} data pengeluaran terpilih?`)) {
    const indices = Array.from(selected).map(cb => parseInt(cb.value)).sort((a,b) => b-a);
    indices.forEach(idx => { pengeluaranList.splice(idx, 1); });
    saveDataToStorage();
    renderPengeluaranTable();
    populateBarangDatalist();
    updateFinancialSummary();
    alert("Data pengeluaran terpilih berhasil dihapus.");
  }
}

function editPengeluaran(idx) {
  toggleForm('pengeluaranFormCard', 'pengeluaranToggleIcon');
  const p = pengeluaranList[idx];
  document.getElementById('pengeluaranEditIndex').value = idx;
  document.getElementById('pengTgl').value = p.tanggal;
  document.getElementById('pengKeterangan').value = p.keterangan;
  document.getElementById('pengHargaModal').value = p.modal;
  document.getElementById('pengHargaJual').value = p.jual;
  document.getElementById('pengBarcodeCode').value = p.barcode;
  previewLiveBarcode();
}

function deletePengeluaran(idx) {
  if(confirm("Hapus data pengeluaran ini?")) {
    pengeluaranList.splice(idx, 1);
    saveDataToStorage();
    renderPengeluaranTable();
    populateBarangDatalist();
    updateFinancialSummary();
  }
}

function resetPengeluaranForm() {
  document.getElementById('pengeluaranForm').reset();
  document.getElementById('pengeluaranEditIndex').value = "";
  document.getElementById('liveBarcodeSvg').innerHTML = "";
  toggleForm('pengeluaranFormCard', 'pengeluaranToggleIcon');
}

// BARANG BULK DELETE & CRUD
function toggleSelectAllBarang(source) {
  const checkboxes = document.querySelectorAll('.barang-checkbox');
  checkboxes.forEach(cb => { cb.checked = source.checked; });
}

function saveBarang(e) {
  e.preventDefault();
  const idx = document.getElementById('barangEditIndex').value;
  const barcodeVal = document.getElementById('barKode').value.trim();
  
  if(!barcodeVal) {
    alert("Barcode wajib terisi otomatis dari data pengeluaran.");
    return;
  }

  const barang = {
    kode: barcodeVal,
    nama: document.getElementById('barNama').value.toUpperCase().trim(),
    stok: parseInt(document.getElementById('barStok').value) || 0,
    satuan: document.getElementById('barSatuan').value,
    expired: document.getElementById('barExpired').value,
    modal: parseFloat(document.getElementById('barHargaModal').value) || 0,
    jual: parseFloat(document.getElementById('barHargaJual').value) || 0
  };

  if(idx === "") barangList.push(barang);
  else barangList[idx] = barang;

  saveDataToStorage();
  renderBarangTable();
  populateLaporanBarangSelect();
  updateDashboardStats();
  updateFinancialSummary();
  resetBarangForm();
}

function renderBarangTable() {
  const tbody = document.getElementById('barangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const selectAllCb = document.getElementById('selectAllBarangCheckbox');
  if(selectAllCb) selectAllCb.checked = false;

  const keyword = (document.getElementById('searchBarangInput')?.value || '').toLowerCase();
  const filtered = barangList.filter(b => b.nama.toLowerCase().includes(keyword) || b.kode.toLowerCase().includes(keyword));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #777;">Belum ada data barang. Silakan input dari Data Pengeluaran terlebih dahulu.</td></tr>`;
    return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  filtered.forEach((b, idx) => {
    const origIdx = barangList.indexOf(b);
    const formattedExpDate = formatDateID(b.expired);
    const svgIdBarang = `tableBarcode_bar_${origIdx}`;
    
    let expBadge = formattedExpDate;
    if(b.expired) {
      const expDate = new Date(b.expired);
      expDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      if(diffDays <= 15) {
        let label = diffDays < 0 ? `Expired (${formattedExpDate})` : `${formattedExpDate} (⚠️ ${diffDays} hari)`;
        expBadge = `<span class="badge-expired">${label}</span>`;
      } else {
        expBadge = `<span class="badge-safe">${formattedExpDate}</span>`;
      }
    }

    let stokBadge = `<b>${b.stok}</b> ${b.satuan}`;
    if(b.stok < 3) {
      stokBadge = `<span class="badge-warning">${b.stok} ${b.satuan} (⚠️ Menipis)</span>`;
    }

    tbody.innerHTML += `
      <tr id="barangRow_${origIdx}">
        <td style="text-align: center;">
          <input type="checkbox" class="barang-checkbox" value="${origIdx}" style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td>${idx + 1}</td>
        <td style="text-align: center;">
          <svg id="${svgIdBarang}" class="table-barcode-svg"></svg>
          <div style="margin-top: 5px; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 2px 6px;" onclick="downloadBarangBarcodePNG(${origIdx})">📥 Download PNG</button>
            <button type="button" class="btn btn-primary btn-sm" style="font-size: 0.75rem; padding: 2px 6px;" onclick="salinNomorBarcode('${b.kode}')">📋 Salin Kode</button>
          </div>
        </td>
        <td><b>${b.nama}</b></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="toggleDetailBarang(${origIdx})" id="btnDetail_${origIdx}">🔍 Detail</button>
        </td>
      </tr>
      <tr id="barangDetailRow_${origIdx}" class="hidden">
        <td colspan="5" style="padding: 0; background-color: #f8fafc;">
          <div style="padding: 15px 20px; border-left: 4px solid #4f46e5; background: #ffffff; margin: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; flex-wrap: wrap; gap: 20px; font-size: 0.9rem; margin-bottom: 15px; align-items: center;">
              <div><b>Stok:</b> ${stokBadge}</div>
              <div><b>Satuan:</b> ${b.satuan}</div>
              <div style="display: inline-flex; align-items: center; gap: 6px;"><b>Kadaluarsa:</b> ${expBadge}</div>
              <div><b>Harga Modal:</b> Rp ${formatNumber(b.modal)}</div>
              <div><b>Harga Jual:</b> Rp ${formatNumber(b.jual)}</div>
              <div><b>Kode Barcode:</b> <code>${b.kode}</code> <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.7rem; padding: 1px 4px; margin-left: 4px;" onclick="salinNomorBarcode('${b.kode}')">Salin</button></div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-success btn-sm" onclick="editBarangKeKasir(${origIdx})">🛒 Beli (Kasir)</button>
              <button class="btn btn-primary btn-sm" onclick="editBarang(${origIdx})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteBarang(${origIdx})">Hapus</button>
            </div>
          </div>
        </td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgIdBarang}`, b.kode, { format: "CODE128", width: 2, height: 50, displayValue: true, fontSize: 14 }); } catch(err){}
    }, 50);
  });
}

function hapusBarangTerpilih() {
  const selected = document.querySelectorAll('.barang-checkbox:checked');
  if(selected.length === 0) {
    alert("Pilih minimal satu barang yang ingin dihapus!");
    return;
  }
  if(confirm(`Yakin ingin menghapus ${selected.length} barang terpilih?`)) {
    const indices = Array.from(selected).map(cb => parseInt(cb.value)).sort((a,b) => b-a);
    indices.forEach(idx => { barangList.splice(idx, 1); });
    saveDataToStorage();
    renderBarangTable();
    populateLaporanBarangSelect();
    updateDashboardStats();
    updateFinancialSummary();
    alert("Barang terpilih berhasil dihapus.");
  }
}

function toggleDetailBarang(idx) {
  const detailRow = document.getElementById(`barangDetailRow_${idx}`);
  const btn = document.getElementById(`btnDetail_${idx}`);
  if(detailRow.classList.contains('hidden')) {
    detailRow.classList.remove('hidden');
    btn.innerText = '❌ Tutup';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  } else {
    detailRow.classList.add('hidden');
    btn.innerText = '🔍 Detail';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
  }
}

function downloadBarangBarcodePNG(idx) {
  const barang = barangList[idx];
  if(!barang) return;
  const svgEl = document.getElementById(`tableBarcode_bar_${idx}`);
  if(!svgEl) return;

  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 300;
    canvas.height = img.height || 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    const a = document.createElement('a');
    a.download = `barcode_${barang.nama}_${barang.kode}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  img.src = url;
}

function editBarangKeKasir(idx) {
  showTab('kasirTab');
  setTimeout(() => {
    const b = barangList[idx];
    document.getElementById('kasirBarangInput').value = `${b.nama} (Stok: ${b.stok} ${b.satuan}) - Rp ${formatNumber(b.jual)}`;
    document.getElementById('selectedKasirBarangIndex').value = idx;
    onKasirBarangChange(idx);
  }, 100);
}

function editBarang(idx) {
  toggleForm('barangFormCard', 'barangToggleIcon');
  const b = barangList[idx];
  document.getElementById('barangEditIndex').value = idx;
  document.getElementById('barNama').value = b.nama;
  document.getElementById('barKode').value = b.kode;
  document.getElementById('barStok').value = b.stok;
  document.getElementById('barSatuan').value = b.satuan;
  document.getElementById('barExpired').value = b.expired || new Date().toISOString().split('T')[0];
  document.getElementById('barHargaModal').value = b.modal;
  document.getElementById('barHargaJual').value = b.jual;
}

function deleteBarang(idx) {
  if(confirm("Hapus barang ini?")) {
    barangList.splice(idx, 1);
    saveDataToStorage();
    renderBarangTable();
    populateLaporanBarangSelect();
    updateDashboardStats();
    updateFinancialSummary();
  }
}

function resetBarangForm() {
  document.getElementById('barangForm').reset();
  document.getElementById('barangEditIndex').value = "";
  toggleForm('barangFormCard', 'barangToggleIcon');
}

// KASBON BULK DELETE & CRUD
function toggleSelectAllKasbon(source) {
  const checkboxes = document.querySelectorAll('.kasbon-checkbox');
  checkboxes.forEach(cb => { cb.checked = source.checked; });
}

function saveKasbon(e) {
  e.preventDefault();
  const idx = document.getElementById('kasbonEditIndex').value;
  
  const newItem = {
    tanggal: document.getElementById('kasbonTgl').value,
    nama: document.getElementById('kasbonNama').value.trim(),
    telp: document.getElementById('kasbonTelp').value.trim(),
    alamat: document.getElementById('kasbonAlamat').value.trim(),
    status: document.getElementById('kasbonStatus').value
  };

  if(idx === "") {
    kasbonList.push(newItem);
  } else {
    kasbonList[idx] = newItem;
  }

  saveDataToStorage();
  renderKasbonTable();
  renderRiwayatTransaksi();
  populateKasbonDatalist();
  resetKasbonForm();

  const formCard = document.getElementById('kasbonFormCard');
  if(formCard && !formCard.classList.contains('collapsed')) {
    toggleForm('kasbonFormCard', 'kasbonToggleIcon');
  }

  alert("Data kasbon berhasil disimpan!");
}

function renderKasbonTable() {
  const tbody = document.getElementById('kasbonTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const selectAllCb = document.getElementById('selectAllKasbonCheckbox');
  if(selectAllCb) selectAllCb.checked = false;

  const keyword = (document.getElementById('searchKasbonInput')?.value || '').toLowerCase();
  const filtered = kasbonList.filter(k => k.nama.toLowerCase().includes(keyword) || (k.telp && k.telp.toLowerCase().includes(keyword)));

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Belum ada data kasbon.</td></tr>`;
    return;
  }

  filtered.forEach((k, idx) => {
    const origIdx = kasbonList.indexOf(k);
    
    const transaksiKasbon = transaksiList.filter(t => t.namaKasbon && t.namaKasbon.toLowerCase() === k.nama.toLowerCase());
    const jumlahTrx = transaksiKasbon.length;
    
    let totalBelanjaKasbon = transaksiKasbon.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    
    let sisaKurang = 0;
    let jumlahItemBelumLunas = 0;
    
    transaksiKasbon.forEach(t => {
      if (t.items && Array.isArray(t.items)) {
        t.items.forEach(item => {
          if (!item.isLunasItem) {
            sisaKurang += (parseFloat(item.subtotal) || 0);
            jumlahItemBelumLunas++;
          }
        });
      } else if (!t.isLunasKasbon) {
        sisaKurang += (parseFloat(t.total) || 0);
        jumlahItemBelumLunas++;
      }
    });

    let statusBadge = '';
    let infoKasbonBadge = '';

    if (jumlahTrx === 0) {
      statusBadge = `<span style="background: #f1f5f9; color: #64748b; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;">Tidak ada transaksi</span>`;
      infoKasbonBadge = `<br><span style="color: #94a3b8; font-size: 0.75rem;">(Belum ada transaksi kasbon)</span>`;
    } else {
      let isSemuaLunas = (sisaKurang === 0);
      k.status = isSemuaLunas ? 'Lunas' : 'Belum Lunas';

      if (isSemuaLunas) {
        statusBadge = `<span style="background: #dcfce7; color: #16a34a; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;">Lunas</span>`;
        infoKasbonBadge = `<br><span style="background: #dcfce7; color: #16a34a; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">📝 ${jumlahTrx} transaksi (Lunas Semua)</span>`;
      } else {
        statusBadge = `<span style="background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;">Belum Lunas (Sisa: Rp ${formatNumber(sisaKurang)})</span>`;
        infoKasbonBadge = `<br><span style="background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">📝 ${jumlahItemBelumLunas} item belum lunas (sisa: Rp ${formatNumber(sisaKurang)})</span>`;
      }
    }

    let listTrxHtml = '<div style="margin-top: 10px; font-size: 0.85rem;"><b>Rincian Transaksi & Ceklis Pelunasan per Item:</b><div style="margin-top: 8px; display: flex; flex-direction: column; gap: 8px;">';
    
    if(jumlahTrx > 0) {
      transaksiKasbon.forEach(t => {
        const globalTrxIdx = transaksiList.indexOf(t);
        
        if (t.items && Array.isArray(t.items)) {
          t.items.forEach((item, itemIdx) => {
            const isChecked = item.isLunasItem ? 'checked' : '';
            let detailItemText = `[${t.tanggal}] ${item.nama} (${item.qty}x) - Rp ${formatNumber(item.subtotal)}`;
            
            listTrxHtml += `<div style="background: #f8fafc; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; align-items: flex-start; gap: 10px;">
              <input type="checkbox" ${isChecked} onchange="toggleLunasItemKasbon(${globalTrxIdx}, ${itemIdx}, ${origIdx})" style="width: 18px; height: 18px; cursor: pointer; margin-top: 2px; flex-shrink: 0;">
              <div style="flex: 1; word-break: break-word;">
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 2px;">${detailItemText}</div>
                <div style="font-size: 0.75rem; color: #64748b;">Status Item: ${item.isLunasItem ? '<b style="color:#16a34a;">Lunas</b>' : '<b style="color:#dc2626;">Belum Lunas</b>'}</div>
              </div>
            </div>`;
          });
        }
      });
    } else {
      listTrxHtml += '<div style="color: #777; font-style: italic;">Tidak ada rincian item kasbon.</div>';
    }
    listTrxHtml += '</div></div>';

    tbody.innerHTML += `
      <tr id="kasbonRow_${origIdx}">
        <td style="text-align: center;">
          <input type="checkbox" class="kasbon-checkbox" value="${origIdx}" style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td>${idx + 1}</td>
        <td>${formatDateID(k.tanggal)}</td>
        <td><b>${k.nama}</b> ${infoKasbonBadge}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="toggleDetailKasbon(${origIdx})" id="btnDetailKasbon_${origIdx}">🔍 Detail</button>
          <button class="btn btn-primary btn-sm" onclick="editKasbon(${origIdx})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteKasbon(${origIdx})">Hapus</button>
        </td>
      </tr>
      <tr id="kasbonDetailRow_${origIdx}" class="hidden">
        <td colspan="6" style="padding: 0; background-color: #f8fafc;">
          <div style="padding: 15px 20px; border-left: 4px solid #4f46e5; background: #ffffff; margin: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; flex-wrap: wrap; gap: 20px; font-size: 0.9rem; align-items: center; line-height: 1.6; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
              <div><b>No. Telp / WhatsApp:</b> ${k.telp || '-'}</div>
              <div><b>Alamat Lengkap:</b> ${k.alamat || '-'}</div>
              <div><b>Total Belanja:</b> Rp ${formatNumber(totalBelanjaKasbon)}</div>
              <div><b>Sisa Kekurangan:</b> <span style="color: #dc2626; font-weight: bold;">Rp ${formatNumber(sisaKurang)}</span></div>
            </div>
            ${listTrxHtml}
          </div>
        </td>
      </tr>
    `;
  });
}

function hapusKasbonTerpilih() {
  const selected = document.querySelectorAll('.kasbon-checkbox:checked');
  if(selected.length === 0) {
    alert("Pilih minimal satu data kasbon yang ingin dihapus!");
    return;
  }
  if(confirm(`Yakin ingin menghapus ${selected.length} data kasbon terpilih?`)) {
    const indices = Array.from(selected).map(cb => parseInt(cb.value)).sort((a,b) => b-a);
    indices.forEach(idx => {
      const k = kasbonList[idx];
      if (k) {
        const namaKasbonTarget = k.nama.toLowerCase();
        transaksiList.forEach(t => {
          if (t.namaKasbon && t.namaKasbon.toLowerCase() === namaKasbonTarget) {
            const isAllItemsLunas = t.items && t.items.length > 0 && t.items.every(i => i.isLunasItem);
            const isLunas = t.isLunasKasbon || isAllItemsLunas;
            
            if (!isLunas) {
              if (t.items && Array.isArray(t.items)) {
                t.items.forEach(item => {
                  const b = barangList.find(x => x.kode === item.kode);
                  if(b) b.stok += item.qty;
                });
              }
            }
          }
        });
        transaksiList = transaksiList.filter(t => !t.namaKasbon || t.namaKasbon.toLowerCase() !== namaKasbonTarget);
      }
      kasbonList.splice(idx, 1);
    });
    saveDataToStorage();
    renderKasbonTable();
    renderRiwayatTransaksi();
    renderBarangTable();
    populateKasbonDatalist();
    updateDashboardStats();
    updateFinancialSummary();
    alert("Data kasbon terpilih dan transaksi terkait berhasil dihapus.");
  }
}

function toggleLunasItemKasbon(trxIndex, itemIndex, kasbonIdx) {
  if(transaksiList[trxIndex] && transaksiList[trxIndex].items && transaksiList[trxIndex].items[itemIndex]) {
    transaksiList[trxIndex].items[itemIndex].isLunasItem = !transaksiList[trxIndex].items[itemIndex].isLunasItem;
    
    const allLunas = transaksiList[trxIndex].items.every(i => i.isLunasItem);
    transaksiList[trxIndex].isLunasKasbon = allLunas;

    saveDataToStorage();
    renderKasbonTable();
    renderRiwayatTransaksi();
    
    const detailRow = document.getElementById(`kasbonDetailRow_${kasbonIdx}`);
    const btn = document.getElementById(`btnDetailKasbon_${kasbonIdx}`);
    if(detailRow && btn) {
      detailRow.classList.remove('hidden');
      btn.innerText = '❌ Tutup';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    }
  }
}

function toggleDetailKasbon(idx) {
  const detailRow = document.getElementById(`kasbonDetailRow_${idx}`);
  const btn = document.getElementById(`btnDetailKasbon_${idx}`);
  if(detailRow.classList.contains('hidden')) {
    detailRow.classList.remove('hidden');
    btn.innerText = '❌ Tutup';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
  } else {
    detailRow.classList.add('hidden');
    btn.innerText = '🔍 Detail';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
  }
}

function editKasbon(idx) {
  const k = kasbonList[idx];
  const formCard = document.getElementById('kasbonFormCard');
  if(formCard.classList.contains('collapsed')) {
    toggleForm('kasbonFormCard', 'kasbonToggleIcon');
  }
  document.getElementById('kasbonEditIndex').value = idx;
  document.getElementById('kasbonTgl').value = k.tanggal;
  document.getElementById('kasbonNama').value = k.nama;
  document.getElementById('kasbonTelp').value = k.telp;
  document.getElementById('kasbonAlamat').value = k.alamat;
  document.getElementById('kasbonStatus').value = k.status || 'Belum Lunas';
  document.getElementById('btnSimpanKasbon').innerText = "🔄 Perbarui Kasbon";
  document.getElementById('btnBatalEditKasbon').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteKasbon(idx) {
  const k = kasbonList[idx];
  if(!k) return;

  const transaksiKasbon = transaksiList.filter(t => t.namaKasbon && t.namaKasbon.toLowerCase() === k.nama.toLowerCase());
  let isSemuaLunas = true;
  
  if (transaksiKasbon.length > 0) {
    transaksiKasbon.forEach(t => {
      let sisaTrx = 0;
      if (t.items && Array.isArray(t.items)) {
        t.items.forEach(item => {
          if (!item.isLunasItem) sisaTrx += (parseFloat(item.subtotal) || 0);
        });
      } else if (!t.isLunasKasbon) {
        sisaTrx += (parseFloat(t.total) || 0);
      }
      if (sisaTrx > 0) isSemuaLunas = false;
    });
  } else {
    isSemuaLunas = false;
  }

  let pesanKonfirmasi = "";
  if (isSemuaLunas) {
    pesanKonfirmasi = `Yakin ingin menghapus data kasbon "${k.nama}"? Status kasbon sudah LUNAS. Semua transaksi penjualan terkait akan dihapus dari Data Transaksi tanpa pengembalian stok.`;
  } else {
    pesanKonfirmasi = `Yakin ingin menghapus data kasbon "${k.nama}"? Status kasbon BELUM LUNAS. Semua transaksi penjualan terkait akan dihapus dari Data Transaksi dan STOK AKAN DIKEMBALIKAN.`;
  }

  if(confirm(pesanKonfirmasi)) {
    const namaKasbonTarget = k.nama.toLowerCase();
    
    transaksiList.forEach(t => {
      if (t.namaKasbon && t.namaKasbon.toLowerCase() === namaKasbonTarget) {
        if (!isSemuaLunas) {
          if (t.items && Array.isArray(t.items)) {
            t.items.forEach(item => {
              const b = barangList.find(x => x.kode === item.kode);
              if(b) b.stok += item.qty;
            });
          }
        }
      }
    });

    transaksiList = transaksiList.filter(t => !t.namaKasbon || t.namaKasbon.toLowerCase() !== namaKasbonTarget);
    kasbonList.splice(idx, 1);

    saveDataToStorage();
    renderBarangTable();
    renderKasbonTable();
    renderRiwayatTransaksi();
    populateKasbonDatalist();
    updateDashboardStats();
    updateFinancialSummary();
    updateKasbonNotifications();

    alert("Data kasbon dan transaksi terkait berhasil dihapus.");
  }
}

function resetKasbonForm() {
  document.getElementById('kasbonForm').reset();
  document.getElementById('kasbonEditIndex').value = "";
  document.getElementById('kasbonTgl').value = new Date().toISOString().split('T')[0];
  document.getElementById('kasbonStatus').value = 'Belum Lunas';
  document.getElementById('btnSimpanKasbon').innerText = "✅ Simpan Kasbon";
  document.getElementById('btnBatalEditKasbon').classList.add('hidden');
}

function populateKasbonDatalist() {
  const datalist = document.getElementById('listKasbonNama');
  if(!datalist) return;
  datalist.innerHTML = '';
  kasbonList.forEach(k => {
    datalist.innerHTML += `<option value="${k.nama}">`;
  });
}

// TRANSAKSI BULK DELETE & OTHER FUNCTIONS
function toggleSelectAllTransaksi(source) {
  const checkboxes = document.querySelectorAll('.trx-checkbox');
  checkboxes.forEach(cb => { cb.checked = source.checked; });
}

function filterTransaksiByDateRange() {
  const tglDari = document.getElementById('trxTglDari').value;
  const tglSampai = document.getElementById('trxTglSampai').value;
  const keyword = (document.getElementById('searchTransaksiKeyword')?.value || '').toLowerCase().trim();

  currentFilteredTransaksi = transaksiList.filter(t => {
    let tglTrx = t.tanggalRaw;
    if (!tglTrx && t.tanggal) {
      const datePart = t.tanggal.split(',')[0].trim();
      const p = datePart.split('/');
      if (p.length === 3) {
        tglTrx = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      }
    }

    let matchTanggal = true;
    if (tglDari && tglSampai) {
      matchTanggal = tglTrx && tglTrx >= tglDari && tglTrx <= tglSampai;
    }

    let matchKeyword = true;
    if (keyword) {
      const matchNamaBarang = t.items.some(i => i.nama.toLowerCase().includes(keyword));
      const matchKasbon = t.namaKasbon && t.namaKasbon.toLowerCase().includes(keyword);
      matchKeyword = matchNamaBarang || matchKasbon;
    }

    return matchTanggal && matchKeyword;
  });

  if(tglDari && tglSampai) {
    document.getElementById('riwayatHeaderTitle').innerText = `📜 Riwayat Data Transaksi Penjualan (${formatDateID(tglDari)} s.d ${formatDateID(tglSampai)})`;
  } else {
    document.getElementById('riwayatHeaderTitle').innerText = "📜 Riwayat Data Transaksi Penjualan (Pencarian / Semua)";
  }
  renderRiwayatTransaksiFiltered();
}

function resetFilterTransaksi() {
  document.getElementById('trxTglDari').value = '';
  document.getElementById('trxTglSampai').value = '';
  const searchInput = document.getElementById('searchTransaksiKeyword');
  if(searchInput) searchInput.value = '';
  renderRiwayatTransaksi();
}

function renderRiwayatTransaksi() {
  currentFilteredTransaksi = [...transaksiList];
  document.getElementById('riwayatHeaderTitle').innerText = "📜 Riwayat Data Transaksi Penjualan (Semua)";
  renderRiwayatTransaksiFiltered();
}

function renderRiwayatTransaksiFiltered() {
  const tbody = document.getElementById('riwayatTransaksiTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  
  const selectAllCb = document.getElementById('selectAllTrxCheckbox');
  if(selectAllCb) selectAllCb.checked = false;

  if(currentFilteredTransaksi.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #777;">Tidak ada data transaksi untuk kategori ini.</td></tr>`;
    return;
  }

  let totalKeseluruhan = 0;

  currentFilteredTransaksi.forEach((t, idx) => {
    const originalIndex = transaksiList.indexOf(t);
    const namaBarangUtama = t.items.map((i, iIdx) => `${iIdx + 1}. ${i.nama} (${i.qty}x)`).join('<br>');
    
    let namaKasbonDisplay = '-';
    if (t.namaKasbon && t.namaKasbon.trim() !== '') {
      const isAllItemsLunas = t.items && t.items.length > 0 && t.items.every(i => i.isLunasItem);
      const statusTrxKasbon = (t.isLunasKasbon || isAllItemsLunas) ? 'Lunas' : 'Belum Lunas';
      
      if (statusTrxKasbon === 'Lunas') {
        namaKasbonDisplay = `<b>${t.namaKasbon}</b> <br><span style="background: #dcfce7; color: #16a34a; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">(Lunas)</span>`;
      } else {
        namaKasbonDisplay = `<b>${t.namaKasbon}</b> <br><span style="background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">(Belum Lunas)</span>`;
      }
    }

    totalKeseluruhan += t.total;
    
    tbody.innerHTML += `
      <tr style="vertical-align: middle;">
        <td class="no-print" style="text-align: center;">
          <input type="checkbox" class="trx-checkbox" value="${originalIndex}" style="width: 16px; height: 16px; cursor: pointer;">
        </td>
        <td>${idx + 1}</td>
        <td style="line-height: 1.6; padding: 10px;"><b>${namaBarangUtama}</b></td>
        <td style="text-align: center;">${namaKasbonDisplay}</td>
        <td>${t.tanggal}</td>
        <td>${t.items.length} item</td>
        <td>Rp ${formatNumber(t.total)}</td>
        <td class="no-print">
          <button class="btn btn-secondary btn-sm" onclick="bukaModalCetakNota(${originalIndex})">🖨️ Cetak</button>
          <button class="btn btn-primary btn-sm" onclick="editTransaksi(${originalIndex})">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTransaksi(${originalIndex})">🗑️ Hapus</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML += `
    <tr style="background-color: #f1f5f9; font-weight: bold;">
      <td colspan="6" style="text-align: right;">TOTAL KESELURUHAN:</td>
      <td colspan="2" style="color: #0f172a; font-weight: bold;">Rp ${formatNumber(totalKeseluruhan)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td colspan="8">
        <div style="font-size: 0.9rem; color: #334155; padding: 5px 0;">
          <b>Terbilang:</b> <i>${getTerbilangRupiah(totalKeseluruhan)}</i>
        </div>
      </td>
    </tr>
  `;
}

function hapusTransaksiTerpilih() {
  const selectedCheckboxes = document.querySelectorAll('.trx-checkbox:checked');
  if(selectedCheckboxes.length === 0) {
    alert("Pilih minimal satu transaksi yang ingin dihapus dengan mencentang kotak di tabel!");
    return;
  }

  if(confirm(`Yakin ingin menghapus ${selectedCheckboxes.length} transaksi yang dipilih? Stok barang dari transaksi tersebut akan dikembalikan.`)) {
    const indicesToDelete = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
    indicesToDelete.sort((a, b) => b - a);

    indicesToDelete.forEach(idx => {
      const t = transaksiList[idx];
      if(t && t.items) {
        t.items.forEach(item => {
          const b = barangList.find(x => x.kode === item.kode);
          if(b) b.stok += item.qty;
        });
      }
      transaksiList.splice(idx, 1);
    });

    saveDataToStorage();
    renderRiwayatTransaksi();
    renderBarangTable();
    renderKasbonTable();
    updateDashboardStats();
    updateFinancialSummary();
    alert("Transaksi terpilih berhasil dihapus dan stok dikembalikan.");
  }
}

// SCANNER, KASIR, LAPORAN, PROFIL LAINNYA
function playBeepSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 850;
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch(e) {}
}

function switchMode(mode) {
  const btnCamera = document.getElementById('btnTabCamera');
  const btnUpload = document.getElementById('btnTabUpload');
  const camSec = document.getElementById('cameraSection');
  const upSec = document.getElementById('uploadSection');

  if(mode === 'camera') {
    btnCamera.classList.add('active');
    btnUpload.classList.remove('active');
    camSec.classList.remove('hidden');
    upSec.classList.add('hidden');
    initScannerCamera();
  } else {
    btnUpload.classList.add('active');
    btnCamera.classList.remove('active');
    upSec.classList.remove('hidden');
    camSec.classList.add('hidden');
    if(html5QrCode) {
      try { html5QrCode.stop(); } catch(e){}
    }
  }
}

function initScannerCamera() {
  if(!document.getElementById('reader')) return;
  if(!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }
  const config = { fps: 10, qrbox: { width: 250, height: 150 } };

  html5QrCode.start(
    { facingMode: "environment" }, 
    config, 
    (decodedText) => {
      const currentTime = Date.now();
      if (decodedText === lastScannedCode && (currentTime - lastScannedTime < 2500)) return;
      lastScannedCode = decodedText;
      lastScannedTime = currentTime;

      document.getElementById('scanResultCode').value = decodedText;
      document.getElementById('scannerStatus').innerText = `Berhasil Scan: ${decodedText}`;
      
      cariProdukByBarcodeScanner(decodedText);
      setTimeout(() => {
        if (selectedProdukAktif) {
          playBeepSound();
          tambahKeKeranjangScanner();
        }
      }, 100);
    },
    (errorMessage) => {}
  ).catch(err => {
    const statusEl = document.getElementById('scannerStatus');
    if(statusEl) statusEl.innerText = "Kamera tidak aktif / gunakan mode Unggah Gambar.";
  });
}

function scanImageFromFile(e) {
  const file = e.target.files[0];
  if(!file) return;

  const statusEl = document.getElementById('uploadStatus');
  statusEl.innerText = "Membaca gambar barcode...";

  const qrScanner = new Html5Qrcode("reader");
  qrScanner.scanFile(file, true)
    .then(decodedText => {
      document.getElementById('scanResultCode').value = decodedText;
      statusEl.innerText = `Berhasil membaca barcode: ${decodedText}`;
      cariProdukByBarcodeScanner(decodedText);
      setTimeout(() => {
        if (selectedProdukAktif) {
          playBeepSound();
          tambahKeKeranjangScanner();
        }
      }, 100);
    })
    .catch(err => {
      statusEl.innerText = "Gagal mendeteksi barcode dari gambar.";
    });
}

// SCAN LABEL / SALIN BARCODE MANUAL
function previewScanLabelManual(val) {
  const cleanVal = val.trim();
  const svgEl = document.getElementById('svgScanLabelPreview');
  const placeholder = document.getElementById('svgScanLabelPlaceholder');

  if (cleanVal.length > 0) {
    placeholder.classList.add('hidden');
    try {
      JsBarcode("#svgScanLabelPreview", cleanVal, { format: "CODE128", width: 2.5, height: 75, displayValue: true, fontSize: 16 });
    } catch(e) {}

    const found = barangList.find(b => b.kode.toLowerCase() === cleanVal.toLowerCase() || b.nama.toLowerCase().includes(cleanVal.toLowerCase()));
    if (found) {
      document.getElementById('labelInfoNama').innerText = found.nama;
      document.getElementById('labelInfoStok').innerText = `${found.stok} ${found.satuan}`;
      document.getElementById('labelInfoHarga').innerText = `Rp ${formatNumber(found.jual)}`;
      document.getElementById('labelInfoKode').innerText = found.kode;
    } else {
      document.getElementById('labelInfoNama').innerText = "Barang tidak ditemukan di database stok";
      document.getElementById('labelInfoStok').innerText = "-";
      document.getElementById('labelInfoHarga').innerText = "-";
      document.getElementById('labelInfoKode').innerText = cleanVal;
    }
  } else {
    svgEl.innerHTML = "";
    placeholder.classList.remove('hidden');
    document.getElementById('labelInfoNama').innerText = "-";
    document.getElementById('labelInfoStok').innerText = "-";
    document.getElementById('labelInfoHarga').innerText = "-";
    document.getElementById('labelInfoKode').innerText = "-";
  }
}

function salinTeksBarcodeManual() {
  const inputEl = document.getElementById('inputScanLabelManual');
  const val = inputEl.value.trim();
  if (!val) {
    alert("Masukkan kode atau nama barcode terlebih dahulu!");
    return;
  }
  navigator.clipboard.writeText(val).then(() => {
    alert(`Kode barcode "${val}" berhasil disalin ke clipboard!`);
  });
}

function cariProdukByBarcodeScanner(code) {
  const cleanCode = code.trim().toLowerCase();
  const infoCard = document.getElementById('productDetailInfo');
  const notFoundText = document.getElementById('productNotFound');

  if(!cleanCode) {
    infoCard.classList.add('hidden');
    notFoundText.classList.add('hidden');
    selectedProdukAktif = null;
    return;
  }

  const found = barangList.find(b => b.kode.toLowerCase() === cleanCode || b.nama.toLowerCase() === cleanCode);

  if(found) {
    selectedProdukAktif = found;
    document.getElementById('infoNama').innerText = found.nama;
    
    let stokBadgeHtml = '';
    if (found.stok > 2) {
      stokBadgeHtml = `<span class="badge-safe">${found.stok} ${found.satuan} (Aman)</span>`;
    } else if (found.stok > 0) {
      stokBadgeHtml = `<span class="badge-warning">${found.stok} ${found.satuan} (Menipis)</span>`;
    } else {
      stokBadgeHtml = `<span class="badge-expired">Habis (0 ${found.satuan})</span>`;
    }
    document.getElementById('infoStok').innerHTML = stokBadgeHtml;
    document.getElementById('infoHarga').innerText = `Rp ${formatNumber(found.jual)}`;
    document.getElementById('scanQty').value = 1;

    const statusExpEl = document.getElementById('infoStatusKadaluarsa');
    if(found.expired) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const expDate = new Date(found.expired);
      expDate.setHours(0,0,0,0);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      const formattedExp = formatDateID(found.expired);

      if(diffDays < 0) {
        statusExpEl.innerHTML = `<span class="badge-expired">Kadaluarsa (${formattedExp})</span>`;
      } else if(diffDays <= 15) {
        statusExpEl.innerHTML = `<span class="badge-warning">Mendekati Expired: ${formattedExp} (${diffDays} hari lagi)</span>`;
      } else {
        statusExpEl.innerHTML = `<span class="badge-safe">Aman (${formattedExp})</span>`;
      }
    } else {
      statusExpEl.innerHTML = `<span class="badge-safe">Aman (Tanpa Tanggal Exp)</span>`;
    }

    infoCard.classList.remove('hidden');
    notFoundText.classList.add('hidden');
  } else {
    selectedProdukAktif = null;
    infoCard.classList.add('hidden');
    notFoundText.classList.remove('hidden');
  }
}

function tambahKeKeranjangScanner() {
  if(!selectedProdukAktif) return;
  const qty = parseInt(document.getElementById('scanQty').value) || 1;
  if(qty <= 0) return;

  const existing = keranjangScanner.find(k => k.kode === selectedProdukAktif.kode);
  let currentQtyInCart = existing ? existing.qty : 0;

  if(currentQtyInCart + qty > selectedProdukAktif.stok) {
    alert("Melebihi stok tersedia!");
    return;
  }

  if(existing) {
    existing.qty += qty;
    existing.subtotal = existing.qty * existing.hargaJual;
  } else {
    keranjangScanner.push({
      kode: selectedProdukAktif.kode,
      nama: selectedProdukAktif.nama,
      hargaJual: selectedProdukAktif.jual,
      qty: qty,
      subtotal: selectedProdukAktif.jual * qty
    });
  }

  renderKeranjangScanner();
  document.getElementById('scanResultCode').value = "";
  document.getElementById('productDetailInfo').classList.add('hidden');
  selectedProdukAktif = null;
}

function renderKeranjangScanner() {
  const tbody = document.getElementById('keranjangScannerTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  let total = 0;

  if(keranjangScanner.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #777;">Keranjang kosong.</td></tr>`;
    if(document.getElementById('scannerTotalDisplay')) {
      document.getElementById('scannerTotalDisplay').innerText = `Rp 0`;
    }
    hitungKembalianScanner();
    return;
  }

  keranjangScanner.forEach((item, idx) => {
    total += item.subtotal;
    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${item.nama}</b></td>
        <td>Rp ${formatNumber(item.hargaJual)}</td>
        <td>
          <input type="number" class="form-control" style="width: 80px; padding: 4px 8px;" value="${item.qty}" min="1" 
            oninput="updateQtyScanner(${idx}, this.value)">
        </td>
        <td>Rp ${formatNumber(item.subtotal)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="hapusItemScan(${idx})">Hapus</button></td>
      </tr>
    `;
  });

  if(document.getElementById('scannerTotalDisplay')) {
    document.getElementById('scannerTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
  }
  hitungKembalianScanner();
}

function updateQtyScanner(idx, value) {
  const newQty = parseInt(value) || 0;
  if(newQty <= 0) return;
  const item = keranjangScanner[idx];
  const barang = barangList.find(b => b.kode === item.kode);
  if(barang && newQty > barang.stok) {
    alert("Stok tidak mencukupi!");
    renderKeranjangScanner();
    return;
  }
  item.qty = newQty;
  item.subtotal = item.qty * item.hargaJual;
  renderKeranjangScanner();
}

function hapusItemScan(idx) {
  keranjangScanner.splice(idx, 1);
  renderKeranjangScanner();
}

function hitungKembalianScanner() {
  let total = keranjangScanner.reduce((sum, item) => sum + item.subtotal, 0);
  let bayar = parseFloat(document.getElementById('scannerBayar').value) || 0;
  let kembalian = bayar - total;
  document.getElementById('scannerKembalianDisplay').innerText = kembalian >= 0 ? `Rp ${formatNumber(kembalian)}` : `Rp 0`;
}

function selesaikanTransaksiScanner() {
  if(keranjangScanner.length === 0) {
    alert("Keranjang kosong!");
    return;
  }
  let total = keranjangScanner.reduce((sum, item) => sum + item.subtotal, 0);
  let bayar = parseFloat(document.getElementById('scannerBayar').value) || 0;
  let namaKasbonInput = document.getElementById('scannerNamaKasbon').value.trim();

  if(bayar < total) {
    alert("Pembayaran kurang!");
    return;
  }

  keranjangScanner.forEach(item => {
    const b = barangList.find(x => x.kode === item.kode);
    if(b) {
      b.stok -= item.qty;
      if(b.stok < 0) b.stok = 0;
    }
  });

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const tanggalRaw = `${yyyy}-${mm}-${dd}`;

  const itemsWithLunas = keranjangScanner.map(i => ({ ...i, isLunasItem: false }));

  const transaksiBaru = {
    id: 'TRX-' + Date.now(),
    tanggalRaw: tanggalRaw,
    tanggal: now.toLocaleString('id-ID'),
    namaKasbon: namaKasbonInput,
    items: itemsWithLunas,
    total: total,
    bayar: bayar,
    kembalian: bayar - total,
    isLunasKasbon: false
  };

  transaksiList.push(transaksiBaru);

  if (namaKasbonInput !== '') {
    const existingKasbon = kasbonList.find(k => k.nama.toLowerCase() === namaKasbonInput.toLowerCase());
    if (!existingKasbon) {
      kasbonList.push({
        tanggal: tanggalRaw,
        nama: namaKasbonInput,
        telp: '',
        alamat: '',
        status: 'Belum Lunas'
      });
    }
  }

  saveDataToStorage();
  renderBarangTable();
  renderRiwayatTransaksi();
  renderKasbonTable();
  populateKasbonDatalist();
  updateDashboardStats();
  updateFinancialSummary();
  updateKasbonNotifications();

  alert("Transaksi scanner berhasil diselesaikan!");
  keranjangScanner = [];
  document.getElementById('scannerBayar').value = "";
  document.getElementById('scannerNamaKasbon').value = "";
  renderKeranjangScanner();
  showTab('transaksiTab');
}

function salinNomorBarcode(kode) {
  if (!kode) return;
  navigator.clipboard.writeText(kode).then(() => {
    alert(`Nomor barcode "${kode}" disalin ke clipboard!`);
  });
}

async function exportDataApp() {
  const dataToExport = {
    appVersion: "1.0",
    exportDate: new Date().toISOString(),
    barangList, pengeluaranList, transaksiList, kasbonList, adminCreds, tokoProfile
  };
  const jsonString = JSON.stringify(dataToExport, null, 2);
  const now = new Date();
  const suggestedName = `backup_sembako_${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()}.json`;

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName, types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      alert("Data berhasil diekspor!");
      return;
    } catch (err) { if (err.name === 'AbortError') return; }
  }

  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  alert("Data berhasil diekspor!");
}

function importDataApp() {
  const fileInput = document.getElementById('importFileJson');
  const file = fileInput.files[0];
  if(!file) { alert("Pilih file backup (.json)!"); return; }

  if(confirm("Impor data akan menimpa data saat ini. Lanjutkan?")) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if(data.barangList) barangList = data.barangList;
        if(data.pengeluaranList) pengeluaranList = data.pengeluaranList;
        if(data.transaksiList) transaksiList = data.transaksiList;
        if(data.kasbonList) kasbonList = data.kasbonList;
        if(data.adminCreds) adminCreds = data.adminCreds;
        if(data.tokoProfile) tokoProfile = data.tokoProfile;

        saveDataToStorage();
        loadProfilData();
        renderBarangTable();
        renderPengeluaranTable();
        renderRiwayatTransaksi();
        renderKasbonTable();
        populateBarangDatalist();
        populateKasbonDatalist();
        populateLaporanBarangSelect();
        updateDashboardStats();
        updateFinancialSummary();
        alert("Pemulihan data berhasil!");
      } catch(err) { alert("Format file JSON tidak valid!"); }
    };
    reader.readAsText(file);
  }
}

function previewLiveBarcode() {
  const code = document.getElementById('pengBarcodeCode').value.trim();
  if(code) {
    try { JsBarcode("#liveBarcodeSvg", code, { format: "CODE128", width: 2.5, height: 75, displayValue: true, fontSize: 16 }); } catch(e){}
  } else {
    document.getElementById('liveBarcodeSvg').innerHTML = "";
  }
}

function populateBarangDatalist() {
  const datalist = document.getElementById('listPengeluaranBarang');
  if(!datalist) return;
  datalist.innerHTML = '';
  pengeluaranList.forEach(p => { datalist.innerHTML += `<option value="${p.keterangan}"></option>`; });
}

function onInputBarangNama(val) {
  const cleanVal = val.trim().toLowerCase();
  const matched = pengeluaranList.find(p => p.keterangan.toLowerCase() === cleanVal);
  if(matched) {
    document.getElementById('barKode').value = matched.barcode;
    document.getElementById('barHargaModal').value = matched.modal;
    document.getElementById('barHargaJual').value = matched.jual;
  } else {
    document.getElementById('barKode').value = '';
    document.getElementById('barHargaModal').value = '';
    document.getElementById('barHargaJual').value = '';
  }
}

function onKetikCariBarang() {
  const keyword = document.getElementById('kasirBarangInput').value.toLowerCase().trim();
  const dropdown = document.getElementById('autocompleteDropdown');
  if(keyword === "") {
    dropdown.innerHTML = "";
    dropdown.classList.add('hidden');
    document.getElementById('selectedKasirBarangIndex').value = "";
    onKasirBarangChange("");
    return;
  }

  const filtered = barangList.map((b, idx) => ({ ...b, originalIndex: idx })).filter(b => 
    b.nama.toLowerCase().includes(keyword) || b.kode.toLowerCase().includes(keyword)
  );

  if(filtered.length === 0) {
    dropdown.innerHTML = `<div class="autocomplete-item" style="color: #94a3b8; cursor: default;">Barang tidak ditemukan</div>`;
    dropdown.classList.remove('hidden');
    return;
  }

  let html = "";
  filtered.forEach(item => {
    html += `<div class="autocomplete-item" onclick="pilihItemAutocomplete(${item.originalIndex})">
      <b>${item.nama}</b> (Stok: ${item.stok} ${item.satuan}) - Rp ${formatNumber(item.jual)} [Kode: ${item.kode}]
    </div>`;
  });
  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

function pilihItemAutocomplete(idx) {
  const barang = barangList[idx];
  document.getElementById('kasirBarangInput').value = `${barang.nama} (Stok: ${barang.stok} ${barang.satuan}) - Rp ${formatNumber(barang.jual)}`;
  document.getElementById('selectedKasirBarangIndex').value = idx;
  document.getElementById('autocompleteDropdown').classList.add('hidden');
  document.getElementById('kasirQty').value = 1;
  onKasirBarangChange(idx);
}

function onKasirBarangChange(idx) {
  const previewArea = document.getElementById('kasirBarcodePreviewArea');
  const placeholder = document.getElementById('kasirBarcodePlaceholder');

  if(idx !== "" && idx !== undefined && barangList[idx]) {
    const barang = barangList[idx];
    currentSelectedKasirBarcode = barang.kode;
    previewArea.classList.remove('hidden');
    placeholder.classList.add('hidden');
    try { JsBarcode("#kasirBarcodeSvg", barang.kode, { format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14 }); } catch(e){}
  } else {
    currentSelectedKasirBarcode = "";
    previewArea.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}

function downloadKasirBarcodePNG() {
  if(!currentSelectedKasirBarcode) return;
  const svgEl = document.getElementById('kasirBarcodeSvg');
  if(!svgEl) return;
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 300; canvas.height = img.height || 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement('a');
    a.download = `barcode_${currentSelectedKasirBarcode}.png`;
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  };
  img.src = url;
}

function tambahItemKeranjang() {
  const idx = document.getElementById('selectedKasirBarangIndex').value;
  const qty = parseInt(document.getElementById('kasirQty').value) || 0;
  if(idx === "" || idx === undefined || qty <= 0 || !barangList[idx]) {
    alert("Pilih barang dan masukkan jumlah yang valid!");
    return;
  }

  const barang = barangList[idx];
  if(qty > barang.stok) { alert("Stok tidak mencukupi!"); return; }

  const existing = keranjangList.find(k => k.kode === barang.kode);
  if(existing) {
    if(existing.qty + qty > barang.stok) { alert("Melebihi stok!"); return; }
    existing.qty += qty;
    existing.subtotal = existing.qty * existing.hargaJual;
  } else {
    keranjangList.push({
      kode: barang.kode, nama: barang.nama, hargaJual: barang.jual, qty, subtotal: barang.jual * qty
    });
  }

  renderKeranjang();
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
  document.getElementById('kasirQty').value = 1;
  document.getElementById('kasirBarcodePreviewArea').classList.add('hidden');
  document.getElementById('kasirBarcodePlaceholder').classList.remove('hidden');
  currentSelectedKasirBarcode = "";
}

function renderKeranjang() {
  const tbody = document.getElementById('keranjangTbody');
  if(!tbody) return;
  tbody.innerHTML = "";
  let total = 0;

  if(keranjangList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Keranjang kosong.</td></tr>`;
    if(document.getElementById('kasirTotalDisplay')) document.getElementById('kasirTotalDisplay').innerText = `Rp 0`;
    return;
  }

  const isEditing = document.getElementById('transaksiEditIndex').value !== "";

  keranjangList.forEach((item, idx) => {
    total += item.subtotal;
    const svgId = `keranjangBarcode_${idx}`;
    const editBadgeLabel = isEditing ? `<span class="badge-edit-mode">Mode Edit</span>` : '';

    tbody.innerHTML += `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.nama} ${editBadgeLabel}</td>
        <td><svg id="${svgId}" class="table-barcode-svg"></svg></td>
        <td>Rp ${formatNumber(item.hargaJual)}</td>
        <td>
          <input type="number" class="form-control" style="width: 80px; padding: 4px 8px;" value="${item.qty}" min="1" 
            oninput="updateQtyKeranjang(${idx}, this.value)">
        </td>
        <td>Rp ${formatNumber(item.subtotal)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="hapusItemKeranjang(${idx})">Hapus</button></td>
      </tr>
    `;
    setTimeout(() => {
      try { JsBarcode(`#${svgId}`, item.kode, { format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 12 }); } catch(err){}
    }, 50);
  });

  if(document.getElementById('kasirTotalDisplay')) {
    document.getElementById('kasirTotalDisplay').innerText = `Rp ${formatNumber(total)}`;
  }
  hitungKembalian();
}

function updateQtyKeranjang(idx, value) {
  const newQty = parseInt(value) || 0;
  if(newQty <= 0) return;
  const item = keranjangList[idx];
  const barang = barangList.find(b => b.kode === item.kode);
  if(barang && newQty > barang.stok) { alert("Stok tidak mencukupi!"); renderKeranjang(); return; }
  item.qty = newQty;
  item.subtotal = item.qty * item.hargaJual;
  renderKeranjang();
}

function hapusItemKeranjang(idx) {
  keranjangList.splice(idx, 1);
  renderKeranjang();
}

function hitungKembalian() {
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  let bayarInput = document.getElementById('kasirBayar').value;
  let bayar = parseFloat(bayarInput) || 0;

  if (bayar > 0 && bayar < total && bayarInput.length <= 2) {
    if ((bayar * 1000) >= total) bayar = bayar * 1000;
  }

  let kembalian = bayar - total;
  document.getElementById('kasirKembalianDisplay').innerText = kembalian >= 0 ? `Rp ${formatNumber(kembalian)}` : `Rp 0`;
}

function prosesPembayaran() {
  if(keranjangList.length === 0) { alert("Keranjang kosong!"); return; }
  let total = keranjangList.reduce((sum, item) => sum + item.subtotal, 0);
  let bayarInput = document.getElementById('kasirBayar').value;
  let bayar = parseFloat(bayarInput) || 0;
  
  if (bayar > 0 && bayar < total && bayarInput.length <= 2) {
    if ((bayar * 1000) >= total) bayar = bayar * 1000;
  }

  if(bayar < total) { alert("Pembayaran kurang!"); return; }

  const editIdx = document.getElementById('transaksiEditIndex').value;
  const namaKasbonInput = document.getElementById('kasirNamaKasbon').value.trim();

  keranjangList.forEach(item => {
    const b = barangList.find(x => x.kode === item.kode);
    if(b) {
      b.stok -= item.qty;
      if(b.stok < 0) b.stok = 0;
    }
  });

  let trxId = '';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  let tanggalRaw = `${yyyy}-${mm}-${dd}`;
  let tanggalStr = now.toLocaleString('id-ID');

  let existingItemsStatus = [];
  if(editIdx !== "") {
    trxId = transaksiList[editIdx].id;
    tanggalRaw = transaksiList[editIdx].tanggalRaw || tanggalRaw;
    tanggalStr = transaksiList[editIdx].tanggal;
    
    if (transaksiList[editIdx].items) {
      existingItemsStatus = transaksiList[editIdx].items;
    }
    transaksiList.splice(editIdx, 1);
  } else {
    trxId = 'TRX-' + Date.now();
  }

  const itemsWithLunas = keranjangList.map((item, idx) => {
    let isLunas = false;
    if (existingItemsStatus[idx] && existingItemsStatus[idx].kode === item.kode) {
      isLunas = existingItemsStatus[idx].isLunasItem || false;
    }
    return { ...item, isLunasItem: isLunas };
  });

  const allItemsLunas = itemsWithLunas.every(i => i.isLunasItem);

  const transaksi = {
    id: trxId, tanggalRaw, tanggal: tanggalStr, namaKasbon: namaKasbonInput,
    items: itemsWithLunas, total, bayar, kembalian: bayar - total, isLunasKasbon: allItemsLunas
  };

  transaksiList.push(transaksi);

  if (namaKasbonInput !== '') {
    const existingKasbon = kasbonList.find(k => k.nama.toLowerCase() === namaKasbonInput.toLowerCase());
    if (!existingKasbon) {
      kasbonList.push({
        tanggal: tanggalRaw,
        nama: namaKasbonInput,
        telp: '',
        alamat: '',
        status: 'Belum Lunas'
      });
    }
  }

  saveDataToStorage();
  renderBarangTable();
  renderRiwayatTransaksi();
  renderKasbonTable();
  populateKasbonDatalist();
  resetKasirForm();
  updateDashboardStats();
  updateFinancialSummary();
  updateKasbonNotifications();

  alert("Transaksi berhasil disimpan dan diperbarui!");
  showTab('transaksiTab');
}

function resetKasirForm() {
  keranjangList = [];
  document.getElementById('transaksiEditIndex').value = "";
  document.getElementById('kasirBarangInput').value = "";
  document.getElementById('selectedKasirBarangIndex').value = "";
  document.getElementById('kasirNamaKasbon').value = "";
  document.getElementById('kasirBayar').value = "";
  document.getElementById('kasirFormTitle').innerText = "🛒 Kasir Penjualan Toko Sembako";
  document.getElementById('btnSimpanTransaksi').innerText = "✅ Selesaikan Transaksi";
  document.getElementById('btnBatalEditTransaksi').classList.add('hidden');
  document.getElementById('kasirBarcodePreviewArea').classList.add('hidden');
  document.getElementById('kasirBarcodePlaceholder').classList.remove('hidden');
  currentSelectedKasirBarcode = "";
  renderKeranjang();
}

function batalEditTransaksi() {
  resetKasirForm();
  showTab('transaksiTab');
}

function cetakDataTransaksiTerfilter() { window.print(); }

function bukaModalCetakNota(idx) {
  const t = transaksiList[idx];
  let itemsHtml = '';
  t.items.forEach(i => {
    itemsHtml += `<tr><td colspan="2" style="padding-top: 4px;"><b>${i.nama}</b></td></tr>
      <tr><td>${i.qty} PCS x ${formatNumber(i.hargaJual)}</td><td style="text-align: right;">${formatNumber(i.subtotal)}</td></tr>`;
  });

  let kasbonReceiptHtml = (t.namaKasbon && t.namaKasbon.trim() !== '') ? `<div style="font-size: 0.75rem; margin-bottom: 5px;"><span>Kasbon : ${t.namaKasbon}</span></div>` : '';

  let strukHtml = `
    <div class="receipt-header">
      <h4>${tokoProfile.nama}</h4>
      <p>${tokoProfile.alamat}</p>
      <p>Telp: ${tokoProfile.telp}</p>
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-info" style="font-size: 0.75rem; margin-bottom: 5px;">
      <span>Tgl : ${t.tanggal}</span><br><span>Kasir : admin</span><br><span>Struk : #${t.id || (idx + 1)}</span>
    </div>
    ${kasbonReceiptHtml}
    <div class="receipt-divider"></div>
    <table class="receipt-items-table"><tbody>${itemsHtml}</tbody></table>
    <div class="receipt-divider"></div>
    <div class="receipt-totals">
      <div class="row"><span>TOTAL :</span> <b>Rp ${formatNumber(t.total)}</b></div>
      <div class="row"><span>TUNAI :</span> <span>Rp ${formatNumber(t.bayar)}</span></div>
      <div class="row"><span>KEMBALI :</span> <span>Rp ${formatNumber(t.kembalian)}</span></div>
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-footer">
      <p>${tokoProfile.notes}</p>
      <p>LAYANAN KONSUMEN: ${tokoProfile.telp}</p>
      <p style="margin-top: 5px;">Terima Kasih & Selamat Belanja Kembali</p>
    </div>
  `;

  document.getElementById('printReceiptContent').innerHTML = strukHtml;
  document.getElementById('printModalOverlay').classList.remove('hidden');
}

function closePrintModal() { document.getElementById('printModalOverlay').classList.add('hidden'); }
function triggerWindowPrint() { window.print(); }

function editTransaksi(idx) {
  const t = transaksiList[idx];
  if(confirm(`Edit transaksi ini? Item akan dimuat ke Kasir.`)) {
    t.items.forEach(item => {
      const b = barangList.find(x => x.kode === item.kode);
      if(b) b.stok += item.qty;
    });

    keranjangList = t.items.map(i => ({ ...i }));
    showTab('kasirTab');
    
    document.getElementById('transaksiEditIndex').value = idx;
    document.getElementById('kasirBayar').value = t.bayar;
    document.getElementById('kasirNamaKasbon').value = t.namaKasbon || '';
    document.getElementById('kasirFormTitle').innerText = `✏️ Edit Transaksi Penjualan`;
    document.getElementById('btnSimpanTransaksi').innerText = "🔄 Perbarui Transaksi";
    document.getElementById('btnBatalEditTransaksi').classList.add('hidden');
    
    setTimeout(() => { renderKeranjang(); }, 50);
  }
}

function deleteTransaksi(idx) {
  if(confirm("Hapus transaksi ini?")) {
    const t = transaksiList[idx];
    t.items.forEach(item => {
      const b = barangList.find(x => x.kode === item.kode);
      if(b) b.stok += item.qty;
    });

    transaksiList.splice(idx, 1);
    saveDataToStorage();
    renderRiwayatTransaksi();
    renderBarangTable();
    renderKasbonTable();
    updateDashboardStats();
    updateFinancialSummary();
    alert("Transaksi dihapus dan stok dikembalikan.");
  }
}

function populateLaporanBarangSelect() {
  const select = document.getElementById('laporanBarangSelect');
  if(!select) return;
  select.innerHTML = '<option value="">-- Semua Barang --</option>';
  barangList.forEach(b => { select.innerHTML += `<option value="${b.nama}">${b.nama}</option>`; });
}

function terbilang(nilai) {
  nilai = Math.abs(nilai);
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let temp = "";
  if (nilai < 12) temp = " " + angka[nilai];
  else if (nilai < 20) temp = terbilang(nilai - 10) + " Belas";
  else if (nilai < 100) temp = terbilang(Math.floor(nilai / 10)) + " Puluh" + terbilang(nilai % 10);
  else if (nilai < 200) temp = " Seratus" + terbilang(nilai - 100);
  else if (nilai < 1000) temp = terbilang(Math.floor(nilai / 100)) + " Ratus" + terbilang(nilai % 100);
  else if (nilai < 2000) temp = " Seribu" + terbilang(nilai - 1000);
  else if (nilai < 1000000) temp = terbilang(Math.floor(nilai / 1000)) + " Ribu" + terbilang(nilai % 1000);
  else if (nilai < 1000000000) temp = terbilang(Math.floor(nilai / 1000000)) + " Juta" + terbilang(nilai % 1000000);
  return temp;
}

function getTerbilangRupiah(nominal) {
  if (nominal === 0) return "Nol Rupiah";
  return terbilang(nominal).trim() + " Rupiah";
}

function filterLaporan() {
  const namaBarang = document.getElementById('laporanBarangSelect').value;
  const tglDari = document.getElementById('laporanTglDari').value;
  const tglSampai = document.getElementById('laporanTglSampai').value;
  const tbody = document.getElementById('laporanTbody');
  if(!tbody) return;
  
  tbody.setAttribute('data-filtered', 'true');
  tbody.innerHTML = "";

  if(!tglDari || !tglSampai) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Pilih rentang tanggal terlebih dahulu.</td></tr>`;
    return;
  }

  let filtered = [];
  transaksiList.forEach(t => {
    let tglTrx = t.tanggalRaw;
    if (!tglTrx && t.tanggal) {
      const datePart = t.tanggal.split(',')[0].trim();
      const p = datePart.split('/');
      if (p.length === 3) tglTrx = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
    }
    const matchTanggal = tglTrx && tglTrx >= tglDari && tglTrx <= tglSampai;
    if(!matchTanggal) return;

    if(namaBarang) {
      const matchedItems = t.items.filter(i => i.nama.toLowerCase() === namaBarang.toLowerCase());
      if(matchedItems.length > 0) {
        filtered.push({ ...t, items: matchedItems, total: matchedItems.reduce((sum, i) => sum + i.subtotal, 0) });
      }
    } else {
      filtered.push({ ...t });
    }
  });

  if(filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #777;">Tidak ada data laporan.</td></tr>`;
    return;
  }

  let totalKeseluruhan = 0;
  filtered.forEach((t, idx) => {
    const origIdx = transaksiList.findIndex(x => x.id === t.id);
    const itemStr = t.items.map(i => `${i.nama} (Qty: ${i.qty})`).join(', ');
    const namaBarangUtama = t.items.length > 0 ? t.items[0].nama : '-';
    
    let namaKasbonDisplay = '-';
    if (t.namaKasbon && t.namaKasbon.trim() !== '') {
      const isAllItemsLunas = t.items && t.items.length > 0 && t.items.every(i => i.isLunasItem);
      const statusTrxKasbon = (t.isLunasKasbon || isAllItemsLunas) ? 'Lunas' : 'Belum Lunas';
      if (statusTrxKasbon === 'Lunas') {
        namaKasbonDisplay = `<b>${t.namaKasbon}</b> <br><span style="background: #dcfce7; color: #16a34a; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">(Lunas)</span>`;
      } else {
        namaKasbonDisplay = `<b>${t.namaKasbon}</b> <br><span style="background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">(Belum Lunas)</span>`;
      }
    }

    totalKeseluruhan += t.total;
    tbody.innerHTML += `
      <tr style="vertical-align: middle;">
        <td>${idx + 1}</td>
        <td>${formatDateID(t.tanggalRaw || t.tanggal)}</td>
        <td><b>${namaBarangUtama}</b></td>
        <td style="text-align: center;">${namaKasbonDisplay}</td>
        <td>${itemStr}</td>
        <td><b>Rp ${formatNumber(t.total)}</b></td>
        <td class="no-print">
          <button class="btn btn-primary btn-sm" onclick="bukaModalCetakNota(${origIdx !== -1 ? origIdx : 0})">Detail</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTransaksi(${origIdx !== -1 ? origIdx : 0})">Hapus</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML += `
    <tr style="background-color: #f1f5f9; font-weight: bold;">
      <td colspan="5" style="text-align: right;">TOTAL KESELURUHAN:</td>
      <td colspan="2" style="color: #0f172a; font-weight: bold;">Rp ${formatNumber(totalKeseluruhan)}</td>
    </tr>
    <tr style="background-color: #f8fafc;">
      <td colspan="7">
        <div style="font-size: 0.9rem; color: #334155; padding: 5px 0;">
          <b>Terbilang:</b> <i>${getTerbilangRupiah(totalKeseluruhan)}</i>
        </div>
      </td>
    </tr>
  `;
}

function cetakRekapLaporan() { window.print(); }

function loadProfilData() {
  if(!document.getElementById('profilUsername')) return;
  document.getElementById('browserPageTitle').innerText = tokoProfile.nama;
  
  const faviconEl = document.getElementById('browserFavicon');
  if (faviconEl) {
    faviconEl.href = tokoProfile.logo ? tokoProfile.logo : 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏪</text></svg>';
  }

  document.getElementById('profilUsername').value = adminCreds.username;
  document.getElementById('tokoNama').value = tokoProfile.nama;
  document.getElementById('tokoTelp').value = tokoProfile.telp;
  document.getElementById('tokoAlamat').value = tokoProfile.alamat;
  document.getElementById('tokoNotes').value = tokoProfile.notes;

  document.getElementById('userDisplayName').innerText = adminCreds.username;
  document.getElementById('topbarMobileBrandText').innerText = tokoProfile.nama;
  document.getElementById('printHeaderCompanyName').innerText = tokoProfile.nama;
  document.getElementById('printHeaderCompanyAlamat').innerText = tokoProfile.alamat;
  document.getElementById('navBrandText').innerText = tokoProfile.nama;
  document.getElementById('bannerStoreName').innerText = tokoProfile.nama;
  document.getElementById('bannerTelp').innerText = tokoProfile.telp;
  document.getElementById('bannerAlamat').innerText = tokoProfile.alamat;
  document.getElementById('sidebarUserText').innerText = `Halo, ${adminCreds.username}`;
  document.getElementById('loginPortalTitle').innerText = tokoProfile.nama;
  document.getElementById('loginPortalSubtitle').innerText = `Sistem Manajemen Toko & Kasir`;
  document.getElementById('loginFooterCopyright').innerText = `© 2026 ${tokoProfile.nama}`;

  tempAvatarBase64 = adminCreds.avatar || '';
  if(adminCreds.avatar) {
    document.getElementById('previewAvatarImg').src = adminCreds.avatar;
    document.getElementById('previewAvatarImg').classList.remove('hidden');
    document.getElementById('previewAvatarIcon').classList.add('hidden');
    document.getElementById('navUserAvatarImg').src = adminCreds.avatar;
    document.getElementById('navUserAvatarImg').classList.remove('hidden');
    document.getElementById('navUserAvatarIcon').classList.add('hidden');
  } else {
    document.getElementById('previewAvatarImg').classList.add('hidden');
    document.getElementById('previewAvatarIcon').classList.remove('hidden');
    document.getElementById('navUserAvatarImg').classList.add('hidden');
    document.getElementById('navUserAvatarIcon').classList.remove('hidden');
  }

  tempLogoBase64 = tokoProfile.logo || '';
  if(tokoProfile.logo) {
    document.getElementById('previewLogoImg').src = tokoProfile.logo;
    document.getElementById('previewLogoImg').classList.remove('hidden');
    document.getElementById('previewLogoIcon').classList.add('hidden');
    document.getElementById('navBrandImg').src = tokoProfile.logo;
    document.getElementById('navBrandImg').classList.remove('hidden');
    document.getElementById('bannerLogoImg').src = tokoProfile.logo;
    document.getElementById('bannerLogoImg').classList.remove('hidden');
    document.getElementById('bannerLogoIcon').classList.add('hidden');
  } else {
    document.getElementById('previewLogoImg').classList.add('hidden');
    document.getElementById('previewLogoIcon').classList.remove('hidden');
    document.getElementById('navBrandImg').classList.add('hidden');
    document.getElementById('bannerLogoImg').classList.add('hidden');
    document.getElementById('bannerLogoIcon').classList.remove('hidden');
  }
}

function previewAvatar(e) {
  const file = e.target.files[0];
  if(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      tempAvatarBase64 = event.target.result;
      const img = document.getElementById('previewAvatarImg');
      img.src = tempAvatarBase64;
      img.classList.remove('hidden');
      document.getElementById('previewAvatarIcon').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
}

function hapusFotoAdmin() {
  if(confirm("Hapus foto profil admin?")) {
    adminCreds.avatar = '';
    tempAvatarBase64 = '';
    document.getElementById('profilAvatarFile').value = '';
    saveDataToStorage();
    loadProfilData();
    alert("Foto profil dihapus.");
  }
}

function previewLogo(e) {
  const file = e.target.files[0];
  if(file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      tempLogoBase64 = event.target.result;
      const img = document.getElementById('previewLogoImg');
      img.src = tempLogoBase64;
      img.classList.remove('hidden');
      document.getElementById('previewLogoIcon').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
}

function hapusLogoToko() {
  if(confirm("Hapus logo toko?")) {
    tokoProfile.logo = '';
    tempLogoBase64 = '';
    document.getElementById('tokoLogoFile').value = '';
    saveDataToStorage();
    loadProfilData();
    alert("Logo toko dihapus.");
  }
}

function saveProfilAdmin(e) {
  e.preventDefault();
  adminCreds.username = document.getElementById('profilUsername').value;
  const p = document.getElementById('profilPassword').value;
  if(p.trim() !== "") adminCreds.password = p;
  if(tempAvatarBase64) adminCreds.avatar = tempAvatarBase64;

  saveDataToStorage();
  loadProfilData();
  document.getElementById('profilPassword').value = '';
  alert("Profil admin diperbarui!");
}

function saveProfilToko(e) {
  e.preventDefault();
  tokoProfile.nama = document.getElementById('tokoNama').value;
  tokoProfile.telp = document.getElementById('tokoTelp').value;
  tokoProfile.alamat = document.getElementById('tokoAlamat').value;
  tokoProfile.notes = document.getElementById('tokoNotes').value;
  if(tempLogoBase64) tokoProfile.logo = tempLogoBase64;

  saveDataToStorage();
  loadProfilData();
  alert("Profil toko disimpan!");
}

function formatNumber(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}