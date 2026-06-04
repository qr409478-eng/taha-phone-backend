const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000; 

// الربط الجديد والنظيف بالسحاب 🚀
const SUPABASE_URL = 'https://buxnqmmbecgtnckygudx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1eG5xbW1iZWNndG5ja3lndWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTA3MjUsImV4cCI6MjA5NjA2NjcyNX0.jqlt5oguM2O9Bh-6rdb61XrqkoOKss8qxUGu-ZixcL0';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// دالة مساعدة معالجة ومستقرة للاتصال بـ Supabase
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
        if (!res.ok) {
            const errText = await res.text();
            console.error(`Supabase Error [${res.status}]:`, errText);
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error("Fetch Exception:", err);
        return null;
    }
}

// جلب البيانات والحسابات الأسبوعية من السحاب
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await supabaseRequest('devices?select=*') || [];
        const config = await supabaseRequest('shop_config?id=eq.1&select=*') || [];
        
        const withdrawn = (config && config[0]) ? parseFloat(config[0].technician_withdrawn) || 0 : 0;

        let totalSoftwareIncome = 0;
        let totalHardwareIncome = 0;
        let pendingNextWeek = 0; 

        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

        if (Array.isArray(devices)) {
            devices.forEach(dev => {
                const price = parseFloat(dev.cost) || 0;
                const costOut = parseFloat(dev.extra_cost) || 0;
                const netProfit = price - costOut;
                const devDate = parseInt(dev.id) || Date.now(); 

                if (dev.status !== 'طلب معلق' && dev.status !== 'مرفوض') {
                    if (dev.is_paid) {
                        if (dev.issue_type === 'سوفتوير' && devDate >= oneWeekAgo) {
                            totalSoftwareIncome += netProfit;
                        } else if (dev.issue_type !== 'سوفتوير') {
                            totalHardwareIncome += netProfit;
                        }
                    } else {
                        if (dev.issue_type === 'سوفتوير') {
                            pendingNextWeek += (netProfit * 0.5); 
                        }
                    }
                }
            });
        }

        const myShareTotal = totalSoftwareIncome * 0.5;
        const myRemaining = myShareTotal - withdrawn;
        const sortedDevices = Array.isArray(devices) ? [...devices].sort((a, b) => b.id - a.id) : [];

        res.json({
            devices: sortedDevices, 
            stats: {
                totalSoftwareWeek: totalSoftwareIncome,
                myShareWeek: myShareTotal,
                shopShareWeek: totalSoftwareIncome * 0.5,
                technicianWithdrawn: withdrawn,
                myRemaining: myRemaining,
                pendingNextWeek: pendingNextWeek,
                totalHardware: totalHardwareIncome
            }
        });
    } catch (err) {
        res.status(500).json({ error: "خطأ في الاتصال بقاعدة البيانات السحابية" });
    }
});

// تسجيل دفعة مسحوبة في السحاب
app.post('/api/withdraw', async (req, res) => {
    try {
        const { amount } = req.body;
        const config = await supabaseRequest('shop_config?id=eq.1&select=*') || [];
        const currentWithdrawn = (config && config[0]) ? parseFloat(config[0].technician_withdrawn) || 0 : 0;
        const newTotal = currentWithdrawn + (parseFloat(amount) || 0);

        await supabaseRequest('shop_config?id=eq.1', 'PATCH', { technician_withdrawn: newTotal });
        res.json({ message: "تم تحديث السحاب بنجاح" });
    } catch (err) {
        res.status(500).json({ error: "خطأ في تحديث المسحوبات" });
    }
});

// تسجيل جهاز جديد في السحاب
app.post('/api/devices', async (req, res) => {
    try {
        const { customer_name, phone_model, issue_type, notes, cost, extra_cost, is_client_order } = req.body;
        
        const newDevice = {
            id: Date.now(), 
            date_string: new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            customer_name,
            phone_model,
            issue_type: issue_type || 'سوفتوير',
            notes,
            cost: parseFloat(cost) || 0,
            extra_cost: parseFloat(extra_cost) || 0,
            status: is_client_order ? 'طلب معلق' : 'قيد الانتظار', 
            is_paid: false,
            reply_message: ''
        };
        
        await supabaseRequest('devices', 'POST', newDevice);
        res.json({ message: "تم الحفظ أونلاين بنجاح", id: newDevice.id });
    } catch (err) {
        res.status(500).json({ error: "خطأ في الحفظ السحابي" });
    }
});

// تعديل حقول أي جهاز في السحاب
app.put('/api/devices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateFields = req.body;
        
        if (updateFields.cost !== undefined) updateFields.cost = parseFloat(updateFields.cost) || 0;
        if (updateFields.extra_cost !== undefined) updateFields.extra_cost = parseFloat(updateFields.extra_cost) || 0;

        await supabaseRequest(`devices?id=eq.${id}`, 'PATCH', updateFields);
        res.json({ message: "تم التعديل على السحاب بنجاح" });
    } catch (err) {
        res.status(500).json({ error: "خطأ في تحديث البيانات" });
    }
});

// حذف جهاز نهائياً من السحاب
app.delete('/api/devices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await supabaseRequest(`devices?id=eq.${id}`, 'DELETE');
        res.json({ message: "تم الحذف من السحاب بنجاح" });
    } catch (err) {
        res.status(500).json({ error: "خطأ في الحذف" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 سيرفر طه فون يعمل بنجاح على المنفذ ${PORT}`);
});