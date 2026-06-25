const API_URL = "https://script.google.com/macros/s/AKfycbytTldGQme-KHPjDqxvxM8uE6xSwn7Zoi2GSiGAerknusjuwQ4Vkno73ELBRjKfbjr1/exec"; 

let masterData = {};
let currentProfileData = null; 
let userRole = ""; 
let userTeam = ""; 
let isDataLoaded = false; 

// ตัวแปรเก็บสถานะของตะกร้าเบิกของ
let cartRows = []; 
let cartRowCounter = 0;

async function checkUserAccess(profile) {
    try {
        currentProfileData = profile; 
        const payload = { line_uid: profile.userId, display_name: profile.displayName, picture_url: profile.pictureUrl || "" };
        const response = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "loginApp", payload: payload }) });
        const result = await response.json();
        document.getElementById('loading-screen').style.display = 'none';

        if (result.status === "success") {
            document.getElementById('app-content').style.display = 'block';
            userRole = result.user.role; userTeam = result.user.team_id; 
            document.getElementById('user-name-display').innerText = `ผู้ใช้งาน: ${profile.displayName} (${userRole})`;
            
            if (userRole === "Admin") {
                document.getElementById('btn-transfer').classList.remove('hidden');
                document.getElementById('btn-receive').classList.remove('hidden');
                document.getElementById('inventory-title').innerText = "📊 ภาพรวมสต๊อกคงเหลือทุกคลัง";
            }
            document.getElementById('inventory-list').innerHTML = `<div class="text-center text-sm text-blue-500 font-bold animate-pulse">กำลังโหลดสต๊อก Real-time...</div>`;
            fetchMasterData(result.user);
        } else if (result.status === "pending") { Swal.fire({ title: 'รออนุมัติสิทธิ์', text: result.message, icon: 'info' }); }
    } catch (error) { Swal.fire('ข้อผิดพลาด', 'เชื่อมต่อเซิร์ฟเวอร์ขัดข้อง', 'error'); }
}

async function fetchMasterData(userProfile) {
    try {
        const response = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "getAppMasterData", payload: { user: userProfile } }) });
        const result = await response.json();
        if (result.status === "success") { masterData = result.data; isDataLoaded = true; renderInventory(); }
    } catch (error) { document.getElementById('inventory-list').innerHTML = `<div class="text-center text-red-500">โหลดสต๊อกล้มเหลว</div>`; }
}

function renderInventory() {
    const container = document.getElementById('inventory-list'); container.innerHTML = ''; 
    let activeLocations = userRole === "Admin" ? masterData.locations : masterData.locations.filter(l => l.location_id === userTeam);
    activeLocations.forEach(loc => {
        const locStock = masterData.inventory.filter(inv => inv.location_id === loc.location_id && inv.balance_qty > 0);
        if (userRole === "Admin" && locStock.length === 0) return; 
        const locBlock = document.createElement('div'); locBlock.className = "bg-gray-100 p-2 rounded-xl border border-gray-200 mb-2";
        locBlock.innerHTML = `<h3 class="text-xs font-bold text-gray-500 mb-2 px-1">📍 ${loc.location_name}</h3><div class="space-y-1" id="stock-box-${loc.location_id}"></div>`;
        container.appendChild(locBlock);
        const stockBox = document.getElementById(`stock-box-${loc.location_id}`);
        locStock.forEach(stock => {
            const item = masterData.items.find(i => i.item_id === stock.item_id);
            const row = document.createElement('div'); row.className = "flex justify-between items-center p-2.5 bg-white rounded-lg shadow-sm text-xs";
            row.innerHTML = `<div><p class="font-semibold text-gray-800">${item ? item.item_name : stock.item_id}</p></div>
                             <div class="text-right font-bold text-gray-900">${stock.balance_qty.toLocaleString()} <span class="text-[10px] text-gray-400 font-normal">${item ? item.unit : ''}</span></div>`;
            stockBox.appendChild(row);
        });
    });
}

function openMenu(type) {
    if (!isDataLoaded) { Swal.fire('รอสักครู่', 'ระบบกำลังอัปเดตสต๊อก...', 'warning'); return; }
    if (type === 'history') { renderHistory(); document.getElementById('history-modal').classList.remove('hidden'); return; }
    
    setupUniversalForm(type);
    document.getElementById(`${type}-form-modal`).classList.remove('hidden');
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ==========================================
// 🛒 ระบบจัดการตะกร้าเบิกของ (Job Cart)
// ==========================================

function setupUniversalForm(prefix) {
    document.getElementById(`${prefix}Form`).reset();
    if (prefix === 'consume') {
        const fromSelect = document.getElementById('consume-from'); fromSelect.innerHTML = '';
        if (userRole === "Admin") {
            document.getElementById('consume-target-user-block').classList.remove('hidden');
            masterData.locations.forEach(l => { fromSelect.options.add(new Option(l.location_name, l.location_id)); });
        } else {
            document.getElementById('consume-target-user-block').classList.add('hidden');
            const myLoc = masterData.locations.find(l => l.location_id === userTeam);
            fromSelect.options.add(new Option(myLoc.location_name, myLoc.location_id));
        }
        resetCart(); // ล้างตะกร้าเก่าทิ้ง
    } else {
        if (prefix === 'receive') {
            const toSelect = document.getElementById('receive-to-warehouse'); toSelect.innerHTML = '';
            if (userRole === "Admin") masterData.locations.forEach(l => { toSelect.options.add(new Option(l.location_name, l.location_id)); });
            else { const myLoc = masterData.locations.find(l => l.location_id === userTeam); toSelect.options.add(new Option(myLoc.location_name, myLoc.location_id)); }
            const itemSelect = document.getElementById('receive-item'); itemSelect.innerHTML = '<option value="">-- เลือกอุปกรณ์ --</option>';
            masterData.items.forEach(i => { const opt = new Option(i.item_name, i.item_id); opt.dataset.type = i.category; itemSelect.add(opt); });
        } else if (prefix === 'transfer') {
            const fromSelect = document.getElementById('transfer-from-warehouse'); fromSelect.innerHTML = '';
            if (userRole === "Admin") masterData.locations.forEach(l => { fromSelect.options.add(new Option(l.location_name, l.location_id)); });
            else { const myLoc = masterData.locations.find(l => l.location_id === userTeam); fromSelect.options.add(new Option(myLoc.location_name, myLoc.location_id)); }
            onTransferSrcWarehouseChange();
        }
    }
}

function resetCart() {
    document.getElementById('cart-fiber-container').innerHTML = '';
    document.getElementById('cart-acc-container').innerHTML = '';
    cartRows = [];
}

function addFiberRow() {
    cartRowCounter++; const rId = cartRowCounter;
    cartRows.push({ id: rId, type: 'FIBER' });
    
    const div = document.createElement('div');
    div.id = `cart-row-${rId}`;
    div.className = "bg-white p-2.5 rounded shadow-sm border border-blue-100 relative";
    div.innerHTML = `
        <button type="button" onclick="removeCartRow(${rId})" class="absolute top-1.5 right-2 text-red-500 font-bold text-lg">&times;</button>
        <select id="sel-drum-${rId}" class="w-[90%] text-xs border border-gray-300 p-1.5 rounded outline-none mb-2 bg-gray-50" onchange="updateCartDropdowns()" required>
            <option value="">-- กรุณาเลือกม้วนสาย --</option>
        </select>
        <div class="grid grid-cols-3 gap-2 text-xs">
            <div><label class="text-gray-500">F.ML</label><input type="number" id="fml-${rId}" class="w-full border p-1.5 rounded outline-none" oninput="calcFiberCartQty(${rId})" required></div>
            <div><label class="text-gray-500">T.ML</label><input type="number" id="tml-${rId}" class="w-full border p-1.5 rounded outline-none" oninput="calcFiberCartQty(${rId})" required></div>
            <div><label class="text-gray-500">จำนวน(ม.)</label><input type="number" id="qty-${rId}" class="w-full border p-1.5 rounded bg-gray-100 font-bold text-blue-700 outline-none" readonly required></div>
        </div>
    `;
    document.getElementById('cart-fiber-container').appendChild(div);
    updateCartDropdowns();
}

function addAccRow() {
    cartRowCounter++; const rId = cartRowCounter;
    cartRows.push({ id: rId, type: 'ACC' });
    
    const div = document.createElement('div');
    div.id = `cart-row-${rId}`;
    div.className = "bg-white p-2 rounded shadow-sm border border-orange-100 flex items-center gap-2";
    div.innerHTML = `
        <select id="sel-acc-${rId}" class="flex-1 text-xs border border-gray-300 p-2 rounded outline-none bg-gray-50" onchange="updateCartDropdowns()" required>
            <option value="">-- เลือกอุปกรณ์ประกอบ --</option>
        </select>
        <input type="number" id="qty-${rId}" class="w-20 border border-gray-300 p-2 rounded text-center text-sm font-bold text-orange-700 outline-none" placeholder="จำนวน" min="1" step="0.01" required>
        <button type="button" onclick="removeCartRow(${rId})" class="text-red-500 font-bold px-2 text-lg">&times;</button>
    `;
    document.getElementById('cart-acc-container').appendChild(div);
    updateCartDropdowns();
}

function removeCartRow(rId) {
    cartRows = cartRows.filter(r => r.id !== rId);
    document.getElementById(`cart-row-${rId}`).remove();
    updateCartDropdowns(); // คืนค่าตัวเลือกให้แถวอื่น
}

function calcFiberCartQty(rId) {
    let s = parseFloat(document.getElementById(`tml-${rId}`).value) || 0;
    let e = parseFloat(document.getElementById(`fml-${rId}`).value) || 0;
    if (s > 0 && e > 0) document.getElementById(`qty-${rId}`).value = Math.abs(e - s);
}

// 🧠 ลอจิกความฉลาด: ซ่อนตัวเลือกที่ถูกเลือกไปแล้ว
function updateCartDropdowns() {
    const srcWh = document.getElementById('consume-from').value;
    
    // ดึงค่าที่กำลังถูกเลือกอยู่ในทุกแถว (เพื่อเอาไปซ่อน)
    let selectedDrums = []; let selectedAccs = [];
    cartRows.forEach(r => {
        if(r.type === 'FIBER') { let val = document.getElementById(`sel-drum-${r.id}`).value; if(val) selectedDrums.push(val); }
        if(r.type === 'ACC') { let val = document.getElementById(`sel-acc-${r.id}`).value; if(val) selectedAccs.push(val); }
    });

    // อัปเดตตัวเลือกให้แต่ละแถวใหม่
    cartRows.forEach(r => {
        if(r.type === 'FIBER') {
            const sel = document.getElementById(`sel-drum-${r.id}`);
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">-- กรุณาเลือกม้วนสาย --</option>';
            
            // ✅ แก้ไขจุดที่ 1: ป้องกัน Error หน้าจอขาว หากมีคนลบ Item ออกจากระบบ
            masterData.drums.filter(d => {
                let item = masterData.items.find(i => i.item_id === d.item_id);
                return d.location_id === srcWh && item && item.category === "Fiber Cable";
            }).forEach(d => {
                // โชว์เฉพาะม้วนที่ยังไม่ถูกเลือก หรือม้วนที่เป็นของแถวนี้อยู่แล้ว
                if(!selectedDrums.includes(d.drum_id) || d.drum_id === currentVal) {
                    sel.add(new Option(`[${d.item_id}] Drum${d.drum_no}/${d.batch_no} | เหลือ ${d.current_length}ม.`, d.drum_id));
                }
            });
            sel.value = currentVal;
        } 
        else if (r.type === 'ACC') {
            const sel = document.getElementById(`sel-acc-${r.id}`);
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">-- เลือกอุปกรณ์ประกอบ --</option>';
            masterData.inventory.filter(inv => inv.location_id === srcWh && inv.balance_qty > 0).forEach(inv => {
                const item = masterData.items.find(i => i.item_id === inv.item_id);
                if(item && item.category !== "Fiber Cable") {
                    if(!selectedAccs.includes(inv.item_id) || inv.item_id === currentVal) {
                        sel.add(new Option(`${item.item_name} (เหลือ ${inv.balance_qty})`, inv.item_id));
                    }
                }
            });
            sel.value = currentVal;
        }
    });
}

// 📦 รวบยอดส่งเป็นตะกร้าให้ Backend
async function submitCartForm(event) {
    event.preventDefault();
    if (cartRows.length === 0) { Swal.fire('ผิดพลาด', 'กรุณาเพิ่มอุปกรณ์อย่างน้อย 1 รายการ', 'warning'); return; }

    const btnSubmit = document.getElementById('btn-submit-cart');
    btnSubmit.disabled = true; btnSubmit.innerHTML = 'กำลังตรวจสอบสต๊อก...';

    let fromLoc = document.getElementById('consume-from').value;
    let refJob = document.getElementById('consume-ref').value;
    let actorName = currentProfileData.displayName;
    if (userRole === "Admin" && document.getElementById('consume-target-user').value) {
        actorName = `Admin (เบิกแทน: ${document.getElementById('consume-target-user').value})`;
    }

    let payload = {
        tx_type: "CONSUME", user_id: actorName, from_location: fromLoc,
        ref_job_id: refJob, remark: document.getElementById('consume-remark').value, items: []
    };

    // ประกอบร่างรายการในตะกร้า
    for (let r of cartRows) {
        if (r.type === 'FIBER') {
            payload.items.push({
                type: "FIBER", drum_id: document.getElementById(`sel-drum-${r.id}`).value,
                mark_start: document.getElementById(`tml-${r.id}`).value, mark_end: document.getElementById(`fml-${r.id}`).value,
                qty: parseFloat(document.getElementById(`qty-${r.id}`).value)
            });
        } else {
            payload.items.push({
                type: "ACC", item_id: document.getElementById(`sel-acc-${r.id}`).value,
                qty: parseFloat(document.getElementById(`qty-${r.id}`).value)
            });
        }
    }

    try {
        const res = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "submitCartTransaction", payload: payload }) });
        const result = await res.json();
        
        if (result.status === "success") {
            Swal.fire('สำเร็จ!', 'บันทึกบิลใบงานเรียบร้อย', 'success').then(async () => {
                closeModal('consume-form-modal');
                await shareCartToLineGroup(payload, result.tx_id);
                isDataLoaded = false; fetchMasterData(currentProfileData);
            });
        } else { Swal.fire('ล้มเหลว', result.message, 'error'); }
    } catch (e) { Swal.fire('ผิดพลาด', 'เชื่อมต่อขัดข้อง', 'error'); }
    finally { btnSubmit.disabled = false; btnSubmit.innerHTML = 'ยืนยันการเบิกทั้งหมด'; }
}

async function shareCartToLineGroup(payload, txId) {
    if (!liff.isApiAvailable('shareTargetPicker')) return;

    // 🏛️ ค้นหาชื่อคลังภาษาไทยเต็มๆ จาก masterData เพื่อความตรงกันกับหลังบ้าน
    let locName = payload.from_location;
    if (masterData && masterData.locations) {
        const foundLoc = masterData.locations.find(l => l.location_id === payload.from_location);
        if (foundLoc) {
            locName = foundLoc.location_name;
        }
    }

    // ✅ แก้ไขจุดที่ 2: เพิ่มรหัสบิล (txId) ลงไปในข้อความแชร์
    let msgText = `🛒 บิลเบิกใช้งาน (Job Cart)\n🔖 รหัสบิล: ${txId}\n👤 บันทึกโดย: ${payload.user_id}\n🏛️ เบิกจากคลัง: ${locName}\n📝 ใบงาน: ${payload.ref_job_id}\n----------------\n`;

    payload.items.forEach(item => {
        if (item.type === "FIBER") {
            // ค้นหาข้อมูลม้วนสายและชื่ออุปกรณ์เพื่อแสดงรายละเอียดเต็ม
            const drum = masterData.drums.find(d => d.drum_id === item.drum_id);
            let itemName = item.item_id;
            let dName = item.drum_id;

            if (drum) {
                dName = `Drum${drum.drum_no}/${drum.batch_no}`;
                const foundItem = masterData.items.find(i => i.item_id === drum.item_id);
                if (foundItem) itemName = foundItem.item_name;
            }

            const mStart = String(item.mark_start).padStart(4, '0');
            const mEnd = String(item.mark_end).padStart(4, '0');
            
            msgText += `✂️ [Fiber] ${itemName}\n🏷️ ${dName} (F.ML${mEnd} - T.ML${mStart}) = ${item.qty}m.\n`;
        } else {
            // ค้นหาชื่ออุปกรณ์ประกอบภาษาไทย
            let itemName = item.item_id;
            if (masterData && masterData.items) {
                const foundItem = masterData.items.find(i => i.item_id === item.item_id);
                if (foundItem) itemName = foundItem.item_name;
            }
            msgText += `🔌 [อุปกรณ์] ${itemName} = ${item.qty} ชิ้น\n`;
        }
    });
    
    msgText += `----------------\n📋 หมายเหตุ: ${payload.remark || '-'}`;
    
    // 🚀 ยิงหน้าต่างเปิดให้ช่างเลือกกลุ่มเพื่อส่งข้อความที่สมบูรณ์แบบนี้ออกไป
    try { 
        await liff.shareTargetPicker([{ type: "text", text: msgText }]); 
    } catch (error) {
        console.error("Share failed:", error);
    }
}

/* ฟังก์ชัน Transfer/Receive เดิม คงไว้เพื่อให้ทำงานได้ */
function onTransferSrcWarehouseChange() { /* เหมือนชุดเดิม */ }
function checkItemType(prefix) { /* เหมือนชุดเดิม */ }
async function submitTransactionForm(event, txType) { /* โค้ดโอน/รับเข้าเดิม ปล่อยไว้ */ }
function renderHistory() { /* แสดงประวัติ (ชุดเดิม) */ }
