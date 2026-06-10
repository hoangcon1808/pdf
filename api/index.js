const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

// Tỷ lệ chuyển đổi từ mm sang Points (1 inch = 25.4 mm = 72 points)
const MM_TO_POINTS = 72 / 25.4;

app.post('/api/resize', upload.single('pdfFile'), async (req, res) => {
    try {
        let pdfBuffer;
        
        if (req.file) {
            pdfBuffer = req.file.buffer;
        } else if (req.body.pdfUrl) {
            const response = await axios.get(req.body.pdfUrl, { responseType: 'arraybuffer' });
            pdfBuffer = response.data;
        } else {
            return res.status(400).json({ error: 'Vui lòng cung cấp file PDF hoặc URL hợp lệ.' });
        }

        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pages = pdfDoc.getPages();
        
        // Lấy thông số cấu hình từ cấu hình frontend gửi lên
        const { resizeType, scale, standardSize, customWidth, customHeight } = req.body;

        for (const page of pages) {
            const { width, height } = page.getSize();
            let targetWidth, targetHeight;

            if (resizeType === 'scale') {
                // Thay đổi theo tỷ lệ %
                const factor = scale ? parseFloat(scale) / 100 : 0.8;
                page.scaleContent(factor, factor);
                page.setSize(width * factor, height * factor);
            } else {
                // Thay đổi theo kích thước tuyệt đối (Khổ chuẩn hoặc Tùy chỉnh)
                if (resizeType === 'standard') {
                    if (standardSize === 'A4') {
                        targetWidth = 210 * MM_TO_POINTS;
                        targetHeight = 297 * MM_TO_POINTS;
                    } else if (standardSize === 'A3') {
                        targetWidth = 297 * MM_TO_POINTS;
                        targetHeight = 420 * MM_TO_POINTS;
                    } else if (standardSize === 'Letter') {
                        targetWidth = 215.9 * MM_TO_POINTS;
                        targetHeight = 279.4 * MM_TO_POINTS;
                    }
                } else if (resizeType === 'custom') {
                    targetWidth = parseFloat(customWidth) * MM_TO_POINTS;
                    targetHeight = parseFloat(customHeight) * MM_TO_POINTS;
                }

                if (targetWidth && targetHeight) {
                    // Tính toán tỷ lệ co dãn nội dung cũ để vừa khít khổ mới
                    const scaleX = targetWidth / width;
                    const scaleY = targetHeight / height;
                    
                    page.scaleContent(scaleX, scaleY);
                    page.setSize(targetWidth, targetHeight);
                }
            }
        }

        const resizedPdfBytes = await pdfDoc.save();
        const resizedBuffer = Buffer.from(resizedPdfBytes);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="resized_document.pdf"');
        res.send(resizedBuffer);

    } catch (error) {
        console.error('Lỗi xử lý PDF:', error);
        res.status(500).json({ error: 'Có lỗi xảy ra trong quá trình xử lý PDF.' });
    }
});

module.exports = app;
