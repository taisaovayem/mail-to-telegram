# mail-to-telegram

Recived every email and send link to telegram

copy `.env.example` to `.env` and fill token key

#### Config dns

Tạo bản ghi A (Trỏ tên miền về IP)

Nhấn Add record và điền thông số:

 - Type: A

 - Name: mail

 - IPv4 address: 1.1.1.1 (your ip server)

 - Proxy status: PHẢI TẮT (Chuyển sang màu xám - DNS Only).

- Lưu ý quan trọng: Cloudflare Proxy chỉ hỗ trợ HTTP/HTTPS, nó sẽ chặn các kết nối SMTP (cổng 25). Do đó bạn phải để "DNS Only".


Tạo bản ghi MX (Chỉ đường cho Email)

Nhấn Add record lần nữa:

- Type: MX

- Name: @ (đại diện cho domain chính taisaovayem.com).

- Mail server: mail.taisaovayem.com (là cái tên bạn vừa đặt ở Bước 1).

- TTL: Auto

- Priority: 10

#### Thêm cấu hình nginx để đọc mail
```
server {
    listen 80;
    server_name mail.taisaovayem.com;

    location / {
        proxy_pass http://mail-to-telegram:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
