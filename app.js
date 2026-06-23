// 📌 จุดที่ต้องแก้: เอา Web App URL อันใหม่ที่ได้จากการ Deploy มาใส่
const API_URL = "https://script.google.com/macros/s/AKfycbxIbDfben0MdVMxl6bYWQ_MqhFbIN9wK2jgq2_rAswNAiXbdTfzFVpImPOfzXnTYqVP/exec"; 

let masterData = {};
let currentProfileData = null; 
let userRole = ""; 
let userTeam = ""; 

async function checkUserAccess(profile) {
    try {
        currentProfileData = profile; 
        const payload = { line_uid: profile.userId, display_name: profile.displayName, picture_url: profile.pictureUrl || "" };
        
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({ action: "loginApp", payload: payload })
        });
        const result = await response.json();
        document.getElementById('loading-screen').style.display = 'none';

        if (result.status === "success") {
            document.getElementById('app-content').style.display = 'block';
            masterData = result.data;
            userRole = result.user.role; 
            userTeam = result.user.team_id; 
            
            document.getElementById('user-name-display').innerText = `ผู้ใช้งาน: ${profile.displayName} (${userRole})`;

            document.getElementById('btn-transfer').classList.add('hidden');
            document.getElementById('btn-receive').classList.add('hidden');
            if (userRole === "Admin") {
                document.getElementById('btn-transfer').classList.remove('hidden');
                document.getElementById('btn-receive').classList.remove('hidden');
            }
            renderInventory(userTeam); 
            
        } else if (result.status === "pending") {
            Swal.fire({ title: 'รอการอนุมัติสิทธิ์', text: result.message, icon: 'info', confirmButtonColor: '#00B900', confirmButtonText: 'รับทราบ' });
        }
    } catch (error) { 
        document.getElementById('loading-screen').style.display = 'none';
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ระบบสต๊อกได้', 'error'); 
    }
}

function renderInventory(teamId) {
    const container = document.getElementById('inventory-list');
    container.innerHTML = ''; 
    const teamStock = masterData.inventory.filter(inv => inv.location_id === teamId);
    if (teamStock.length === 0) {
        container.innerHTML = `<div class="p-3 text-center text-sm text-gray-500">ไม่มีสินค้าคงเหลือในคลัง</div>`;
        return;
    }
    teamStock.forEach(stock => {
        const item = masterData.items.find(i => i.item_id === stock.item_id);
        const row = document.createElement('div');
        row.className = "flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm";
        row.innerHTML = `<div><p class="font-semibold text-sm text-gray-800">${item ? item.item_name : stock.item_id}</p></div>
                         <div class="text-right"><span class="text-lg font-bold">${stock.balance_qty.toLocaleString()}</span><span class="text-xs text-gray-500 ml-1">${item ? item.unit : ''}</span></div>`;
        container.appendChild(row);
    });
}

function openMenu(type) {
    if (type === 'history') { 
        renderHistory(); 
        document.getElementById('history-modal').classList.remove('hidden');
        return;
    }
    if (type === 'consume') { setupForm('consume'); }
    else if (type === 'receive') { setupForm('receive'); }
    else if (type === 'transfer') { setupForm('transfer'); }
    else { Swal.fire('Coming Soon', 'กำลังพัฒนา', 'info'); return; }
    
    document.getElementById(`${type}-form-modal`).classList.remove('hidden');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ==========================================
// 🚀 ฟังก์ชันแสดงประวัติย้อนหลัง (ใหม่)
// ==========================================
function renderHistory() {
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    
    if(!masterData.transactions || masterData.transactions.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 py-5">ไม่มีประวัติรายการ</p>`;
        return;
    }

    masterData.transactions.forEach(tx => {
        const txDate = new Date(tx.tx_date).toLocaleString('th-TH', {dateStyle: 'short', timeStyle: 'short'});
        const item = masterData.items.find(i => i.item_id === tx.item_id);
        const itemName = item ? item.item_name : tx.item_id;
        
        // รูปแบบหน้าการ์ดประวัติ
        let txIcon = tx.tx_type === 'CONSUME' ? '🛠️ เบิกใช้' : (tx.tx_type === 'RECEIVE' ? '📦 รับเข้า' : '🔄 โอนย้าย');
        let statusBadge = tx.tx_status === 'COMPLETED' ? `<span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-bold">สำเร็จ</span>` : `<span class="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">ยกเลิกแล้ว</span>`;

        const row = document.createElement('div');
        row.className = `p-3 bg-white border border-gray-200 rounded-xl shadow-sm ${tx.tx_status !== 'COMPLETED' ? 'opacity-60' : ''}`;
        
        let htmlContent = `
            <div class="flex justify-between items-start mb-1">
                <span class="text-xs text-gray-400">${tx.tx_id} | ${txDate}</span>
                ${statusBadge}
            </div>
            <p class="font-bold text-gray-800 text-sm mb-1">${txIcon} : ${itemName}</p>
            <p class="text-xs text-gray-600 mb-2">จำนวน: <span class="font-bold">${tx.qty}</span> | บันทึกโดย: ${tx.user_id}</p>
        `;

        // ปุ่มยกเลิก (แสดงเฉพาะ Admin และรายการที่ยังสมบูรณ์อยู่)
        if (userRole === "Admin" && tx.tx_status === "COMPLETED") {
            htmlContent += `<button onclick="confirmCancelTransaction('${tx.tx_id}')" class="w-full mt-2 bg-red-50 text-red-600 text-xs font-bold py-2 border border-red-200 rounded-lg hover:bg-red-100">❌ ยกเลิกรายการนี้</button>`;
        }
        
        if (tx.tx_status === "CANCELED") {
            htmlContent += `<p class="text-xs text-red-500 mt-1">เหตุผล: ${tx.canceled_reason} (โดย ${tx.canceled_by})</p>`;
        }

        row.innerHTML = htmlContent;
        container.appendChild(row);
    });
}

// ==========================================
// 🚀 ฟังก์ชันกดยกเลิกรายการ (ใหม่)
// ==========================================
function confirmCancelTransaction(txId) {
    Swal.fire({
        title: 'ยืนยันการยกเลิก?',
        text: `คุณต้องการยกเลิกรายการ ${txId} และคืนสต๊อกใช่หรือไม่?`,
        icon: 'warning',
        input: 'text',
        inputPlaceholder: 'พิมพ์เหตุผลที่ยกเลิก...',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ยืนยันยกเลิก',
        cancelButtonText: 'ปิด',
        preConfirm: (reason) => {
            if (!reason) { Swal.showValidationMessage('กรุณาระบุเหตุผล'); }
            return reason;
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                Swal.fire({title: 'กำลังคืนสต๊อก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
                const payload = { tx_id: txId, admin_name: currentProfileData.displayName, cancel_reason: result.value };
                
                const response = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "cancelTransaction", payload: payload }) });
                const res = await response.json();
                
                if (res.status === "success") {
                    Swal.fire('ยกเลิกสำเร็จ!', 'รายการถูกยกเลิกและคืนสต๊อกแล้ว', 'success').then(() => {
                        closeModal('history-modal');
                        checkUserAccess(currentProfileData); // รีเฟรชหน้าเว็บดึงข้อมูลใหม่
                    });
                } else { Swal.fire('ผิดพลาด', res.message, 'error'); }
            } catch (e) { Swal.fire('ผิดพลาด', 'เชื่อมต่อขัดข้อง', 'error'); }
        }
    });
}

function setupForm(prefix) { /* โค้ดเดิมยาวๆ ไม่แก้ไข */
    document.getElementById(`${prefix}Form`).reset();
    if(document.getElementById(`${prefix}-fiber-fields`)) document.getElementById(`${prefix}-fiber-fields`).classList.add('hidden');
    const itemSelect = document.getElementById(`${prefix}-item`);
    itemSelect.innerHTML = '<option value="">-- กรุณาเลือก --</option>';
    if (prefix === 'receive') {
        masterData.items.forEach(i => { const opt = document.createElement('option'); opt.value = i.item_id; opt.text = i.item_name; opt.dataset.type = i.category; itemSelect.appendChild(opt); });
    } else {
        const teamStock = masterData.inventory.filter(inv => inv.location_id === userTeam && inv.balance_qty > 0);
        teamStock.forEach(stock => {
            const i = masterData.items.find(item => item.item_id === stock.item_id);
            if (i) { const opt = document.createElement('option'); opt.value = i.item_id; opt.text = `${i.item_name} (คงเหลือ ${stock.balance_qty})`; opt.dataset.type = i.category; itemSelect.appendChild(opt); }
        });
    }
    if (prefix === 'transfer') {
        const toSelect = document.getElementById('transfer-to');
        toSelect.innerHTML = '<option value="">-- เลือกทีมปลายทาง --</option>';
        masterData.locations.filter(l => l.location_id !== userTeam).forEach(l => { const opt = document.createElement('option'); opt.value = l.location_id; opt.text = l.location_name; toSelect.appendChild(opt); });
    }
}

function checkItemType(prefix) {
    const select = document.getElementById(`${prefix}-item`);
    const opt = select.options[select.selectedIndex];
    const fields = document.getElementById(`${prefix}-fiber-fields`);
    const qty = document.getElementById(`${prefix}-qty`);
    if (opt && opt.dataset.type === "Fiber Cable") {
        if(fields) fields.classList.remove('hidden');
        if (prefix === 'consume' || prefix === 'transfer') {
            qty.setAttribute('readonly', true); qty.classList.add('bg-gray-100');
            const drumSelect = document.getElementById(`${prefix}-drum`);
            drumSelect.innerHTML = '<option value="">-- กรุณาเลือกม้วนสาย --</option>';
            masterData.drums.filter(d => d.location_id === userTeam && d.item_id === opt.value).forEach(d => {
                const o = document.createElement('option'); o.value = d.drum_id; o.text = `Drum${d.drum_no}/${d.batch_no} | เหลือ ${d.current_length}ม.`; drumSelect.appendChild(o);
            });
            if(prefix === 'transfer') { qty.removeAttribute('readonly'); qty.classList.remove('bg-gray-100'); }
        }
    } else {
        if(fields) fields.classList.add('hidden');
        qty.removeAttribute('readonly'); qty.classList.remove('bg-gray-100');
    }
}

function calculateFiberQty(prefix) {
    let start = parseFloat(document.getElementById(`${prefix}-mark-start`).value) || 0;
    let end = parseFloat(document.getElementById(`${prefix}-mark-end`).value) || 0;
    if (start > 0 && end > 0) { document.getElementById(`${prefix}-qty`).value = Math.abs(end - start); }
}

async function submitTransactionForm(event, txType) {
    event.preventDefault();
    const prefix = txType.toLowerCase();
    
    let payload = {
        tx_type: txType, user_id: currentProfileData.displayName || "ช่างเทคนิค",
        from_location: txType === 'RECEIVE' ? "" : userTeam,
        to_location: txType === 'RECEIVE' ? userTeam : (txType === 'TRANSFER' ? document.getElementById('transfer-to').value : ""),
        item_id: document.getElementById(`${prefix}-item`).value,
        qty: parseFloat(document.getElementById(`${prefix}-qty`).value),
        remark: document.getElementById(`${prefix}-remark`).value,
        ref_job_id: txType === 'CONSUME' ? document.getElementById('consume-ref').value : ""
    };

    if (txType === 'CONSUME') {
        payload.drum_id = document.getElementById('consume-drum').value;
        payload.mark_start = document.getElementById('consume-mark-start').value;
        payload.mark_end = document.getElementById('consume-mark-end').value;
    } else if (txType === 'TRANSFER') {
        payload.drum_id = document.getElementById('transfer-drum').value || "";
    } else if (txType === 'RECEIVE' && document.getElementById('receive-fiber-fields').classList.contains('hidden') === false) {
        payload.is_new_fiber = true;
        payload.po_no = document.getElementById('receive-po').value;
        payload.drum_no = document.getElementById('receive-drum-no').value;
        payload.batch_no = document.getElementById('receive-batch').value;
    }

    const btnSubmit = event.target.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true; btnSubmit.innerHTML = 'กำลังบันทึกข้อมูล...';

    try {
        const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "submitTransaction", payload: payload }) });
        const result = await res.json();
        if (result.status === "success") {
            Swal.fire('สำเร็จ!', 'บันทึกเรียบร้อย', 'success').then(() => {
                closeModal(`${prefix}-form-modal`); 
                checkUserAccess(currentProfileData); 
            });
        } else { Swal.fire('ล้มเหลว', result.message, 'error'); }
    } catch (e) { Swal.fire('ผิดพลาด', 'การเชื่อมต่อขัดข้อง', 'error'); }
    finally { btnSubmit.disabled = false; btnSubmit.innerHTML = originalText; }
}
