const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// البيانات الخاصة بك مدمجة وجاهزة تماماً للعمل الحي أونلاين
const SUPABASE_URL = "https://buxnqmmbecgtnckygudx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1eG5xbW1iZWNndG5ja3lndWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTA3MjUsImV4cCI6MjA5NjA2NjcyNX0.jqlt5oguM2O9Bh-6rdb61XrqkoOKss8qxUGu-ZixcL0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PORT = process.env.PORT || 5000;

// ترحيب وتأكيد تشغيل السيرفر
app.get('/', (req, res) => {
    res.json({ message: "Welcome to Taha Phone Cyberpunk API System 🚀" });
});

// 🔐 نظام الحماية وتوثيق المستخدمين (Auth)
app.post('/api/auth/signup', async (req, res) => {
    const { email, password, full_name } = req.body;
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name } }
    });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ message: "تم إنشاء الحساب بنجاح", data });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    res.json({ message: "تم تسجيل الدخول بنجاح 🔥", session: data.session });
});

// 📱 إضافة جهاز جديد مع بياناته المالية والتكاليف
app.post('/api/devices', async (req, res) => {
    const { 
        user_id, customer_name, customer_phone, device_model, operation_details,
        total_price, is_paid_in_shop, external_cost_usd, external_cost_provider, is_external_cost_paid, advance_payment 
    } = req.body;

    const { data: deviceData, error: deviceError } = await supabase
        .from('devices')
        .insert([{ user_id, customer_name, customer_phone, device_model, operation_details, status: 'pending' }])
        .select()
        .single();

    if (deviceError) return res.status(400).json({ error: deviceError.message });

    const { error: financialError } = await supabase
        .from('financial_records')
        .insert([{
            device_id: deviceData.id,
            total_price: total_price || 0,
            is_paid_in_shop: is_paid_in_shop || false,
            external_cost_usd: external_cost_usd || 0,
            external_cost_provider: external_cost_provider || null,
            is_external_cost_paid: is_external_cost_paid || false,
            advance_payment: advance_payment || 0
        }]);

    if (financialError) return res.status(400).json({ error: financialError.message });
    res.status(201).json({ message: "تم تسجيل الجهاز والبيانات المالية بنجاح 🖥️", device: deviceData });
});

// 📊 جلب الحسبة الذكية والتقارير من الـ SQL View التلقائي
app.get('/api/financials/analytics', async (req, res) => {
    const { data, error } = await supabase
        .from('view_financial_analytics')
        .select('*')
        .order('record_date', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    let totalDailyCost = 0;
    let totalWeeklyCost = 0;
    let grossProgrammerIncome = 0;
    const today = new Date().toISOString().split('T')[0];
    
    data.forEach(record => {
        const recordDate = new Date(record.record_date).toISOString().split('T')[0];
        grossProgrammerIncome += parseFloat(record.programmer_share || 0);

        if (recordDate === today) {
            totalDailyCost += parseFloat(record.external_cost_usd || 0);
        }
        const diffTime = Math.abs(new Date() - new Date(record.record_date));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
            totalWeeklyCost += parseFloat(record.external_cost_usd || 0);
        }
    });

    res.json({
        records: data,
        summary: {
            total_daily_external_cost: totalDailyCost,
            total_weekly_external_cost: totalWeeklyCost,
            gross_programmer_income: grossProgrammerIncome
        }
    });
});

// ✏️ التعديل السريع والفوري على مستوى الأسطر الحسابية
app.put('/api/financials/:id', async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
        .from('financial_records')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: "تم تحديث الحسبة بنجاح 📈", data });
});

app.listen(PORT, () => {
    console.log(`⚡ Cyberpunk Server is running on port ${PORT}`);
});