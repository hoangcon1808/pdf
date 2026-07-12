import io
import requests
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from pypdf import PdfReader, PdfWriter

# Khởi tạo Flask app, trỏ thư mục tĩnh về chính thư mục hiện tại để phục vụ index.html
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Kích thước chuẩn từ A0 đến A10 (Đơn vị: points. 1mm = 2.83465 points)
PAPER_SIZES = {
    'A0': (2384, 3370), 'A1': (1684, 2384), 'A2': (1191, 1684),
    'A3': (842, 1191), 'A4': (595, 842), 'A5': (420, 595),
    'A6': (298, 420), 'A7': (210, 298), 'A8': (147, 210),
    'A9': (105, 147), 'A10': (74, 105)
}

@app.route('/')
def serve_index():
    """Tự động trả về giao diện Frontend khi truy cập trang chủ"""
    return app.send_static_file('index.html')

@app.route('/api/resize', methods=['POST'])
def resize_pdf():
    try:
        pdf_bytes = None

        # 1. Xử lý đầu vào: Lấy file từ Upload hoặc từ URL
        if 'file' in request.files and request.files['file'].filename != '':
            pdf_bytes = request.files['file'].read()
        elif 'url' in request.form and request.form['url'].strip() != '':
            url = request.form['url'].strip()
            response = requests.get(url, timeout=15)
            response.raise_for_status()
            pdf_bytes = response.content
        else:
            return jsonify({'error': 'Vui lòng cung cấp file hoặc URL hợp lệ.'}), 400

        # 2. Tính toán kích thước mới
        format_type = request.form.get('format', 'A4')
        if format_type == 'Custom':
            width_mm = float(request.form.get('width', 0))
            height_mm = float(request.form.get('height', 0))
            new_width = width_mm * 2.83465
            new_height = height_mm * 2.83465
        else:
            new_width, new_height = PAPER_SIZES.get(format_type, (595, 842))

        # 3. Đọc PDF và Resize
        reader = PdfReader(io.BytesIO(pdf_bytes))
        writer = PdfWriter()

        for page in reader.pages:
            # Scale toàn bộ nội dung và mediabox của trang sang kích thước mới
            page.scale_to(new_width, new_height)
            writer.add_page(page)

        # 4. Lưu PDF vào bộ nhớ đệm và trả về Frontend
        output_pdf = io.BytesIO()
        writer.write(output_pdf)
        output_pdf.seek(0)

        return send_file(
            output_pdf,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'Resized_{format_type}.pdf'
        )

    except Exception as e:
        print(f"Lỗi xử lý PDF: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = 3000
    print(f"✅ Server đang chạy tại: http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
