# SCRIPT THUYẾT TRÌNH DỰ ÁN CLEANERBOT

> Thời lượng gợi ý: khoảng 8-10 phút.  
> Nội dung tập trung vào bốn thuật toán: BFS, IDS, A* và IDA*.

---

## PHẦN 1. GIỚI THIỆU

**Lời thuyết trình:**

Xin chào thầy/cô và các bạn.

Nhóm chúng em xin trình bày dự án **CleanerBot**, một ứng dụng mô phỏng robot hút bụi tự động trên bản đồ dạng lưới hai chiều.

Nhiệm vụ của robot là tìm và thu gom toàn bộ rác trên bản đồ. Trong quá trình hoạt động, robot phải tránh vật cản, quản lý sức chứa, tính toán lượng pin, đi đổ rác khi cần thiết và quay về trạm sạc sau khi hoàn thành.

Trong phần trình bày này, nhóm tập trung vào bốn thuật toán tìm kiếm:

- BFS;
- IDS;
- A*;
- IDA*.

Mục tiêu của dự án là quan sát cách các thuật toán trên tìm đường đến cùng một mục tiêu, đồng thời so sánh thời gian xử lý, số node đã duyệt, bộ nhớ ước lượng và lượng pin tiêu thụ.

Ứng dụng được xây dựng bằng HTML, CSS và JavaScript thuần. Người dùng có thể tạo bản đồ, chỉnh sửa các đối tượng, lựa chọn thuật toán và theo dõi quá trình robot hoạt động theo từng bước.

---

## PHẦN 2. CÁC LUẬT HOẠT ĐỘNG

**Lời thuyết trình:**

Trước khi trình bày từng thuật toán, nhóm xin giới thiệu các luật chung mà robot phải tuân theo.

Robot được phép di chuyển theo bốn hướng: lên, xuống, trái và phải. Robot không được đi ra ngoài bản đồ hoặc đi vào ô có vật cản.

Mỗi bước di chuyển làm giảm pin theo thông số `batteryLoss`. Hành động hút rác và đổ rác cũng tiêu tốn một đơn vị pin.

Robot có một sức chứa tối đa. Khi sức chứa đã đầy, robot không thể hút thêm rác mà phải đi đến thùng rác để đổ.

Robot chỉ có thể:

- hút rác khi đang đứng trên ô có rác;
- đổ rác khi đang đứng tại thùng rác;
- sạc pin khi đang đứng tại trạm sạc.

Nhiệm vụ chỉ được xem là hoàn thành khi thỏa mãn đồng thời ba điều kiện:

1. Trên bản đồ không còn rác.
2. Robot không còn mang rác.
3. Robot đã quay về trạm sạc.

Như vậy, robot không chỉ cần tìm đường ngắn đến rác mà còn phải bảo đảm đủ pin và xử lý đầy đủ lượng rác đang mang.

---

## PHẦN 3. TRÌNH BÀY VỀ MAP

**Lời thuyết trình:**

Bản đồ được biểu diễn bằng một ma trận hai chiều. Mỗi ô có thể là ô trống hoặc chứa robot, rác, vật cản, trạm sạc hay thùng rác.

Khi sinh bản đồ tự động:

- robot và trạm sạc được đặt tại góc trên bên trái;
- thùng rác được đặt tại góc dưới bên phải;
- rác và vật cản được đặt ngẫu nhiên.

Vật cản không được đặt hoàn toàn tùy ý. Mỗi khi thử thêm một vật cản, chương trình kiểm tra xem toàn bộ khu vực có thể đi có còn liên thông hay không. Vật cản chỉ được giữ lại nếu robot vẫn có thể tiếp cận tất cả các ô trống.

Sau khi tạo vật cản, chương trình chỉ sinh rác trên các ô hợp lệ mà robot có thể đi đến. Vì vậy, đối với bản đồ sinh tự động, rác sẽ không bị vật cản bao kín.

Ứng dụng cũng cung cấp Map Editor để người dùng tự thêm hoặc di chuyển rác, vật cản, trạm sạc, thùng rác và vị trí bắt đầu của robot.

Map chỉnh sửa thủ công có thể bị mất liên thông nếu người dùng tự tạo một vùng bị chặn hoàn toàn. Đây là một giới hạn cần lưu ý khi thử nghiệm.

---

## PHẦN 4. CƠ CHẾ CHUNG CỦA CÁC THUẬT TOÁN

### 4.1. Thuật toán kết nối với ứng dụng như thế nào?

**Lời thuyết trình:**

BFS, IDS, A* và IDA* sử dụng chung một bộ điều phối hoạt động.

Tại mỗi bước, thuật toán nhận trạng thái hiện tại, bao gồm vị trí robot, lượng pin, sức chứa, vị trí rác, vật cản, thùng rác và trạm sạc.

Thuật toán không trực tiếp thay đổi bản đồ. Nó chỉ trả về một action tiếp theo, ví dụ:

```text
UP, DOWN, LEFT, RIGHT,
SUCK_TRASH, LET_TRASH_OUT,
CHARGE hoặc STAY
```

Simulator nhận action này và gửi sang Environment. Environment kiểm tra action có hợp lệ hay không, cập nhật trạng thái, sau đó giao diện hiển thị kết quả mới.

Luồng hoạt động:

```text
Thuật toán nhận state
    -> chọn mục tiêu
    -> tìm đường đến mục tiêu
    -> trả action đầu tiên của đường đi
    -> Environment thực hiện action
    -> thuật toán nhận state mới ở bước tiếp theo
```

### 4.2. Thứ tự ưu tiên hành động

Mỗi lần được gọi, robot xử lý theo thứ tự:

1. Nếu nhiệm vụ đã hoàn thành, robot đứng yên.
2. Nếu đang ở thùng rác và cần đổ, robot đổ rác.
3. Nếu đang ở trạm sạc và cần sạc, robot sạc pin.
4. Nếu đang đứng trên rác, còn sức chứa và đủ pin, robot hút rác.
5. Nếu không có action tại chỗ, robot chọn mục tiêu và tìm đường.

Vì vậy, khi demo, robot có thể không đi đến rác ngay. Nó có thể ưu tiên sạc pin hoặc đổ rác trước vì đó là hành động cần thiết để tiếp tục nhiệm vụ an toàn.

### 4.3. Cách chọn mục tiêu chung

Robot lựa chọn mục tiêu theo trạng thái:

```text
Nếu đã hết rác và không còn mang rác:
    mục tiêu là trạm sạc.

Nếu sức chứa đã đầy hoặc đã hút rác cuối cùng:
    mục tiêu là thùng rác.

Nếu còn rác và còn sức chứa:
    mục tiêu là một rác có thể tiếp cận và an toàn về pin.

Nếu không đủ pin để làm việc tiếp:
    mục tiêu là trạm sạc.
```

Từng thuật toán có cách tìm và đánh giá đường đi khác nhau, nhưng đều phải tuân theo các điều kiện mục tiêu chung này.

### 4.4. Cách ưu tiên pin

**Lời thuyết trình:**

Trước khi chọn một mục tiêu, robot không chỉ tính pin để đi đến đó. Robot tính cả hành trình an toàn sau khi đến mục tiêu.

Nếu mục tiêu là trạm sạc:

```text
pin cần = chi phí từ robot đến trạm sạc
```

Nếu mục tiêu là thùng rác:

```text
pin cần =
    chi phí đến thùng rác
  + chi phí đổ rác
  + chi phí từ thùng rác về trạm sạc
```

Nếu mục tiêu là rác và hút xong chưa đầy:

```text
pin cần =
    chi phí đến rác
  + chi phí hút rác
  + chi phí từ rác về trạm sạc
```

Nếu mục tiêu là rác và hút xong sẽ đầy:

```text
pin cần =
    chi phí đến rác
  + chi phí hút rác
  + chi phí từ rác đến thùng rác
  + chi phí đổ rác
  + chi phí từ thùng rác về trạm sạc
```

Chi phí di chuyển được tính bằng:

```text
số bước thực tế của đường đi * batteryLoss
```

Robot chỉ chọn mục tiêu khi:

```text
pin hiện tại >= pin cần thiết
```

Do đó, một rác nhìn có vẻ gần vẫn có thể bị bỏ qua nếu sau khi hút, robot không đủ pin để về trạm sạc hoặc đi đổ rác.

**Mẫu giải thích khi demo:**

> Robot đang quay về trạm sạc vì pin hiện tại không đủ cho một chu trình an toàn gồm đi đến rác, hút rác và quay về. Việc quay về sạc là quyết định có chủ đích, không phải robot đi sai đường.

### 4.5. Cách né vật cản

Từ mỗi vị trí, thuật toán tạo tối đa bốn ô hàng xóm.

Trước khi đưa một ô vào cấu trúc tìm kiếm, chương trình kiểm tra:

- ô có nằm trong bản đồ hay không;
- ô có chứa vật cản hay không.

Các ô không hợp lệ bị loại ngay trong quá trình tìm đường. Vì vậy, BFS, IDS, A* và IDA* đều có thể lập một route đi vòng quanh vật cản.

**Mẫu giải thích khi demo:**

> Robot không đi thẳng đến mục tiêu vì ô phía trước có vật cản. Thuật toán đã loại ô đó khỏi các hướng hợp lệ và chọn bước đầu của một đường vòng có thể đi được.

### 4.6. Từ đường đi thành action

Sau khi tìm được một đường đi, robot không thực hiện toàn bộ đường cùng lúc.

Ví dụ, route tìm được là:

```text
(0,0) -> (1,0) -> (1,1) -> (2,1)
```

Robot chỉ so sánh hai ô đầu:

```text
(0,0) -> (1,0)
```

Vì tọa độ `x` tăng một đơn vị, action tiếp theo là `RIGHT`.

Sau khi action được thực hiện, thuật toán nhận trạng thái mới và tiếp tục quyết định bước tiếp theo.

### 4.7. Cache đường đi

Đường đi đã tìm được được lưu trong cache. Ở bước tiếp theo, nếu mục tiêu và cấu trúc vật cản không thay đổi, robot tiếp tục sử dụng phần đường còn lại thay vì tìm lại từ đầu.

Route bị xóa và tìm lại khi:

- mục tiêu thay đổi;
- vật cản hoặc kích thước map thay đổi;
- robot không còn nằm trên route;
- chương trình phát hiện robot đang lặp qua lại giữa hai ô.

### 4.8. Cách chống lặp vô hạn

Chương trình có hai lớp chống lặp.

#### Chống lặp trong quá trình tìm đường

- BFS dùng `visited`: ô đã được đưa vào queue sẽ không được thêm lại.
- IDS dùng `pathSet`: không quay lại ô đang nằm trên nhánh hiện tại.
- IDS còn dùng `bestDepthByNode`: bỏ qua đường dài hơn đến cùng một ô.
- A* dùng `closedSet` và `gScore`: không mở rộng lại một đường không tốt hơn.
- IDA* dùng `pathSet` và `bestDepthByNode`.

Nhờ đó, một lần tìm đường không đi vòng mãi trong bản đồ hữu hạn.

#### Chống lặp khi robot đang di chuyển

Các thuật toán lưu những vị trí gần nhất của robot.

Nếu bốn vị trí cuối có dạng:

```text
A -> B -> A -> B
```

chương trình xác định robot đang lặp giữa hai ô.

Khi đó:

1. Route hiện tại bị xóa.
2. Thuật toán tìm lại đường.
3. Bước đầu quay về ô vừa đi qua bị cấm.

**Mẫu giải thích khi demo:**

> Chương trình phát hiện robot đang lặp giữa hai ô A và B. Vì vậy route cũ được hủy và thuật toán tìm một đường khác, đồng thời không cho bước đầu tiên quay lại ô trước.

Giới hạn hiện tại là cơ chế này chủ yếu phát hiện vòng lặp hai ô. Simulator cũng chưa có giới hạn `maxSteps`, nên một trường hợp không có lời giải vẫn có thể không tự dừng.

---

## PHẦN 5. PHẦN RIÊNG CỦA TỪNG THUẬT TOÁN

### 5.1. BFS

**Lời thuyết trình:**

BFS, hay Breadth-First Search, tìm kiếm theo chiều rộng.

BFS sử dụng một hàng đợi FIFO và mở rộng các ô theo từng lớp khoảng cách:

```text
khoảng cách 0 bước
-> khoảng cách 1 bước
-> khoảng cách 2 bước
-> tiếp tục cho đến khi gặp mục tiêu
```

Đầu tiên, vị trí robot được đưa vào queue. BFS lấy ô đầu queue, kiểm tra các hàng xóm hợp lệ và đưa những ô chưa được thăm vào cuối queue.

Khi chọn rác, BFS tìm rác an toàn đầu tiên theo từng lớp. Vì vậy, rác được chọn là rác an toàn gần nhất theo đường đi thực tế.

Khi tìm đường đến một mục tiêu cụ thể, mục tiêu đầu tiên BFS gặp là mục tiêu có số bước ngắn nhất.

Nếu có nhiều đường ngắn nhất bằng nhau, BFS ưu tiên xét hướng theo thứ tự:

```text
UP -> RIGHT -> DOWN -> LEFT
```

**Mẫu giải thích khi demo:**

> BFS chọn đi lên vì đây là bước đầu của một đường ngắn nhất đến mục tiêu. Có thể tồn tại một đường khác cùng độ dài, nhưng hướng lên được xét trước theo thứ tự của chương trình.

Ưu điểm của BFS là đầy đủ và tìm được đường ngắn nhất khi mọi bước có cùng chi phí. Nhược điểm là có thể sử dụng nhiều bộ nhớ vì phải lưu nhiều node trong queue.

### 5.2. IDS

**Lời thuyết trình:**

IDS, hay Iterative Deepening Search, thực hiện tìm kiếm sâu nhiều lần với giới hạn độ sâu tăng dần.

Quá trình diễn ra như sau:

```text
lần 1: tìm đến độ sâu 0
lần 2: tìm đến độ sâu 1
lần 3: tìm đến độ sâu 2
...
```

Trong mỗi lần tìm kiếm, nếu đã đạt giới hạn độ sâu mà chưa gặp mục tiêu, nhánh hiện tại sẽ dừng. Nếu chưa tìm được mục tiêu, IDS tăng giới hạn và tìm lại.

Khi chọn rác, IDS tìm rác ở độ sâu nhỏ nhất trước. Nếu rác đó không an toàn về pin, thuật toán loại rác đó và tiếp tục tìm rác an toàn khác.

Trong code hiện tại, IDS đảo ngược danh sách hàng xóm trước khi đệ quy. Vì vậy, trong các đường có cùng độ sâu, thứ tự xét thực tế là:

```text
LEFT -> DOWN -> RIGHT -> UP
```

**Mẫu giải thích khi demo:**

> IDS chọn hướng này vì mục tiêu được tìm thấy ở giới hạn độ sâu nhỏ nhất. Trong các đường có cùng độ sâu, thứ tự duyệt hàng xóm của code quyết định đường được chọn.

IDS có thể tìm đường ngắn nhất theo số bước giống BFS nhưng sử dụng bộ nhớ theo nhánh thấp hơn. Điểm hạn chế là các tầng nông bị duyệt lại nhiều lần.

### 5.3. A*

**Lời thuyết trình:**

A* sử dụng heuristic để định hướng tìm kiếm về phía mục tiêu.

Mỗi node được đánh giá bằng công thức:

```text
f(n) = g(n) + h(n)
```

Trong đó:

- `g(n)` là số bước thực tế từ vị trí bắt đầu đến node hiện tại;
- `h(n)` là khoảng cách Manhattan từ node hiện tại đến mục tiêu;
- `f(n)` là tổng chi phí dự kiến của đường đi qua node đó.

A* lưu các node đang chờ xét trong `openSet` và các node đã xét trong `closedSet`.

Mỗi vòng lặp, A* chọn node có `f` nhỏ nhất để mở rộng. Nếu nhiều node có cùng `f`, thuật toán ưu tiên node có `h` nhỏ hơn, tức node gần mục tiêu hơn. Nếu vẫn bằng nhau, thuật toán ưu tiên node có `g` nhỏ hơn.

Khi các hướng vẫn tương đương, thứ tự ưu tiên là:

```text
UP -> RIGHT -> DOWN -> LEFT
```

Khi gặp mục tiêu, A* lần ngược thông tin node cha để dựng lại đường đi hoàn chỉnh.

Khi chọn rác, A* thử tìm route thực tế đến các rác và chọn rác an toàn có route ngắn nhất.

**Mẫu giải thích khi demo:**

> A* chọn hướng này vì node tiếp theo có tổng chi phí dự kiến `f = g + h` thấp nhất. Một hướng khác có thể nhìn gần mục tiêu hơn, nhưng tổng chi phí của đường đi qua hướng đó cao hơn.

A* tìm được đường ngắn nhất trong mô hình hiện tại và thường mở rộng ít node hơn BFS khi heuristic hiệu quả. Tuy nhiên, thuật toán cần lưu nhiều cấu trúc dữ liệu.

### 5.4. IDA*

**Lời thuyết trình:**

IDA*, hay Iterative Deepening A*, kết hợp heuristic của A* với tìm kiếm sâu lặp.

IDA* cũng sử dụng:

```text
f(n) = g(n) + h(n)
```

Tuy nhiên, thay vì giữ toàn bộ `openSet`, IDA* tìm kiếm theo chiều sâu với một ngưỡng gọi là `bound`.

Ban đầu:

```text
bound = khoảng cách Manhattan từ điểm bắt đầu đến mục tiêu
```

Khi duyệt một node:

- nếu `f(n)` nhỏ hơn hoặc bằng bound, thuật toán tiếp tục đi sâu;
- nếu `f(n)` lớn hơn bound, nhánh đó bị cắt.

Nếu chưa tìm được mục tiêu, bound mới được đặt bằng giá trị vượt ngưỡng nhỏ nhất đã gặp và quá trình tìm kiếm được thực hiện lại.

Trong mỗi lần tìm kiếm, IDA* sắp xếp các hàng xóm theo Manhattan đến mục tiêu. Khi các hướng tương đương, thứ tự ưu tiên là:

```text
UP -> RIGHT -> DOWN -> LEFT
```

Khi chọn rác, IDA* thử tìm route đến các rác và chọn rác an toàn có route ngắn nhất.

**Mẫu giải thích khi demo:**

> IDA* chọn hướng này vì nhánh đó vẫn nằm trong giới hạn `f` hiện tại và có heuristic tốt hơn. Những hướng có `f` vượt bound đã bị cắt trong lần tìm kiếm này.

IDA* có thể tìm đường ngắn nhất giống A* nhưng thường sử dụng ít bộ nhớ hơn. Đổi lại, thuật toán có thể phải duyệt lại nhiều node qua các lần tăng bound.

---

## PHẦN 6. MẪU THUYẾT MINH KHI DEMO

### Tình huống 1: Robot chọn một rác

> Hiện tại robot còn sức chứa và trên map vẫn còn rác. Thuật toán tìm các rác có thể tiếp cận, sau đó loại những rác không an toàn về pin. Trong các mục tiêu còn lại, thuật toán chọn rác này theo chiến lược tìm kiếm riêng. Robot đang đi theo bước đầu của route đã tìm được.

### Tình huống 2: Robot quay về sạc

> Mặc dù trên map vẫn còn rác, pin hiện tại không đủ cho cả hành trình đến rác, thực hiện hút và quay về an toàn. Vì vậy, thuật toán đổi mục tiêu sang trạm sạc.

### Tình huống 3: Robot đi đến thùng rác

> Sức chứa của robot đã đầy nên robot chưa thể hút thêm rác. Mục tiêu được ưu tiên chuyển thành thùng rác. Sau khi đổ, robot mới tiếp tục chọn rác khác.

### Tình huống 4: Robot đi đường vòng

> Đường thẳng đến mục tiêu bị vật cản chặn. Thuật toán loại các ô bị chặn trong quá trình mở rộng node và tìm một route vòng có thể đi được. Hướng hiện tại là bước đầu của route đó.

### Tình huống 5: Hai thuật toán chọn hai đường khác nhau

> Hai thuật toán có thể chọn đường khác nhau vì cách mở rộng và đánh giá node khác nhau. BFS mở rộng theo từng lớp, IDS tìm theo giới hạn độ sâu, A* ưu tiên `f = g + h`, còn IDA* cắt các nhánh vượt bound. Nếu có nhiều đường tối ưu bằng nhau, thứ tự xét hàng xóm cũng ảnh hưởng đến đường được chọn.

### Tình huống 6: Robot vừa đổi hướng

> Robot vừa đổi hướng vì sau mỗi action, thuật toán nhận trạng thái mới và kiểm tra lại mục tiêu, pin và route. Nếu route cũ không còn phù hợp hoặc chương trình phát hiện nguy cơ lặp, thuật toán sẽ tìm lại đường.

---

## PHẦN 7. KẾT BÀI

**Lời thuyết trình:**

Qua dự án CleanerBot, nhóm đã xây dựng được một môi trường mô phỏng cho phép áp dụng và quan sát bốn thuật toán tìm kiếm trên cùng một bài toán.

Các thuật toán đều sử dụng chung luật hoạt động, cách chọn loại mục tiêu, cách kiểm tra pin, cách né vật cản và cơ chế chống lặp. Điểm khác biệt chính nằm ở cách chúng tìm đường:

- BFS mở rộng theo từng lớp khoảng cách.
- IDS lặp tìm kiếm sâu với giới hạn tăng dần.
- A* ưu tiên node có tổng chi phí dự kiến `f = g + h` nhỏ nhất.
- IDA* tìm kiếm sâu và cắt các nhánh có `f` vượt bound.

BFS và IDS tìm được đường ngắn nhất theo số bước nhưng có sự đánh đổi giữa bộ nhớ và thời gian. A* sử dụng heuristic để định hướng tìm kiếm. IDA* giữ khả năng định hướng của A* nhưng giảm nhu cầu bộ nhớ bằng tìm kiếm sâu lặp.

Ngoài tìm đường, dự án còn xử lý các yếu tố như vật cản, sức chứa, pin, sạc và đổ rác. Điều này giúp mô phỏng gần hơn với một bài toán thực tế thay vì chỉ tìm đường giữa hai điểm.

Hạn chế hiện tại là các thuật toán tối ưu đường đến từng mục tiêu được chọn nhưng chưa tối ưu toàn bộ thứ tự thu gom rác. Cơ chế chống lặp cũng chủ yếu xử lý trường hợp lặp giữa hai ô.

Trong tương lai, nhóm có thể tối ưu toàn bộ lịch trình, bổ sung cơ chế phát hiện vòng lặp dài hơn và nâng cấp cấu trúc dữ liệu của A*.

Phần trình bày của nhóm đến đây là kết thúc. Nhóm xin cảm ơn thầy/cô và các bạn đã lắng nghe.

---

## TÓM TẮT CÁC Ý CẦN NHỚ KHI TRẢ LỜI CÂU HỎI

| Nội dung | Câu trả lời ngắn |
|---|---|
| Thuật toán điều khiển robot thế nào? | Nhận state hiện tại và trả về một action tiếp theo |
| Tại sao robot không đi đến rác ngay? | Robot có thể cần ưu tiên đổ rác hoặc sạc pin |
| Tại sao không chọn rác gần nhất? | Rác gần có thể không an toàn về pin hoặc không phù hợp sức chứa |
| Cách ưu tiên pin | Tính cả đường đến mục tiêu, action tại mục tiêu và đường thoát an toàn |
| Cách né vật cản | Loại ô ngoài map hoặc chứa vật cản khi mở rộng node |
| Cách chống lặp khi tìm đường | Dùng `visited`, `pathSet`, `closedSet`, `gScore` hoặc `bestDepthByNode` |
| Cách chống lặp A-B-A-B | Xóa route, tìm lại và cấm bước đầu quay về ô trước |
| BFS tìm đường thế nào? | Duyệt theo từng lớp bằng queue |
| IDS tìm đường thế nào? | Lặp tìm kiếm sâu với giới hạn độ sâu tăng dần |
| A* tìm đường thế nào? | Chọn node có `f = g + h` nhỏ nhất |
| IDA* tìm đường thế nào? | Tìm kiếm sâu và cắt nhánh có `f` vượt bound |
| Điều kiện hoàn thành | Hết rác, capacity bằng 0 và robot về trạm sạc |
