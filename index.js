const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Kích thước chuẩn từ A0 đến A10 (Đơn vị: points. 1mm = 2.83465 points)
const PAPER_SIZES = {
    A0: [2384, 3370], A1: [1684, 2384], A2: [1191, 1684],
    A3: [842, 1191], A4: [595, 842], A5: [420, 595],
    A6: [298, 420], A7: [210, 298], A8: [147, 210],
    A9: [105, 147], A10: [74, 105]
};

app.post('/api/resize', upload.single('file'), async (req, res) => {
    try {
        let pdfBytes;

        // Xử lý đầu vào: File từ thiết bị hoặc URL
        if (req.file) {
            pdfBytes = req.file.buffer;
        } else if (req.body.url) {
            const url = req.body.url.trim();
            const response = await axios.get(url, { 
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } // Giảm nguy cơ bị block
            });
            pdfBytes = response.data;
        } else {
            return res.status(400).json({ error: 'Vui lòng cung cấp file hoặc URL hợp lệ.' });
        }

        const format = req.body.format || 'A4';
        let newWidth, newHeight;

        // Tính toán kích thước (chuyển mm sang points nếu tùy chỉnh)
        if (format === 'Custom') {
            newWidth = parseFloat(req.body.width) * 2.83465;
            newHeight = parseFloat(req.body.height) * 2.83465;
        } else {
            [newWidth, newHeight] = PAPER_SIZES[format];
        }

        // Đọc PDF gốc và tạo PDF mới
        const originalPdf = await PDFDocument.load(pdfBytes);
        const newPdf = await PDFDocument.create();

        // Nhúng các trang từ PDF gốc sang PDF mới với kích thước mới
        const embeddedPages = await newPdf.embedPdf(originalPdf);
        for (const embeddedPage of embeddedPages) {
            const page = newPdf.addPage([newWidth, newHeight]);
            page.drawPage(embeddedPage, {
                x: 0,
                y: 0,
                width: newWidth,
                height: newHeight,
            });
        }

        const resizedPdfBytes = await newPdf.save();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Resized_${format}.pdf"`);
        res.send(Buffer.from(resizedPdfBytes));

    } catch (error) {
        console.error('Lỗi xử lý PDF:', error.message);
        res.status(500).json({ error: 'Đã xảy ra lỗi khi xử lý file PDF.' });
    }
});

// Quan trọng nhất cho Vercel: Export thay vì Listen
module.exports = app;
