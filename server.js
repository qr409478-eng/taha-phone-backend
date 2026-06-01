const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; 
const DATA_FILE = path.join(__dirname, 'shop_data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const readData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify([]));
            return [];
        }
        const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(fileContent || '[]');
    } catch (e) {
        return [];
    }
};

const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// جلب الأجهزة والإحصائيات لـ طه فون
app.get('/api/devices', (req, res) => {
    try {
        const devices = readData();
        let totalSoftwareIncome = 0;
        let totalHardwareIncome = 0;

        devices.forEach(dev => {
            if (dev.is_paid && dev.status !== 'طلب معلق' && dev.status !== 'مرفوض') {
                const price = parseFloat(dev.cost) || 0;
                const costOut = parseFloat(dev.extra_cost) || 0;
                const netProfit = price - costOut;

                if (dev.issue_type === 'سوفتوير') {
                    totalSoftwareIncome += netProfit;
                } else {
                    totalHardwareIncome += netProfit;
                }
            }
        });

        res.json({
            devices: [...devices].reverse(), 
            stats: {
                totalSoftware: totalSoftwareIncome,
                myShare: totalSoftwareIncome * 0.5,
                shopShare: totalSoftwareIncome * 0.5,
                totalHardware: totalHardwareIncome
            }
        });
    } catch (err) {
        res.status(500).json({ error: "خطأ في قراءة البيانات" });
    }
});

// تسجيل جهاز جديد (داخلي أو طلب خارجي)
app.post('/api/devices', (req, res) => {
    try {
        const { customer_name, phone_model, issue_type, notes, cost, extra_cost, is_client_order } = req.body;
        const devices = readData();
        
        const newDevice = {
            id: Date.now(),
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
        
        devices.push(newDevice);
        writeData(devices);
        res.json({ message: "تم التسجيل بنجاح في نظام طه فون", id: newDevice.id });
    } catch (err) {
        res.status(500).json({ error: "خطأ في حفظ البيانات" });
    }
});

// تحديث الحالات والردود والفصل بين القبض والتسليم
app.put('/api/devices/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { status, is_paid, cost, reply_message } = req.body;
        let devices = readData();
        
        let found = false;
        devices = devices.map(dev => {
            if (dev.id == id) {
                if (status !== undefined) dev.status = status;
                if (is_paid !== undefined) dev.is_paid = is_paid;
                if (cost !== undefined) dev.cost = parseFloat(cost);
                if (reply_message !== undefined) dev.reply_message = reply_message;
                found = true;
            }
            return dev;
        });
        
        if (!found) return res.status(404).json({ error: "الجهاز غير موجود" });
        
        writeData(devices);
        res.json({ message: "تم التحديث بنجاح" });
    } catch (err) {
        res.status(500).json({ error: "خطأ في تحديث البيانات" });
    }
});

// حذف جهاز نهائياً
app.delete('/api/devices/:id', (req, res) => {
    try {
        const { id } = req.params;
        let devices = readData();
        const filteredDevices = devices.filter(dev => dev.id != id);
        writeData(filteredDevices);
        res.json({ message: "تم حذف الجهاز بنجاح من السجل" });
    } catch (err) {
        res.status(500).json({ error: "خطأ في الحذف" });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 سيرفر طه فون العالمي يعمل بكفاءة على المنفذ ${PORT}`);
});