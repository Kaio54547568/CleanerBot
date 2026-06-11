# CÁC MAP MẪU 10X10 PHỤC VỤ DEMO

## 1. Cách sử dụng

Trong bảng `Controls`, mở dropdown `Load demo map` và chọn map cần sử dụng. Map được tải ngay sau khi chọn.

Để thử lại cùng map với thuật toán khác:

1. Chọn map từ dropdown.
2. Chọn thuật toán.
3. Quan sát ô rác mục tiêu màu vàng.
4. Nhấn `Next Step` để giải thích từng bước hoặc `Run Algorithm` để chạy toàn bộ.
5. Chọn lại map từ dropdown trước khi thử thuật toán tiếp theo.

Tất cả preset đều có kích thước `10x10`.

Chạy phân tích tự động bằng lệnh:

```powershell
node analyze_demo_maps.mjs
```

## 2. Map Equal-distance targets

### Mục đích demo

Minh họa cách các thuật toán phá hòa khi có nhiều ô rác gần robot như nhau.

Robot bắt đầu tại `E5`. Hai ô rác `E2` và `H5` đều cách robot 3 bước.

- BFS chọn `E2` vì thứ tự mở rộng của BFS ưu tiên hướng lên trước hướng phải.
- IDS chọn `H5` do thứ tự duyệt sâu trong trường hợp phá hòa.
- A* và IDA* chọn `H5` vì hai rác có cùng Manhattan và `H5` đứng trước trong danh sách rác.

Map này phù hợp để giải thích rằng hai thuật toán cùng tìm đường ngắn nhất vẫn có thể chọn mục tiêu khác nhau khi nhiều lựa chọn có chi phí bằng nhau.

## 3. Map Long wall detour

### Mục đích demo

So sánh cách BFS, IDS, A* và IDA* tìm đường khi khoảng cách Manhattan không thể hiện được quãng đường thực tế.

Một bức tường dài từ `E1` đến `E8` buộc robot phải đi xuống gần cuối bản đồ rồi mới có thể sang khu vực bên phải.

Map này phù hợp để quan sát:

- Algorithm Trace và thứ tự node được duyệt.
- Tổng số `Visited nodes`.
- `Required memory`.
- Khác biệt giữa tìm kiếm không heuristic và tìm kiếm sử dụng Manhattan.
- Việc heuristic vẫn có thể hướng về phía mục tiêu dù đang bị tường chắn.

## 4. Map Battery reserve

### Mục đích demo

Minh họa việc robot ưu tiên an toàn pin thay vì hút ô rác đang ở ngay gần.

Robot bắt đầu tại `E5` với `40%` pin, mất `5%` pin cho mỗi bước. Trạm sạc ở `A1`.

- Quãng đường từ `E5` về `A1` dài 8 bước và tiêu thụ đúng `40%` pin.
- Rác tại `E4` chỉ cách robot 1 bước.
- Nếu robot đi tới `E4`, hút rác rồi mới về trạm, tổng pin yêu cầu lớn hơn `40%`.

Vì vậy thuật toán không chọn rác gần mà chọn trạm sạc trước. Map này phù hợp để giải thích hàm kiểm tra hành trình an toàn và lý do ô rác gần nhất chưa chắc được chọn.

## 5. Map Capacity and trash can

### Mục đích demo

Minh họa cách sức chứa làm thay đổi mục tiêu của robot.

Robot có sức chứa tối đa bằng `2`. Các ô rác đầu tiên nằm gần nhau tại `A2`, `A3` và `A4`, trong khi thùng rác nằm tại `J5`.

Sau khi hút hai ô rác:

- Sức chứa đạt `2/2`.
- Robot ngừng chọn rác tiếp theo.
- Mục tiêu chuyển sang thùng rác `J5`.
- Sau khi đổ rác, robot tiếp tục chọn các ô rác còn lại.

Map này phù hợp để giải thích thứ tự ưu tiên nghiệp vụ: khi khoang đầy, việc đi đổ rác quan trọng hơn việc chọn rác gần.

## 6. Map Capacity 4/5, charge first

### Mục đích demo

Minh họa trường hợp robot chưa đầy khoang chứa nhưng vẫn quyết định sạc trước khi nhặt rác tiếp theo.

Trạng thái ban đầu:

- Robot ở `E5`, pin còn `20%`, đang chứa `4/5` rác.
- Trạm sạc ở `A5`.
- Rác tiếp theo ở `F5`, chỉ cách robot 1 bước.
- Thùng rác ở `E1`.
- Mỗi bước di chuyển mất `5%` pin.

Robot đủ đúng `20%` pin để đi từ `E5` về trạm sạc `A5`. Tuy nhiên, nếu robot đi tới `F5` và hút rác:

- Khoang chứa sẽ đạt `5/5`.
- Robot bắt buộc phải đi đến thùng rác `E1`.
- Sau khi đổ rác, robot vẫn phải đủ pin quay về trạm sạc `A5`.
- Tổng lượng pin hiện tại không đủ cho chuỗi hành động an toàn đó.

Vì vậy, mục tiêu đầu tiên của robot là `A5`, không phải ô rác `F5`. Sau khi sạc đầy, robot mới quay lại `F5`, hút rác, đi đổ tại `E1` và trở về trạm sạc.

Map này phù hợp để giải thích rằng robot không chỉ kiểm tra pin để đi tới ô rác, mà còn tính cả hành trình bắt buộc sau khi hút rác.

## 7. Gợi ý trình tự demo

Nên trình bày theo thứ tự:

1. `Equal-distance targets`: giải thích cách chọn mục tiêu và phá hòa.
2. `Long wall detour`: giải thích cách tìm đường, tránh vật cản và so sánh metrics.
3. `Battery reserve`: giải thích kiểm tra pin trước khi chấp nhận mục tiêu.
4. `Capacity 4/5, charge first`: giải thích robot dự đoán hậu quả sau khi hút rác.
5. `Capacity and trash can`: giải thích robot đổi mục tiêu theo trạng thái sức chứa.

Trình tự này đi từ quyết định tìm kiếm cơ bản đến các ràng buộc nghiệp vụ của CleanerBot.

## 8. Lưu ý khi so sánh

- A* và IDA* đang sử dụng cùng quy tắc chọn rác, nên thường chọn cùng mục tiêu.
- Số node duyệt bao gồm cả những lần tìm đường để kiểm tra pin an toàn.
- Tổng số bước của toàn nhiệm vụ phụ thuộc cả thứ tự chọn rác, đường đi, số lần hút, đổ và sạc.
- Một map không thể hiện tốt mọi khác biệt; mỗi preset được thiết kế để tập trung vào một câu hỏi demo cụ thể.
