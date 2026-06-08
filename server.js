const express = require('express');
const app = express();
const path = require('path');

app.use(express.json());

// مصفوفة الأجهزة المدعومة بالحقول المالية الجديدة لحساب المتبقي بدقة
let devices = [
    { id: "1", customer_name: "عبود", phone_model: "سامسونج", issue_type: "صيانة شريك", cost: 200, extra_cost: 40, received_from_owner: 0, notes: "تغيير شاشة", status: "مكتمل", is_paid: true, reply_message: "" },
    { id: "2", customer_name: "فهد", phone_model: "شاومي", issue_type: "سوفتوير", cost: 100, extra_cost: 40, received_from_owner: 20, notes: "فك حساب", status: "مكتمل", is_paid: true, reply_message: "" }
];
let debts = [];
let supplierDebts = [];

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === [API الأجهزة والصيانة] ===
app.get('/api/devices', (req, res) => {
    res.json({ devices: devices });
});

app.post('/api/devices', (req, res) => {
    const { customer_name, phone_model, issue_type, cost, extra_cost, received_from_owner, notes, is_client_order } = req.body;
    const newDevice = {
        id: Date.now().toString(),
        customer_name: customer_name || '',
        phone_model: phone_model || '',
        issue_type: issue_type || 'سوفتوير',
        cost: parseFloat(cost) || 0,
        extra_cost: parseFloat(extra_cost) || 0,
        received_from_owner: parseFloat(received_from_owner) || 0,
        notes: notes || '',
        status: is_client_order ? 'طلب معلق' : 'مكتمل',
        is_paid: false,
        reply_message: ''
    };
    devices.push(newDevice);
    res.status(201).json(newDevice);
});

app.put('/api/devices/:id', (req, res) => {
    const { id } = req.params;
    const index = devices.findIndex(d => d.id === id);
    if (index !== -1) {
        devices[index] = { ...devices[index], ...req.body };
        
        if (req.body.cost !== undefined) devices[index].cost = parseFloat(req.body.cost) || 0;
        if (req.body.extra_cost !== undefined) devices[index].extra_cost = parseFloat(req.body.extra_cost) || 0;
        if (req.body.received_from_owner !== undefined) devices[index].received_from_owner = parseFloat(req.body.received_from_owner) || 0;
        
        res.json(devices[index]);
    } else {
        res.status(404).json({ message: "الجهاز غير موجود" });
    }
});

app.delete('/api/devices/:id', (req, res) => {
    devices = devices.filter(d => d.id !== req.params.id);
    res.json({ success: true });
});

// === [API دفتر الديون العامة] ===
app.get('/api/debts', (req, res) => {
    res.json(debts);
});

app.post('/api/debts', (req, res) => {
    const { customer_name, amount, items_taken } = req.body;
    const debt = {
        id: Date.now().toString(),
        customer_name: customer_name || '',
        amount: parseFloat(amount) || 0,
        items_taken: items_taken || '',
        is_settled: false
    };
    debts.push(debt);
    res.json(debt);
});

app.put('/api/debts/:id', (req, res) => {
    const index = debts.findIndex(db => db.id === req.params.id);
    if (index !== -1) {
        debts[index] = { ...debts[index], ...req.body };
        if (req.body.amount !== undefined) debts[index].amount = parseFloat(req.body.amount) || 0;
        res.json(debts[index]);
    } else {
        res.status(404).json({ message: "الدين غير موجود" });
    }
});

app.delete('/api/debts/:id', (req, res) => {
    debts = debts.filter(db => db.id !== req.params.id);
    res.json({ success: true });
});

// === [API ديون الموردين والشركات] ===
app.get('/api/supplier-debts', (req, res) => {
    res.json(supplierDebts);
});

app.post('/api/supplier-debts', (req, res) => {
    const { supplier_name, supplier_phone, amount, notes } = req.body;
    const sDebt = {
        id: Date.now().toString(),
        supplier_name: supplier_name || '',
        supplier_phone: supplier_phone || '',
        amount: parseFloat(amount) || 0,
        notes: notes || '',
        is_paid: false,
        taken_date: new Date().toLocaleDateString('ar-EG'),
        settled_date: '',
        pay_method: ''
    };
    supplierDebts.push(sDebt);
    res.json(sDebt);
});

app.put('/api/supplier-debts/:id', (req, res) => {
    const index = supplierDebts.findIndex(sd => sd.id === req.params.id);
    if (index !== -1) {
        supplierDebts[index] = { ...supplierDebts[index], ...req.body };
        if (req.body.amount !== undefined) supplierDebts[index].amount = parseFloat(req.body.amount) || 0;
        res.json(supplierDebts[index]);
    } else {
        res.status(404).json({ message: "السجل غير موجود" });
    }
});

app.delete('/api/supplier-debts/:id', (req, res) => {
    supplierDebts = supplierDebts.filter(sd => sd.id !== req.params.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 السيرفر المالي يعمل بنجاح على المنفذ ${PORT}`));
