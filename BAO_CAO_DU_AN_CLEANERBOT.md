# BÁO CÁO DỰ ÁN CLEANERBOT

## 1. Giới thiệu

CleanerBot là ứng dụng web mô phỏng robot hút bụi tự động trên bản đồ dạng lưới hai chiều. Dự án được xây dựng nhằm minh họa cách các thuật toán tìm kiếm trong Trí tuệ nhân tạo giải quyết bài toán lựa chọn mục tiêu, tìm đường, tránh vật cản và quản lý tài nguyên.

Trong mô phỏng, robot có nhiệm vụ thu gom toàn bộ rác trên bản đồ. Robot chỉ mang được một số lượng rác giới hạn, phải đi đến thùng rác khi đầy và cần bảo đảm đủ pin để hoàn thành hành trình. Sau khi thu gom và đổ hết rác, robot phải quay về trạm sạc để hoàn thành nhiệm vụ.

Dự án trình bày năm chiến lược tìm kiếm gồm BFS, IDS, A*, IDA* và Greedy. Người dùng có thể chạy từng thuật toán, theo dõi quá trình hoạt động và so sánh các chỉ số như thời gian xử lý, số node đã duyệt, bộ nhớ ước lượng và lượng pin tiêu thụ.

Ứng dụng được xây dựng bằng HTML, CSS và JavaScript thuần, hoạt động trực tiếp trên trình duyệt và không yêu cầu hệ thống backend.

## 2. Mục tiêu dự án

Dự án được thực hiện với các mục tiêu chính:

- Xây dựng một môi trường mô phỏng trực quan cho robot hút bụi.
- Áp dụng các thuật toán tìm kiếm đã học vào bài toán cụ thể.
- So sánh đặc điểm và hiệu quả của BFS, IDS, A*, IDA* và Greedy.
- Mô phỏng các ràng buộc thực tế như vật cản, sức chứa và mức pin.
- Cho phép người dùng chỉnh sửa bản đồ và thông số để tạo nhiều tình huống thử nghiệm.
- Ghi nhận lịch sử hoạt động và các chỉ số để hỗ trợ đánh giá thuật toán.

Thông qua dự án, nhóm có thể hiểu rõ hơn sự khác biệt giữa thuật toán không sử dụng heuristic, thuật toán sử dụng heuristic và chiến lược tham lam cục bộ.

## 3. Mô tả bài toán

Môi trường của CleanerBot là một ma trận có chiều rộng và chiều cao do người dùng lựa chọn. Mỗi ô có thể là ô trống hoặc chứa một đối tượng như robot, rác, vật cản, trạm sạc hay thùng rác.

### 3.1. Cấu trúc và thông tin của bản đồ

Bản đồ được biểu diễn bằng lưới tọa độ hai chiều. Trục ngang được ký hiệu bằng chữ cái như A, B, C,... và trục dọc được đánh số từ 1. Trong mã nguồn, tọa độ được lưu dưới dạng `(x, y)` bắt đầu từ `(0, 0)`.

Mỗi bản đồ gồm các thành phần:

- Kích thước bản đồ: chiều rộng và chiều cao từ 4 đến 20 ô.
- Robot: có vị trí, lượng pin hiện tại, số rác đang mang và sức chứa tối đa.
- Trạm sạc: nơi robot có thể nạp lại pin; khi sinh map tự động đây cũng là vị trí bắt đầu của robot.
- Thùng rác: nơi robot đổ số rác đang mang.
- Các ô rác: mục tiêu robot cần tiếp cận và thu gom.
- Các ô vật cản: những ô robot không được phép đi vào.
- Các ô trống: những ô robot có thể di chuyển qua.

Khi sinh bản đồ tự động, robot và trạm sạc được đặt tại góc trên bên trái, còn thùng rác được đặt tại góc dưới bên phải. Rác và vật cản được phân bố trên các ô còn lại.

### 3.2. Các ràng buộc của bản đồ

Để bản đồ hợp lệ và có thể sử dụng trong mô phỏng, hệ thống áp dụng các ràng buộc sau:

- Mọi đối tượng phải nằm trong giới hạn chiều rộng và chiều cao của bản đồ.
- Một ô vật cản không được đồng thời chứa robot, trạm sạc hoặc thùng rác.
- Rác không được đặt trên vật cản, trạm sạc hoặc thùng rác.
- Trạm sạc và thùng rác không được nằm cùng một ô.
- Khi đặt vật cản lên một ô đang có rác, rác tại ô đó sẽ bị xóa.
- Khi di chuyển trạm sạc hoặc thùng rác đến một ô, rác và vật cản tại ô đó sẽ bị xóa.
- Số lượng rác không được vượt quá số ô hợp lệ còn lại sau khi trừ vị trí dành cho trạm sạc, thùng rác và vật cản.

Đối với bản đồ sinh tự động, chương trình chỉ chấp nhận một vật cản mới nếu sau khi thêm vật cản, toàn bộ vùng có thể đi vẫn liên thông. Rác sau đó chỉ được đặt trên những ô robot có thể tiếp cận từ vị trí bắt đầu. Nhờ vậy, map tự động không tạo ra ô rác bị cô lập hoàn toàn.

Map được chỉnh sửa thủ công có thể không còn liên thông vì Map Editor không kiểm tra lại tính liên thông sau mỗi thao tác. Vì vậy, để robot có khả năng hoàn thành nhiệm vụ, người tạo map cần bảo đảm:

- Từ vị trí bắt đầu tồn tại đường đi đến mọi ô rác.
- Robot có thể đi đến thùng rác để đổ rác.
- Robot có thể quay về trạm sạc.
- Mức pin tối đa và lượng pin mất mỗi bước cho phép robot thực hiện ít nhất một hành trình an toàn giữa các mục tiêu quan trọng.

Nếu một ô rác bị vật cản bao kín, thùng rác hoặc trạm sạc không thể tiếp cận, thuật toán có thể không tìm được mục tiêu hợp lệ và robot không thể hoàn thành nhiệm vụ.

### 3.3. Luật di chuyển và điều kiện hoàn thành

Robot được phép di chuyển theo bốn hướng:

- Lên.
- Xuống.
- Trái.
- Phải.

Robot không được di chuyển ra ngoài bản đồ hoặc đi vào ô có vật cản. Mỗi bước di chuyển làm giảm pin theo giá trị `batteryLoss`. Hành động hút rác và đổ rác cũng tiêu tốn một đơn vị pin.

Robot có các action:

```text
UP, DOWN, LEFT, RIGHT,
CHARGE,
SUCK_TRASH,
LET_TRASH_OUT,
STAY
```

Nhiệm vụ được xem là hoàn thành khi:

- Trên bản đồ không còn rác.
- Robot không còn mang rác.
- Robot đã quay về trạm sạc.

Điều kiện này giúp bài toán không chỉ dừng ở việc tìm và hút rác mà còn yêu cầu robot xử lý đầy đủ lượng rác đang mang và trở về vị trí an toàn.

## 4. Chức năng của hệ thống

### 4.1. Tạo bản đồ

Người dùng có thể thay đổi:

- Chiều rộng và chiều cao của bản đồ.
- Số lượng rác.
- Số lượng vật cản.
- Sức chứa tối đa của robot.
- Lượng pin mất sau mỗi bước di chuyển.

Khi sinh tự động, trạm sạc và vị trí bắt đầu của robot được đặt tại góc trên bên trái. Thùng rác được đặt tại góc dưới bên phải.

Vật cản được sinh theo tiêu chí giữ cho toàn bộ vùng có thể đi vẫn liên thông. Chương trình thử thêm từng vật cản và chỉ chấp nhận nếu vật cản đó không chia bản đồ thành các vùng tách biệt. Sau đó, rác được đặt ngẫu nhiên trên các ô hợp lệ mà robot có thể tiếp cận.

Nhờ cách xây dựng này, map sinh tự động không tạo ra rác bị vật cản bao kín. Tuy nhiên, map chỉnh sửa thủ công vẫn có thể bị mất liên thông nếu người dùng tự tạo một vùng bị chặn hoàn toàn.

### 4.2. Chỉnh sửa bản đồ

Map Editor cho phép:

- Xem thông tin của từng ô.
- Xóa rác hoặc vật cản.
- Thêm rác.
- Thêm vật cản.
- Di chuyển trạm sạc.
- Di chuyển thùng rác.
- Thay đổi vị trí bắt đầu của robot.

Sau khi chỉnh sửa, trạng thái hiện tại được lưu làm trạng thái ban đầu mới để người dùng có thể đặt lại và thử nhiều thuật toán trên cùng một bản đồ.

### 4.3. Điều khiển mô phỏng

Ứng dụng hỗ trợ:

- Chạy thuật toán tự động.
- Dừng quá trình chạy.
- Thực hiện từng action bằng Next Step.
- Quay lại trạng thái trước bằng Previous Step.
- Thay đổi tốc độ chạy.
- Tạo lại hoặc đặt lại bản đồ.

Giao diện hiển thị trạng thái robot gồm vị trí, lượng pin, sức chứa, số bước, action vừa thực hiện và action dự kiến tiếp theo.

### 4.4. Theo dõi và so sánh

Ứng dụng lưu lịch sử vị trí của robot sau từng action. Ngoài ra, hệ thống hiển thị:

- Runtime: tổng thời gian thuật toán dùng để đưa ra quyết định.
- Visited nodes: số lần thuật toán mở rộng hoặc ghi nhận một node.
- Required memory: kích thước lớn nhất của các cấu trúc tìm kiếm được theo dõi.
- Battery consumed: lượng pin thực tế đã tiêu thụ.
- Algorithm trace: thứ tự các node được thuật toán thăm.

Chức năng Compare chạy BFS, IDS, A* và IDA* độc lập trên cùng một trạng thái ban đầu. Nhờ đó, người dùng có thể quan sát trực tiếp sự khác biệt giữa các thuật toán.

## 5. Kiến trúc và tổ chức mã nguồn

Dự án được chia thành các thành phần có nhiệm vụ riêng:

| Thành phần | Chức năng |
|---|---|
| `models.js` | Định nghĩa Robot, CleanerMap, SimulationState và các action |
| `environment.js` | Sinh map, kiểm tra luật và cập nhật trạng thái |
| `simulator.js` | Điều khiển vòng lặp mô phỏng, lịch sử và tốc độ chạy |
| `render.js` | Hiển thị bản đồ, robot và thông tin trạng thái |
| `main.js` | Khởi tạo ứng dụng và xử lý tương tác người dùng |
| `compare.js` | Điều khiển giao diện so sánh thuật toán |
| `baseAlgorithm.js` | Cung cấp interface chung, hàm tiện ích và metrics |
| `js/algorithms/` | Chứa phần cài đặt các thuật toán |

Luồng hoạt động chính:

```text
Người dùng chạy mô phỏng
    -> Simulator lấy trạng thái hiện tại
    -> Thuật toán chọn một action
    -> Environment kiểm tra và thực thi action
    -> Simulator ghi lịch sử và metrics
    -> Renderer cập nhật giao diện
    -> Lặp lại đến khi hoàn thành
```

Thuật toán không trực tiếp thay đổi trạng thái. Mỗi thuật toán nhận `state` hiện tại và chỉ trả về một action tiếp theo. `Environment` là thành phần duy nhất quyết định action đó có hợp lệ và thay đổi trạng thái như thế nào.

Cách tổ chức này giúp tách biệt phần tìm kiếm khỏi luật của môi trường. Nhờ đó, các thuật toán khác nhau có thể hoạt động trên cùng một hệ thống mà không cần thay đổi giao diện hoặc Simulator.

## 6. Cách tích hợp thuật toán vào dự án

Các thuật toán sử dụng interface chung:

```js
nextAction(state)
```

`state` chứa thông tin về robot, bản đồ, pin, sức chứa và các thông số cấu hình. Hàm trả về một action như di chuyển, hút rác, đổ rác hoặc sạc pin.

`BaseAlgorithm` cung cấp các chức năng chung:

- Đo runtime.
- Ghi số node đã thăm.
- Ghi bộ nhớ ước lượng.
- Tính khoảng cách Manhattan.
- Kiểm tra ô có thể di chuyển.
- Kiểm tra robot đang ở rác, trạm sạc hoặc thùng rác.

BFS chứa thêm bộ điều phối nghiệp vụ chung, bao gồm việc chọn mục tiêu, kiểm tra pin, xử lý hút/đổ/sạc, cache đường đi và phát hiện lặp giữa hai ô. IDS, A* và IDA* tái sử dụng bộ điều phối này nhưng thay đổi cách tìm đường.

Ví dụ, khi bộ điều phối gọi:

```js
this.findPath(state, start, goal)
```

nếu đối tượng hiện tại là A*, JavaScript sẽ gọi phiên bản `findPath()` của A*. Nếu đối tượng là IDS hoặc IDA*, phiên bản `findPath()` tương ứng của thuật toán đó được sử dụng. Cơ chế kế thừa và đa hình này giúp tái sử dụng logic chung và giảm trùng lặp mã nguồn.

Greedy không kế thừa BFS vì có cách điều phối và di chuyển riêng. Thuật toán này không tìm toàn bộ đường đi mà chỉ chọn bước tiếp theo dựa trên khoảng cách Manhattan.

## 7. Các thuật toán được sử dụng

### 7.1. BFS

BFS sử dụng hàng đợi FIFO để duyệt các ô theo từng lớp khoảng cách. Thuật toán bắt đầu từ vị trí robot, lần lượt mở rộng các ô có khoảng cách một bước, hai bước và tiếp tục đến khi gặp mục tiêu.

Mỗi node của BFS lưu vị trí và đường đi từ điểm bắt đầu đến node đó. Tập `visited` ngăn cùng một ô bị đưa vào hàng đợi nhiều lần. Trong bản đồ có chi phí mỗi bước bằng nhau, BFS tìm được đường có số bước ngắn nhất.

Ưu điểm của BFS là đầy đủ và tối ưu theo số bước. Nhược điểm là có thể sử dụng nhiều bộ nhớ do phải lưu nhiều node cùng lúc.

### 7.2. IDS

IDS thực hiện tìm kiếm giới hạn độ sâu nhiều lần với giới hạn tăng dần. Lần đầu thuật toán chỉ kiểm tra node bắt đầu, sau đó cho phép đi sâu một bước, hai bước và tiếp tục tăng giới hạn cho đến khi tìm được mục tiêu.

IDS có khả năng tìm đường ngắn nhất theo độ sâu giống BFS mà không cần lưu toàn bộ các node trên một tầng cùng lúc. Đổi lại, các tầng nông phải được duyệt lại nhiều lần nên runtime có thể tăng.

### 7.3. A*

A* đánh giá node bằng công thức:

```text
f(n) = g(n) + h(n)
```

Trong đó:

- `g(n)` là số bước từ điểm bắt đầu đến node hiện tại.
- `h(n)` là khoảng cách Manhattan từ node hiện tại đến đích.
- `f(n)` là ước lượng tổng chi phí của đường đi qua node.

A* ưu tiên mở rộng node có `f` nhỏ nhất. Khoảng cách Manhattan phù hợp vì robot chỉ di chuyển theo bốn hướng và heuristic này không đánh giá cao hơn chi phí thực tế.

Trong mô hình hiện tại, A* tìm được đường ngắn nhất và thường mở rộng ít node hơn BFS khi heuristic định hướng tốt. Tuy nhiên, thuật toán cần lưu open set, closed set và các bảng điểm nên có thể sử dụng nhiều bộ nhớ.

### 7.4. IDA*

IDA* kết hợp hàm đánh giá của A* với tìm kiếm sâu lặp. Thuật toán bắt đầu với ngưỡng bằng khoảng cách Manhattan từ điểm đầu đến đích. Các nhánh có giá trị `f = g + h` vượt ngưỡng bị cắt.

Nếu chưa tìm được đích, ngưỡng mới được đặt bằng giá trị vượt ngưỡng nhỏ nhất đã gặp. Quá trình được lặp lại cho đến khi tìm thấy đường.

IDA* thường sử dụng ít bộ nhớ hơn A* vì không giữ toàn bộ open set lớn. Tuy nhiên, thuật toán có thể phải tìm kiếm lại nhiều lần khi tăng ngưỡng.

### 7.5. Greedy

Greedy trong dự án là chiến lược tham lam cục bộ. Thuật toán chọn mục tiêu gần nhất theo khoảng cách Manhattan và tại mỗi bước chọn ô lân cận làm khoảng cách đến mục tiêu giảm nhiều nhất.

Greedy có tốc độ quyết định nhanh và sử dụng rất ít bộ nhớ. Tuy nhiên, thuật toán không lập kế hoạch toàn bộ đường đi, không lưu tập visited và chỉ né vật cản ở bước kế tiếp. Vì vậy Greedy có thể quay lại ô cũ, mắc tại cực tiểu cục bộ hoặc không hoàn thành bản đồ phức tạp.

## 8. Lựa chọn mục tiêu và quản lý pin

Mỗi lần ra quyết định, nhóm thuật toán BFS, IDS, A* và IDA* xử lý theo thứ tự ưu tiên:

1. Nếu nhiệm vụ đã hoàn thành thì đứng yên.
2. Nếu đang ở thùng rác và cần đổ thì đổ rác.
3. Nếu đang ở trạm sạc và cần sạc thì sạc pin.
4. Nếu đang đứng trên rác, còn sức chứa và đủ pin thì hút rác.
5. Nếu không có action tại chỗ, lựa chọn mục tiêu tiếp theo.
6. Tìm đường đến mục tiêu và chuyển bước đầu của đường đi thành action.

Robot cần đổ rác khi sức chứa đã đầy hoặc khi trên map không còn rác nhưng robot vẫn đang mang rác.

Trước khi chọn một rác, thuật toán kiểm tra lượng pin cần thiết cho một hành trình an toàn. Lượng pin dự kiến có thể gồm:

- Chi phí đi từ robot đến rác.
- Chi phí hút rác.
- Chi phí đi từ rác đến thùng rác nếu robot sẽ đầy.
- Chi phí đổ rác.
- Chi phí quay về trạm sạc.

Chi phí di chuyển được tính bằng:

```text
movementCost = số bước của path * batteryLoss
```

BFS, IDS, A* và IDA* sử dụng đường đi thực tế do chính thuật toán tìm được để tính pin, vì vậy ảnh hưởng của vật cản được đưa vào dự đoán.

Greedy chỉ sử dụng khoảng cách Manhattan để ước lượng. Khi có vật cản, đường thực tế có thể dài hơn ước lượng, khiến Greedy đánh giá thiếu lượng pin cần thiết.

## 9. Tránh vật cản và vòng lặp

Các thuật toán tạo tối đa bốn ô hàng xóm từ mỗi vị trí. Trước khi mở rộng hoặc di chuyển đến một ô, chương trình kiểm tra ô đó có nằm trong bản đồ và có bị vật cản chiếm giữ hay không.

Các thuật toán tìm kiếm sử dụng những cấu trúc khác nhau để tránh lặp trong quá trình tìm đường:

- BFS sử dụng `visited`.
- IDS sử dụng `pathSet` và `bestDepthByNode`.
- A* sử dụng `closedKeys` và `gScore`.
- IDA* sử dụng `pathSet` và `bestDepthByNode`.

BFS và các lớp kế thừa còn lưu các vị trí gần nhất của robot. Nếu phát hiện mẫu A-B-A-B, thuật toán xóa route hiện tại và tìm lại đường trong khi tránh bước đầu quay về ô trước.

Greedy không có tập visited và không có cơ chế phát hiện A-B-A-B, nên nguy cơ lặp cao hơn.

## 10. Kết quả đạt được

Dự án đã xây dựng được một môi trường mô phỏng trực quan và trình bày năm chiến lược tìm kiếm khác nhau. Trên các bản đồ hợp lệ và phù hợp với giới hạn pin, robot có thể tự động thu gom rác, đổ rác, sạc pin, tránh vật cản và quay về trạm sạc.

Ứng dụng cho phép quan sát từng action và theo dõi cách thuật toán mở rộng node. Chức năng Compare giúp đánh giá các thuật toán trên cùng một trạng thái ban đầu.

Qua quá trình thử nghiệm và phân tích mã nguồn có thể nhận thấy:

- BFS tìm đường ngắn nhất nhưng có thể sử dụng nhiều bộ nhớ.
- IDS tìm đường ngắn nhất với mức bộ nhớ thấp hơn BFS nhưng duyệt lặp nhiều lần.
- A* sử dụng heuristic để định hướng và thường giảm số node cần mở rộng.
- IDA* giảm nhu cầu bộ nhớ so với A* nhưng có thể tăng thời gian do tìm kiếm lặp.
- Greedy đơn giản, nhanh và nhẹ nhưng có nguy cơ mắc kẹt hoặc lặp.

Các thuật toán tìm kiếm trong dự án tối ưu đường đến từng mục tiêu được chọn. Chúng chưa tối ưu toàn bộ thứ tự thu gom tất cả rác trên bản đồ.

## 11. Hạn chế và hướng phát triển

Dự án hiện vẫn có một số hạn chế:

- Map chỉnh sửa thủ công có thể bị mất liên thông.
- Một map liên thông vẫn có thể không khả thi nếu hành trình cần nhiều hơn 100 pin.
- Simulator chưa có giới hạn số bước để tự dừng khi robot không tiến triển.
- Greedy có thể lặp hoặc đánh giá thiếu pin do sử dụng khoảng cách Manhattan.
- Cơ chế chống lặp khi di chuyển chủ yếu phát hiện vòng lặp giữa hai ô.
- A* sử dụng array để lưu open set thay vì priority queue.
- BFS lưu toàn bộ path trong mỗi node nên có thể tốn bộ nhớ.
- Required memory là giá trị ước lượng theo số node, không phải lượng RAM thực tế.

Các hướng phát triển có thể thực hiện:

- Kiểm tra tính liên thông sau mỗi thao tác chỉnh sửa map.
- Thêm giới hạn `maxSteps` hoặc cơ chế phát hiện không tiến triển.
- Sử dụng priority queue cho A*.
- Lưu parent pointer thay vì sao chép toàn bộ path trong từng node.
- Bổ sung visited hoặc chiến lược thoát cực tiểu cục bộ cho Greedy.
- Thêm seed cho bộ sinh ngẫu nhiên để tái lập thí nghiệm.
- Nghiên cứu trạng thái toàn cục gồm vị trí, tập rác còn lại, sức chứa và pin để tối ưu toàn bộ nhiệm vụ.
- Bổ sung kiểm thử tự động cho việc sinh map, tìm đường và tính pin.

## 12. Kết luận

CleanerBot đã áp dụng thành công các thuật toán tìm kiếm vào một bài toán mô phỏng có nhiều ràng buộc. Dự án không chỉ minh họa việc tìm đường mà còn kết hợp lựa chọn mục tiêu, tránh vật cản, quản lý sức chứa và bảo đảm năng lượng.

Cách tổ chức hệ thống thành `Simulator`, `Environment`, `Renderer` và các lớp thuật toán giúp mã nguồn rõ ràng, dễ mở rộng và cho phép so sánh nhiều chiến lược trên cùng một môi trường.

Thông qua quá trình xây dựng dự án, nhóm có thể hiểu rõ hơn về cách chuyển một thuật toán lý thuyết thành chương trình hoạt động thực tế, sự khác biệt giữa các phương pháp tìm kiếm và các yếu tố cần cân nhắc khi thiết kế một hệ thống Trí tuệ nhân tạo đơn giản.
