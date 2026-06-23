// **อย่าลืมเปลี่ยน URL ตรงนี้หากมีการ Deploy Google Apps Script เวอร์ชันใหม่**
const API_URL = "https://script.google.com/macros/s/AKfycbwiBsI1E5QMNevxNV9yjxdj9Y88kwCx0rfiWdSmtbHRgqVeWG0dhwUYfImcB-1WNoV9/exec"; 

let masterData = {};
let currentUser = {};

// สมมติสิทธิ์เพื่อการทดสอบ (ในอนาคตจะดึงตาม Line UID)
let userRole = "Admin"; 
let userTeam = "LOC-KKT"; 

async function checkUserAccess(lineUid, displayName) {
    try {
        const response = await fetch(`${API_URL}?action=getMasterData`);
        const result = await response.json();
        
        if (result.status === "success") {
            masterData = result.data;
            currentUser = { line_uid: lineUid, name: displayName }; 
            
            document.getElementById('user-name-display').innerText = `ผู้ใช้งาน: ${displayName} (${userRole})`;

            if (userRole === "Admin") {
                document.getElementById('btn-transfer').classList.remove('hidden');
                document.getElementById('btn-receive').classList.remove('hidden');
            }
            renderInventory(userTeam); 
        } else {
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลสต๊อกได้', 'error');
        }
    } catch (error) {
        Swal.fire('ข้อผิดพลาด', 'การเชื่อมต่อล้มเหลว', 'error');
    }
}

function renderInventory(teamId) {
    const container = document.getElementById('inventory-list');
    container.innerHTML = ''; 
    const teamStock = masterData.inventory.filter(inv => inv.location_id === teamId);

    if (teamStock.length === 0) {
        container.innerHTML = `<div class="p-3 bg-gray-100 rounded-lg text-center text-sm text-gray-500">ไม่มีสินค้าคงเหลือในคลัง</div>`;
        return;
    }

    teamStock.forEach(stock => {
        const item = masterData.items.find(i => i.item_id === stock.item_id);
        const itemName = item ? item.item_name : stock.item_id;
        const itemUnit = item ? item.unit : '';

        const row = document.createElement('div');
        row.className = "flex justify-between items-center p-3 bg-white border border-gray-200 rounded-xl shadow-sm";
        row.innerHTML = `
            <div>
                <p class="font-semibold text-gray-800 text-sm">${itemName}</p>
                <p class="text-xs text-gray-400">รหัส: ${stock.item_id}</p>
            </div>
            <div class="text-right">
                <span class="text-lg font-bold text-gray-900">${stock.balance_qty.toLocaleString()}</span>
                <span class="text-xs text-gray-500 ml-1">${itemUnit}</span>
            </div>
        `;
        container.appendChild(row);
    });
}

function openMenu(type) {
    if (type === 'consume') { setupForm('consume'); }
    else if (type === 'receive') { setupForm('receive'); }
    else if (type === 'transfer') { setupForm('transfer'); }
    else { Swal.fire('Coming Soon', 'กำลังพัฒนา', 'info'); return; }
    
    document.getElementById(`${type}-form-modal`).classList.remove('hidden');
}

function closeModal(id) { 
    document.getElementById(id).classList.add('hidden'); 
}

function setupForm(prefix) {
    document.getElementById(`${prefix}Form`).reset();
    if(document.getElementById(`${prefix}-fiber-fields`)) document.getElementById(`${prefix}-fiber-fields`).classList.add('hidden');
    
    const itemSelect = document.getElementById(`${prefix}-item`);
    itemSelect.innerHTML = '<option value="">-- กรุณาเลือก --</option>';

    if (prefix === 'receive') {
        masterData.items.forEach(i => {
            const opt = document.createElement('option'); opt.value = i.item_id; opt.text = i.item_name; opt.dataset.type = i.category; itemSelect.appendChild(opt);
        });
    } else {
        const teamStock = masterData.inventory.filter(inv => inv.location_id === userTeam && inv.balance_qty > 0);
        teamStock.forEach(stock => {
            const i = masterData.items.find(item => item.item_id === stock.item_id);
            if (i) {
                const opt = document.createElement('option'); opt.value = i.item_id; opt.text = `${i.item_name} (คงเหลือ ${stock.balance_qty})`; opt.dataset.type = i.category; itemSelect.appendChild(opt);
            }
        });
    }

    if (prefix === 'transfer') {
        const toSelect = document.getElementById('transfer-to');
        toSelect.innerHTML = '<option value="">-- เลือกทีมปลายทาง --</option>';
        masterData.locations.filter(l => l.location_id !== userTeam).forEach(l => {
            const opt = document.createElement('option'); opt.value = l.location_id; opt.text = l.location_name; toSelect.appendChild(opt);
        });
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
                const o = document.createElement('option'); o.value = d.drum_id; 
                o.text = `Drum${d.drum_no}/${d.batch_no} | เหลือ ${d.current_length}ม.`; 
                drumSelect.appendChild(o);
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
    if (start > 0 && end > 0) { 
        document.getElementById(`${prefix}-qty`).value = Math.abs(end - start); 
    }
}

async function submitTransactionForm(event, txType) {
    event.preventDefault();
    const prefix = txType.toLowerCase();
    
    let payload = {
        tx_type: txType, user_id: currentUser.name || "ช่างเทคนิค",
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
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'กำลังบันทึกข้อมูล...';

    try {
        const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "submitTransaction", payload: payload }) });
        const result = await res.json();
        if (result.status === "success") {
            Swal.fire('สำเร็จ!', 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success').then(() => {
                closeModal(`${prefix}-form-modal`); 
                checkUserAccess(currentUser.line_uid, currentUser.name);
            });
        } else { Swal.fire('ล้มเหลว', result.message, 'error'); }
    } catch (e) { 
        Swal.fire('ผิดพลาด', 'การเชื่อมต่อขัดข้อง', 'error'); 
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}
