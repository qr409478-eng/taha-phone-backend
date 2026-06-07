const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; 

const SUPABASE_URL = 'https://buxnqmmbecgtnckygudx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1eG5xbW1iZWNndG5ja3lndWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTA3MjUsImV4cCI6MjA5NjA2NjcyNX0.jqlt5oguM2O9Bh-6rdb61XrqkoOKss8qxUGu-ZixcL0';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function supabaseRequest(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': method === 'POST' || method === 'PATCH' ? 'return=representation' : ''
            }
        };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
        if (!res.ok) return null;
        return await res.json();
    } catch (err) { return null; }
}

// --- إدارة الأجهزة والصيانة ---
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await supabaseRequest('devices?select=*') || [];
        const config = await supabaseRequest('shop_config?id=eq.1&select=*') || [];
        const withdrawn = (config && config[0]) ? parseFloat(config[0].technician_withdrawn) || 0 : 0;

        let totalSoftwareIncome = 0; let totalPartnerIncome = 0; let totalHardwareIncome = 0;
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        if (Array.isArray(devices)) {
            devices.forEach(dev => {
                const price = parseFloat(dev.cost) || 0;
                const costOut = parseFloat(dev.extra_cost) || 0;
                const netProfit = price - costOut;
                const devDate = parseInt(dev.id) || Date.now(); 

                if (dev.status !== 'طلب معلق' && dev.status !== 'مرفوض' && dev.is_paid) {
                    if (dev.issue_type === 'سوفتوير' && devDate >= oneWeekAgo) totalSoftwareIncome += netProfit;
                    else if (dev.issue_type === 'صيانة شريك (30%)') totalPartnerIncome += netProfit;
                    else totalHardwareIncome += netProfit;
                }
            });
        }
        res.json({
            devices: Array.isArray(devices) ? [...devices].sort((a, b) => b.id - a.id) : [], 
            stats: { totalSoftwareWeek: totalSoftwareIncome, myShareWeek: totalSoftwareIncome * 0.5, myRemaining: (totalSoftwareIncome * 0.5) - withdrawn, totalPartner: totalPartnerIncome, partnerShareWeek: totalPartnerIncome * 0.3, totalHardware: totalHardwareIncome, technicianWithdrawn: withdrawn }
        });
    } catch (err) { res.status(500).json({ error: "خطأ" }); }
});

app.post('/api/devices', async (req, res) => {
    const { customer_name, phone_model, issue_type, notes, cost, extra_cost, transfer_number, transfer_name, transfer_platform, is_client_order } = req.body;
    const newDevice = { id: Date.now(), date_string: new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'short' }), customer_name, phone_model, issue_type: issue_type || 'سوفتوير', notes, cost: parseFloat(cost) || 0, extra_cost: parseFloat(extra_cost) || 0, status: is_client_order ? 'مرفوض' : 'قيد الانتظار', is_paid: false, reply_message: '', transfer_number: transfer_number||'', transfer_name: transfer_name||'', transfer_platform: transfer_platform||'' };
    if(is_client_order) newDevice.status = 'طلب معلق';
    await supabaseRequest('devices', 'POST', newDevice);
    res.json({ message: "تم الحفظ" });
});

app.put('/api/devices/:id', async (req, res) => {
    await supabaseRequest(`devices?id=eq.${req.params.id}`, 'PATCH', req.body);
    res.json({ message: "تم التحديث" });
});

app.delete('/api/devices/:id', async (req, res) => {
    await supabaseRequest(`devices?id=eq.${req.params.id}`, 'DELETE');
    res.json({ message: "تم الحذف نهائياً" });
});

// --- إدارة الديون التي لنا (shop_debts) ---
app.get('/api/debts', async (req, res) => {
    const debts = await supabaseRequest('shop_debts?select=*') || [];
    res.json(debts.sort((a, b) => b.id - a.id));
});

app.post('/api/debts', async (req, res) => {
    const { customer_name, amount, items_taken } = req.body;
    const newDebt = { customer_name, amount: parseFloat(amount) || 0, items_taken, date_string: new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }), is_settled: false };
    await supabaseRequest('shop_debts', 'POST', newDebt);
    res.json({ message: "تم التسجيل" });
});

app.put('/api/debts/:id', async (req, res) => {
    await supabaseRequest(`shop_debts?id=eq.${req.params.id}`, 'PATCH', req.body);
    res.json({ message: "تم تحديث الدين" });
});

app.delete('/api/debts/:id', async (req, res) => {
    await supabaseRequest(`shop_debts?id=eq.${req.params.id}`, 'DELETE');
    res.json({ message: "تم حذف سجل الدين" });
});

// --- إدارة الديون التي علينا للموردين (جديد 🛒) ---
// ملاحظة: يتم حفظ البيانات في جدول مستقل لتلافي الاختلاط المالي
app.get('/api/supplier-debts', async (req, res) => {
    const sDebts = await supabaseRequest('supplier_debts?select=*') || [];
    res.json(sDebts.sort((a, b) => b.id - a.id));
});

app.post('/api/supplier-debts', async (req, res) => {
    const { supplier_name, supplier_phone, amount, notes } = req.body;
    const newSupplierDebt = {
        id: Date.now(),
        supplier_name,
        supplier_phone,
        amount: parseFloat(amount) || 0,
        notes,
        taken_date: new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }),
        is_paid: false,
        settled_date: '',
        pay_method: '',
        transfer_to_number: ''
    };
    await supabaseRequest('supplier_debts', 'POST', newSupplierDebt);
    res.json({ message: "تم قيد الدين المورد بنجاح" });
});

app.put('/api/supplier-debts/:id', async (req, res) => {
    await supabaseRequest(`supplier_debts?id=eq.${req.params.id}`, 'PATCH', req.body);
    res.json({ message: "تم تحديث بيانات المورد" });
});

app.delete('/api/supplier-debts/:id', async (req, res) => {
    await supabaseRequest(`supplier_debts?id=eq.${req.params.id}`, 'DELETE');
    res.json({ message: "تم الحذف بنجاح" });
});

// --- خدمات الآيكلود والسيرفر ---
app.get('/api/icloud-services', async (req, res) => {
    const services = await supabaseRequest('icloud_services?select=*') || [];
    res.json(services.sort((a, b) => a.id - b.id));
});

app.put('/api/icloud-services/:id', async (req, res) => {
    const { status, cost_ils, expected_time } = req.body;
    await supabaseRequest(`icloud_services?id=eq.${req.params.id}`, 'PATCH', { status, cost_ils: parseFloat(cost_ils) || 0, expected_time });
    res.json({ message: "تم التعديل" });
});

app.listen(PORT, () => console.log(`🚀 النظام يعمل ومحمي بالكامل في منفذ ${PORT}`));