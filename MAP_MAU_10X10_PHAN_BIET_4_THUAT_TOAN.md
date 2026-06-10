# MAP MẪU 10X10 LÀM RÕ SỰ KHÁC BIỆT GIỮA BFS, IDS, A* VÀ IDA*

## 1. Mục đích của map

Map này được thiết kế để làm rõ các khác biệt thực sự trong code của dự án:

- BFS và IDS đều tìm được rác có khoảng cách đường đi ngắn nhất, nhưng phá hòa theo thứ tự duyệt khác nhau.
- A* và IDA* sử dụng khoảng cách Manhattan để định hướng tìm kiếm.
- A* và IDA* có cùng quy tắc chọn rác trong dự án, nhưng khác cách quản lý quá trình tìm đường.
- Các hành lang và ngõ cụt làm số nút duyệt, bộ nhớ và thứ tự dọn rác khác nhau rõ rệt.

Không nên khẳng định rằng map sẽ khiến cả bốn thuật toán luôn chọn bốn ô rác khác nhau. Theo code hiện tại, A* và IDA* sử dụng cùng hàm chọn mục tiêu nên thường chọn cùng một ô rác.

## 2. Cách tải map trên giao diện

1. Mở dự án bằng trình duyệt.
2. Trong bảng `Controls`, nhấn nút `Load demo map`.
3. Chọn một trong bốn thuật toán: BFS, IDS, A* hoặc IDA*.
4. Quan sát ô rác màu vàng, sau đó nhấn `Next Step` hoặc `Run Algorithm`.
5. Nhấn `Reset map` trước khi đổi sang thuật toán khác.

Để chạy phân tích tự động:

```powershell
node analyze_distinguishing_map_10x10.mjs
```

## 3. Cấu hình map

- Kích thước: `10 x 10`
- Robot và trạm sạc: `A1`
- Thùng rác: `J10`
- Sức chứa tối đa: `3`
- Mất pin mỗi bước: `1`
- Pin ban đầu: `100`

Các ô rác:

```text
A5, E1, J1, J5, E10, J10
```

Các chướng ngại vật:

```text
B2, C2, D2, F2, G2, H2, I2,
D3, F3, I3,
B4, D4, F4, G4, I4,
B5, D5, G5, I5,
B6, D6, F6, G6, I6,
B7, F7, I7,
B8, C8, D8, F8, H8, I8,
D9, F9
```

Ký hiệu:

- `R`: Robot và trạm sạc
- `T`: Rác
- `B`: Thùng rác
- `#`: Chướng ngại vật
- `.`: Ô trống

```text
      A B C D E F G H I J
 1    R . . . T . . . . T
 2    . # # # . # # # # .
 3    . . . # . # . . # .
 4    . # . # . # # . # .
 5    T # . # . . # . # T
 6    . # . # . # # . # .
 7    . # . . . # . . # .
 8    . # # # . # . # # .
 9    . . . # . # . . . .
10    . . . . T . . . . B
```

## 4. Tình huống phân biệt đầu tiên

Từ `A1`, hai ô rác `E1` và `A5` đều cách robot đúng 4 bước:

```text
A1 → B1 → C1 → D1 → E1
A1 → A2 → A3 → A4 → A5
```

Đây là tình huống phá hòa có chủ ý.

### BFS chọn E1

BFS duyệt theo từng lớp khoảng cách và đưa hàng xóm vào hàng đợi theo thứ tự:

```text
Lên → Phải → Xuống → Trái
```

Tại `A1`, hướng lên và trái không hợp lệ. Hướng phải được đưa vào hàng đợi trước hướng xuống. Vì vậy BFS gặp `E1` trước `A5`.

Kết quả:

```text
Mục tiêu đầu tiên: E1
Hành động đầu tiên: đi sang phải
```

### IDS chọn A5

IDS tăng dần giới hạn độ sâu: `0, 1, 2, 3, 4, ...`.

Ở giới hạn 4, cả `A5` và `E1` đều có thể được tìm thấy. Tuy nhiên cách duyệt đệ quy của IDS khiến nhánh đi xuống được xét trước nhánh đi sang phải. Vì vậy IDS gặp `A5` trước.

Kết quả:

```text
Mục tiêu đầu tiên: A5
Hành động đầu tiên: đi xuống
```

### A* và IDA* chọn A5

A* và IDA* sắp xếp các ô rác theo Manhattan trước khi tìm đường. `A5` và `E1` đều có Manhattan bằng 4. Khi bằng nhau, thứ tự trong danh sách rác được giữ nguyên; map mẫu đặt `A5` trước `E1`.

Sau đó hai thuật toán tìm đường thực tế và kiểm tra pin. Vì hai đường cùng dài và đều an toàn, `A5` tiếp tục được giữ làm mục tiêu tốt nhất.

Kết quả:

```text
Mục tiêu đầu tiên: A5
Hành động đầu tiên: đi xuống
```

## 5. Vai trò của hệ thống chướng ngại vật

Các bức tường tạo thành nhiều hành lang hẹp và ngõ cụt. Điều này giúp thể hiện:

- BFS phải mở rộng tương đối đồng đều ra xung quanh.
- IDS lặp lại việc tìm kiếm từ đầu mỗi khi tăng giới hạn độ sâu.
- A* ưu tiên các ô có `f(n) = g(n) + h(n)` nhỏ.
- IDA* tìm kiếm sâu với giới hạn `f`, sau đó tăng giới hạn và tìm lại khi cần.
- Tất cả thuật toán đều phải né chướng ngại vật và không được chọn đường Manhattan xuyên qua tường.

## 6. Kết quả chạy hiện tại

Kết quả từ script `analyze_distinguishing_map_10x10.mjs`:

| Thuật toán | Mục tiêu đầu | Hành động đầu | Thứ tự dọn rác | Tổng bước | Tổng nút duyệt | Bộ nhớ đỉnh |
|---|---|---|---|---:|---:|---:|
| BFS | E1 | Phải | E1 → J1 → J5 → J10 → E10 → A5 | 72 | 863 | 68 |
| IDS | A5 | Xuống | A5 → E1 → J1 → J10 → E10 → J5 | 72 | 3591 | 80 |
| A* | A5 | Xuống | A5 → E1 → J1 → J10 → J5 → E10 | 72 | 875 | 36 |
| IDA* | A5 | Xuống | A5 → E1 → J1 → J10 → J5 → E10 | 72 | 980 | 52 |

Số liệu phản ánh cách cài đặt hiện tại của dự án, bao gồm cả những lần thuật toán tìm đường để kiểm tra pin an toàn. Vì vậy không nên dùng bảng này để kết luận chung rằng một thuật toán luôn tốt hơn thuật toán khác trong mọi trường hợp.

## 7. Nội dung trình bày khi demo

Có thể trình bày ngắn gọn như sau:

> “Map này đặt hai ô rác E1 và A5 cách robot cùng 4 bước. BFS chọn E1 vì hàng đợi của BFS ưu tiên nhánh sang phải trước nhánh đi xuống. IDS chọn A5 vì cách tìm kiếm sâu có giới hạn của IDS xét nhánh đi xuống trước trong tình huống phá hòa. A* và IDA* cũng chọn A5 vì hai rác có cùng Manhattan và A5 đứng trước trong danh sách mục tiêu. Hệ thống hành lang phía dưới giúp thể hiện rõ sự khác nhau về số nút duyệt và bộ nhớ. IDS phải tìm lại nhiều lần khi tăng giới hạn độ sâu, trong khi A* dùng heuristic để định hướng tìm kiếm.”

## 8. Điểm cần nhấn mạnh

- Khác biệt đầu tiên đến từ quy tắc phá hòa, không phải do một thuật toán tìm được đường ngắn hơn.
- Cả bốn thuật toán đều kiểm tra pin trước khi chấp nhận ô rác.
- A* và IDA* có cùng cách chọn rác trong code hiện tại.
- Sự khác nhau lớn nhất giữa A* và IDA* nằm ở cách tìm đường và quản lý bộ nhớ, không nằm ở mục tiêu cuối cùng.
