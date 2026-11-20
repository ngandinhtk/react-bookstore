# Stillleaf · React

Nhà sách tối giản bằng React + Vite, giao diện tiếng Việt. Dữ liệu sách và giá là mẫu; bạn cập nhật kho sau trong `src/books.js`.

## Chạy ứng dụng

Yêu cầu Node.js 24 trở lên (sử dụng SQLite có sẵn trong Node).

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

Mở http://localhost:3001. Máy chủ phục vụ cả giao diện React và API thảo luận.

Khi phát triển, giữ `npm.cmd start` chạy trong một terminal, mở terminal khác và chạy `npm.cmd run dev`. Vite tại http://127.0.0.1:5173 chuyển tiếp `/api` sang máy chủ cổng 3001.

## Tính năng

- Tìm kiếm tên sách/tác giả không phân biệt dấu, lọc thể loại.
- Chi tiết sách, liên kết tìm kiếm tại nhà bán lẻ, gợi ý đọc.
- Túi sách lưu trên trình duyệt, giữ tương thích với danh sách đã lưu ở bản trước khi dùng cùng origin.
- Thảo luận riêng từng sách: tên hiển thị, bình luận, trả lời, ẩn nội dung có spoiler cho đến khi người đọc chủ động mở.
- API kiểm tra nội dung, giới hạn độ dài và ngăn trả lời nhầm sách. Nội dung do người dùng nhập được React hiển thị như văn bản.
- SQLite lưu bền vững tại `data/discussions.sqlite`; sao lưu toàn bộ thư mục `data` khi máy chủ đã dừng.

Bình luận dùng chung cho người truy cập cùng máy chủ, không phải dữ liệu lưu riêng trong trình duyệt. Hiện dùng tên hiển thị, chưa có đăng nhập hoặc quản trị nội dung. Bản này chưa có thanh toán, kho thực tế hay mã affiliate.

## Kiểm tra

```powershell
npm.cmd test
npm.cmd run build
```

Kiểm tra API đăng/tải bài và trả lời, xác thực dữ liệu, phân tách theo sách, dữ liệu còn sau khi mở lại SQLite và tìm kiếm tiếng Việt.

## Triển khai

Cần máy chủ Node và ổ đĩa bền vững cho thư mục `data`. Không chỉ tải `dist` lên hosting tĩnh vì phần thảo luận cần API. Mặc định chỉ lắng nghe tại loopback; đặt `HOST=0.0.0.0` và `PORT` theo môi trường triển khai nếu cần. Site cũ chưa được cập nhật. Mã React mới nằm trong thư mục này; bản HTML cũ vẫn ở `../stillleaf`.

## Cập nhật dữ liệu bằng Google Sheets

Nguồn hiện tại: tab **Book Manage**, gid `978848797`, trong bảng tính bạn đã cung cấp.

- `Tên sách`: bắt buộc; mỗi dòng một cuốn.
- `Thể loại`: dùng cho bộ lọc tự động.
- `Nội dung sách`: phần giới thiệu trên trang chi tiết.
- `Giá bán lại (Dự kiến)`: giá hiển thị, nhập số đầy đủ theo VND, ví dụ `150000`. Để trống sẽ hiện “Liên hệ giá”. Không dùng cột giá mua cá nhân.
- `buy_url`: link nơi mua sách, chỉ chấp nhận HTTP/HTTPS.
- Các cột tùy chọn có thể thêm ở cuối bảng (trong A:Z): `id`, `Tác giả`, `cover_url`, `stock`, `format`, `published`. `published=FALSE` để ẩn; trống mặc định hiện.
- Nên thêm `id` cố định trước khi bắt đầu nhận thảo luận; sau đó không thay đổi giá trị này. Nếu chưa có `id`, tên sách được dùng làm khóa, vì vậy đổi tên sách sẽ tạo danh tính mới. Đổi vị trí các dòng không ảnh hưởng thảo luận.

#### Thêm và bán máy đọc sách

Có thể quản lý máy đọc sách ngay trong tab **Book Manage**, không cần tạo cửa hàng hay bảng tính riêng. Thêm các cột `Loại sản phẩm`, `Tên sản phẩm`, `Trạng thái bán`, `Thương hiệu`, `Mô tả sản phẩm`, `Giá bán` nếu chưa có; giữ các cột `id`, `Thể loại`, `Tồn kho`, `cover_url`, `buy_url`, `published` dùng chung với sách.

- Với sách hiện có, không cần thêm `Loại sản phẩm`; các dòng đó mặc định là sách. Máy đọc sách dùng `Loại sản phẩm` bằng `Máy đọc sách` (hoặc `e-reader`), tên và trạng thái `Đang bán`.
- Nhập thương hiệu vào `Thương hiệu`, giá niêm yết VND vào `Giá bán`, số lượng vào `Tồn kho`, và thông số/tình trạng/bảo hành vào `Mô tả sản phẩm`. Có thể điền ảnh sản phẩm và đường dẫn mua ngoài như với sách.
- Nếu không có `Thể loại`, máy đọc sách được xếp tự động vào bộ lọc **Máy đọc sách**. Tồn kho 0 sẽ khóa nút đặt hàng.
- Trang sản phẩm dùng chung nút đặt hàng Messenger/Zalo. Lời nhắn sẽ ghi đúng tên máy và mã sản phẩm. Thiết bị không có thảo luận sách hoặc liên kết tìm kiếm trên nhà bán sách.

Đây là quy trình nhận đơn thủ công qua Messenger/Zalo; website chưa xử lý thanh toán hoặc trừ kho tự động. Cập nhật giá, số lượng và trạng thái trong Google Sheets.

Máy chủ đọc tối đa 1001 dòng sách trong A1:Z1002, lưu đệm 60 giây. Trang đang mở kiểm tra lại mỗi 60 giây; thay đổi có thể mất khoảng 1–2 phút để xuất hiện do thời điểm kiểm tra và bộ nhớ đệm Google. Không cần build lại khi chỉ sửa dữ liệu bảng.

Kết nối chỉ đọc, không sửa nội dung hay quyền chia sẻ bảng. Hiện URL CSV của tab truy cập được không cần đăng nhập; website chỉ trả về các trường danh mục đã chọn, không trả về ngày mua, giá mua, tiến độ đọc hay bài học cá nhân. Nếu quyền đọc của bảng thay đổi, kết nối sẽ báo lỗi và giữ bản đọc thành công gần nhất trong bộ nhớ máy chủ. Sau khi khởi động lại mà Google không truy cập được, website báo chưa tải được danh mục.

Bình luận vẫn ở SQLite, không ghi vào Google Sheets. Sửa nội dung/tồn kho trong Sheets không cần nhờ trợ lý thực hiện đồng bộ.

### Quy tắc hiển thị theo trạng thái

Chỉ dòng có cột **Trạng thái bán**, **Trạng thái sản phẩm** hoặc cột cũ **Trạng thái đọc** bằng **Đang bán** mới được đưa lên website. Không phân biệt chữ hoa/thường và bỏ khoảng trắng thừa. Các trạng thái khác hoặc ô trống đều ẩn. `published=FALSE` vẫn có thể ẩn thêm sản phẩm đang bán. Thay đổi trạng thái được đồng bộ trong khoảng 1–2 phút khi máy chủ đang chạy.

### Ảnh bìa từ thư mục Images

Đặt ảnh JPG/PNG/WebP/GIF/AVIF trong `react-bookstore/Images`. Điền `/images/tên-file.jpg` vào cột `cover_url` của Google Sheets. Ví dụ: `/images/suytuong.jpg`. Máy chủ phục vụ ảnh trực tiếp, không cần build lại khi thêm ảnh. Khi triển khai cần mang theo thư mục `Images`.

### Đặt mua qua Messenger / Zalo

Cấu hình link shop tại `src/shop.js`: `messenger` (https://m.me/tenpage), `zalo` (https://zalo.me/sodienthoai). Chỉ nhận link HTTPS trên đúng tên miền. Để trống sẽ khóa nút tương ứng; tồn kho bằng 0 sẽ khóa cả hai nút. Sau khi sửa cấu hình chạy `npm.cmd run build`.

Chi tiết sách có nút mở kênh liên hệ trong tab mới và mẫu tin nhắn chứa tên sách, mã sách, giá. Người mua có thể sao chép nội dung và dán vào cuộc trò chuyện; website không tự gửi tin nhắn.

### Giao diện song ngữ và đặt mua

Chọn VI / EN ở đầu trang. Lựa chọn được lưu trong trình duyệt. Các nhãn giao diện, thảo luận, trạng thái đặt mua, nội dung tin nhắn và định dạng giá/ngày đổi theo ngôn ngữ. Tên sách, mô tả từ Sheets và bình luận do người đọc viết giữ nguyên ngôn ngữ gốc. Từ điển giao diện ở `src/i18n.jsx`.

Hai nút Đặt qua Facebook / Đặt qua Zalo nằm trong chi tiết sách. Điền link nhận đơn của shop vào `src/shop.js`, sau đó build lại. Facebook nhận link HTTPS tại m.me, facebook.com hoặc messenger.com; Zalo nhận zalo.me. Chưa có link thì nút được khóa; tồn kho bằng 0 cũng khóa đặt mua. Không tự gửi tin nhắn khi mở link.

Kiểm tra giao diện hai ngôn ngữ: `npm.cmd run test:ui`.
