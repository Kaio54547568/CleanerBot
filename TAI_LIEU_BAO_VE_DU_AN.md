# TÀI LIỆU HIỂU VÀ BẢO VỆ DỰ ÁN CLEANERBOT

## 1. Mục đích tài liệu

Tài liệu này giải thích chi tiết cách dự án CleanerBot hoạt động dựa trên mã nguồn hiện tại, tập trung vào các nội dung thường được hỏi khi bảo vệ:

- Map được xây dựng theo những tiêu chí nào?
- Robot chọn rác, tìm đường, né vật cản và quản lý pin như thế nào?
- BFS, DFS, IDS, A*, IDA* và Greedy khác nhau ở đâu?
- Chương trình phòng tránh vòng lặp vô hạn như thế nào?
- Các chỉ số runtime, visited nodes, required memory và battery consumed có ý nghĩa gì?
- Dự án hiện có những giới hạn nào?

Lưu ý: tài liệu mô tả **mã nguồn thực tế của dự án**, không chỉ trình bày lý thuyết chung của các thuật toán.

---

## 2. Tổng quan bài toán

CleanerBot mô phỏng một robot hút bụi di chuyển trên bản đồ dạng lưới hai chiều.

Robot cần:

1. Tìm và hút tất cả rác.
2. Không vượt quá sức chứa `maxCapacity`.
3. Khi đầy rác, đi đến thùng rác để đổ.
4. Không đi vào vật cản hoặc ra ngoài map.
5. Quản lý pin để không hết pin giữa đường.
6. Sau khi xử lý hết rác, đổ hết rác đang mang và quay về trạm sạc.

Điều kiện hoàn thành nằm trong `Environment.updateDoneStatus()`:

```js
map.done =
  map.trashPositions.length === 0 &&
  robot.capacity === 0 &&
  samePosition(robot, map.chargingStation);
```

Như vậy, chỉ hút hết rác trên map là chưa đủ. Robot phải đồng thời:

- không còn rác trên map;
- không còn mang rác;
- đang đứng tại trạm sạc.

Code liên quan: `js/environment.js`, hàm `updateDoneStatus()`.

---

## 3. Kiến trúc dự án

### 3.1. Các thành phần chính

| Thành phần | Vai trò |
|---|---|
| `models.js` | Định nghĩa action, Robot, CleanerMap và SimulationState |
| `environment.js` | Tạo map, kiểm tra luật và cập nhật trạng thái sau action |
| `simulator.js` | Gọi thuật toán từng bước, chạy liên tục và lưu lịch sử |
| `baseAlgorithm.js` | Cung cấp các hàm dùng chung và ghi metrics |
| `bfs.js` | Bộ điều phối nghiệp vụ chung và tìm đường BFS |
| `dfs.js` | Kế thừa BFS, thay cách tìm đường bằng DFS |
| `ids.js` | Kế thừa DFS/BFS, thay cách tìm đường bằng IDS |
| `astar.js` | Kế thừa BFS, thay cách tìm đường bằng A* |
| `idastar.js` | Kế thừa BFS, thay cách tìm đường bằng IDA* |
| `greedy.js` | Tự quyết định bằng khoảng cách Manhattan, không kế thừa BFS |

### 3.2. Điểm quan trọng về quan hệ kế thừa

DFS, IDS, A* và IDA* **không tự viết lại toàn bộ logic robot**. Chúng kế thừa `BFSAlgorithm`, vì vậy cùng sử dụng các quy tắc:

- khi nào hút rác;
- khi nào đổ rác;
- khi nào sạc pin;
- cách tính lượng pin an toàn;
- cache đường đi;
- phát hiện lặp qua lại giữa hai ô;
- chuyển hai ô liên tiếp thành action di chuyển.

Phần khác nhau chủ yếu là:

- cách chọn một rác để đến;
- cách tìm đường từ vị trí hiện tại đến mục tiêu.

Greedy là ngoại lệ. Greedy kế thừa trực tiếp `BaseAlgorithm`, nên có bộ điều phối và cách tính pin riêng, đơn giản hơn.

---

## 4. Mô hình dữ liệu và action

### 4.1. Robot

```js
{
  battery,       // pin hiện tại, mặc định 100
  capacity,      // số rác đang mang
  maxCapacity,   // sức chứa tối đa
  x,
  y
}
```

### 4.2. Map

```js
{
  grid_size_x,
  grid_size_y,
  start_x,
  start_y,
  trashPositions,
  obstaclePositions,
  chargingStation,
  trashCan,
  done
}
```

### 4.3. Các action hợp lệ

Trong `js/models.js`:

```js
UP, DOWN, LEFT, RIGHT,
CHARGE,
SUCK_TRASH,
LET_TRASH_OUT,
STAY
```

Mỗi lần simulator gọi thuật toán, thuật toán chỉ trả về **một action tiếp theo**. `Environment` mới là nơi kiểm tra action đó có hợp lệ và cập nhật trạng thái thực tế.

---

## 5. Tiêu chí của map và cách xây dựng map

Code chính nằm trong các hàm:

- `Environment.createInitialState()`
- `Environment.normalizeConfig()`
- `Environment.pickConnectedObstaclePositions()`
- `Environment.isWalkableAreaConnected()`
- `Environment.getReachablePositions()`

### 5.1. Giới hạn tham số

| Tham số | Giới hạn |
|---|---|
| Chiều rộng | 4 đến 20 |
| Chiều cao | 4 đến 20 |
| Số vật cản | 0 đến tổng số ô trừ 2 |
| Số rác | 0 đến số ô còn trống |
| Sức chứa | 1 đến 20 |
| Pin mất mỗi bước | 0 đến 100 |

Hai ô được dành riêng là:

- vị trí bắt đầu/trạm sạc `(0, 0)`;
- thùng rác ở góc dưới bên phải.

### 5.2. Vị trí mặc định

```js
const start = { x: 0, y: 0 };
const chargingStation = { ...start };
const trashCan = { x: gridSizeX - 1, y: gridSizeY - 1 };
```

Do đó:

- Robot bắt đầu tại trạm sạc.
- Trạm sạc ở góc trên bên trái.
- Thùng rác ở góc dưới bên phải.
- Hai ô này không được đặt vật cản khi sinh map.

### 5.3. Tiêu chí liên thông

Vật cản không được sinh hoàn toàn tùy ý. Chương trình thử thêm từng vật cản vào danh sách và chỉ giữ vật cản đó nếu tất cả ô có thể đi vẫn nằm trong cùng một miền liên thông.

Pseudo-code:

```text
obstacles = []
với mỗi ô ứng viên ngẫu nhiên:
    thử thêm ô vào obstacles
    nếu toàn bộ vùng đi được vẫn liên thông:
        giữ vật cản
    ngược lại:
        bỏ vật cản đó
```

Hàm `isWalkableAreaConnected()` thực hiện:

1. Tìm một ô không bị chặn.
2. Chạy BFS từ ô đó qua tất cả ô không có vật cản.
3. Đếm số ô BFS đến được.
4. So sánh với tổng số ô đi được.

```text
walkableCellCount = width * height - obstacleCount
map liên thông khi reachablePositions.length == walkableCellCount
```

Ý nghĩa:

- Không có khu vực trống bị vật cản bao kín.
- Robot có đường đến mọi ô không phải vật cản.
- Trạm sạc, thùng rác và tất cả rác đều có thể tiếp cận.

Nếu người dùng yêu cầu quá nhiều vật cản mà không thể đặt đủ trong khi vẫn giữ map liên thông, chương trình sẽ bỏ qua các ứng viên làm mất liên thông. Vì vậy số vật cản thực tế có thể ít hơn số lượng yêu cầu.

### 5.4. Cách sinh rác

Sau khi tạo vật cản:

1. Chạy BFS từ vị trí bắt đầu để lấy danh sách ô đến được.
2. Loại vị trí bắt đầu, thùng rác và các vật cản.
3. Trộn ngẫu nhiên danh sách còn lại.
4. Lấy đủ số lượng rác yêu cầu.

Vì map ngẫu nhiên đã được bảo đảm liên thông, mọi rác được sinh ra đều có đường đến.

### 5.5. Giới hạn của Map Editor

Map sinh ngẫu nhiên bảo đảm liên thông, nhưng Map Editor **không kiểm tra lại tính liên thông** khi người dùng tự đặt vật cản.

Hàm `placeObstacle()` chỉ kiểm tra:

- không đặt trên robot;
- không đặt trên trạm sạc;
- không đặt trên thùng rác;
- nếu ô có rác thì xóa rác ở đó.

Vì vậy người dùng có thể tự tạo map:

- có rác bị bao kín;
- trạm sạc hoặc thùng rác bị tách khỏi robot;
- không thể hoàn thành.

Khi bảo vệ có thể trình bày:

> Map sinh tự động bảo đảm tất cả ô trống liên thông. Map chỉnh tay linh hoạt hơn, nên người dùng có trách nhiệm không tạo map vô nghiệm.

### 5.6. Cách thiết kế map để so sánh thuật toán

Để so sánh công bằng:

- Dùng cùng một trạng thái ban đầu.
- Có nhiều nhánh để BFS, DFS và IDS thể hiện sự khác biệt.
- Có vật cản buộc A* và IDA* sử dụng heuristic.
- Không tạo map mất liên thông.
- Đặt `batteryLoss` vừa phải, tránh map không thể hoàn thành với 100 pin.
- Đặt số rác lớn hơn sức chứa để robot phải đi đổ rác.

Trang Compare lưu map ban đầu vào `sessionStorage`, sau đó tạo một `Environment` riêng cho từng thuật toán. Vì vậy các thuật toán chạy độc lập trên cùng một map.

---

## 6. Luật của Environment

### 6.1. Di chuyển

`Environment.moveRobot()` chỉ cho phép di chuyển khi:

1. Pin hiện tại lớn hơn 0.
2. Ô tiếp theo nằm trong map.
3. Ô tiếp theo không có vật cản.

Nếu hợp lệ:

```text
robot position = ô mới
battery = max(0, battery - batteryLoss)
steps += 1
```

### 6.2. Hút rác

Robot chỉ hút được khi:

- ô hiện tại có rác;
- sức chứa chưa đầy.

Hút rác tốn `ACTION_COST = 1` pin và tăng `steps` thêm 1.

### 6.3. Đổ rác

Robot chỉ đổ được khi:

- đang ở thùng rác;
- đang mang ít nhất một rác.

Đổ rác tốn `ACTION_COST = 1` pin, tăng `steps` và đặt `capacity = 0`.

### 6.4. Sạc pin

Robot chỉ sạc được tại trạm sạc. Một action sạc đặt pin về 100 và tăng `steps` thêm 1.

### 6.5. Action STAY

`STAY` không tốn pin và không tăng step.

Đây là lý do một thuật toán trả về `STAY` liên tục có thể khiến nút Run chạy mãi: simulator không có giới hạn số tick và chỉ tự dừng khi `map.done === true`.

---

## 7. Luồng xử lý của Simulator

Code: `js/simulator.js`.

Mỗi bước:

```text
1. Lấy snapshot trạng thái trước action.
2. Gọi algorithm.nextAction(state), hoặc dùng action đã preview.
3. Lưu state và metrics để hỗ trợ Previous Step.
4. Gọi environment.applyAction(action).
5. Tính pin tiêu thụ từ chênh lệch pin thực tế.
6. Lưu position history.
7. Nếu map.done thì dừng Run.
8. Render trạng thái mới.
```

### 7.1. Tại sao có `peekNextAction()`?

Giao diện cần hiển thị “Next action”. Nếu gọi thuật toán nhiều lần cho cùng một state, metrics và trạng thái nội bộ của thuật toán có thể bị thay đổi nhiều lần.

Simulator cache action tiếp theo:

```js
if (this.cachedNextAction === undefined) {
  this.cachedNextAction = this.algorithm.nextAction(state);
}
```

Action chỉ được tính lại sau khi action trước đã thực thi hoặc state thay đổi.

---

## 8. BaseAlgorithm: các chức năng dùng chung

Code: `js/algorithms/baseAlgorithm.js`.

### 8.1. `nextAction(state)`

Hàm này:

1. Bắt đầu đo thời gian.
2. Gọi `computeNextAction(state)`.
3. Cộng thời gian vào runtime.
4. Nếu thuật toán trả `null`, đổi thành `STAY`.

### 8.2. Khoảng cách Manhattan

```text
|x1 - x2| + |y1 - y2|
```

Khoảng cách Manhattan là số bước tối thiểu nếu robot chỉ đi trên/dưới/trái/phải và bỏ qua vật cản.

Đây là heuristic phù hợp cho A* và IDA* vì nó không bao giờ lớn hơn đường đi thực tế.

### 8.3. `canMoveTo(state, position)`

Một ô có thể đi khi:

- nằm trong biên map;
- không trùng vật cản.

Tất cả thuật toán đều dùng hàm này để loại ô không hợp lệ.

### 8.4. `chooseMoveTowardTarget()`

Hàm này được Greedy sử dụng:

1. Tạo bốn ô lân cận.
2. Sắp xếp theo khoảng cách Manhattan đến đích.
3. Chọn ô hợp lệ đầu tiên.

Hàm không lập kế hoạch cho toàn bộ đường đi, nên chỉ né vật cản ở bước kế tiếp.

### 8.5. Các metrics

- `runtimeMs`: tổng thời gian CPU dùng để đưa ra quyết định.
- `visitedNodes`: số lần gọi `recordNodeVisit()`.
- `peakMemory`: giá trị lớn nhất của số node/cấu trúc dữ liệu đang được theo dõi.
- `batteryConsumed`: chênh lệch pin thực tế sau các action.
- `trace`: tối đa 1000 lần thăm gần nhất.

`requiredMemory` là một chỉ số mô phỏng theo số node/cấu trúc tìm kiếm, **không phải số byte RAM thực tế** của trình duyệt.

---

## 9. Bộ điều phối chung của BFS, DFS, IDS, A* và IDA*

Phần này nằm trong `BFSAlgorithm.computeNextAction()` và được các lớp con kế thừa.

### 9.1. Thứ tự ưu tiên mỗi lần ra quyết định

Mỗi tick, robot xử lý theo thứ tự:

1. Ghi nhớ vị trí để phát hiện lặp hai ô.
2. Nếu map đã hoàn thành: `STAY`.
3. Nếu đang ở thùng rác, cần đổ rác và đủ pin: `LET_TRASH_OUT`.
4. Nếu đang ở trạm sạc và cần sạc: `CHARGE`.
5. Nếu đang đứng trên rác, còn sức chứa và đủ pin: `SUCK_TRASH`.
6. Chọn mục tiêu làm việc.
7. Tìm hoặc lấy lại route đến mục tiêu.
8. Nếu route lỗi, thử quay về trạm sạc.
9. Nếu phát hiện lặp A-B-A-B, tính lại route và cấm bước đầu quay lại ô trước.
10. Chuyển hai ô đầu route thành action di chuyển.

### 9.2. Cách chọn mục tiêu chung

```text
nếu đã hết rác và capacity = 0:
    mục tiêu = trạm sạc

nếu cần đổ rác:
    nếu đủ pin để đến thùng rác và sau đó về trạm sạc:
        mục tiêu = thùng rác
    ngược lại nếu đủ pin về trạm sạc:
        mục tiêu = trạm sạc
    ngược lại:
        không có mục tiêu

nếu còn rác và còn sức chứa:
    tìm một rác an toàn theo thuật toán cụ thể
    nếu có:
        mục tiêu = rác đó
    ngược lại nếu đủ pin về trạm sạc:
        mục tiêu = trạm sạc
```

### 9.3. Khi nào cần đổ rác?

`shouldEmptyTrash()` trả về true khi:

```text
capacity > 0
VÀ
(capacity đã đầy HOẶC trên map không còn rác)
```

Robot không đổ rác sau mỗi lần hút. Nó tiếp tục hút đến khi đầy sức chứa hoặc đã hút rác cuối cùng.

### 9.4. Khi nào sạc pin?

Tại trạm sạc, robot sạc khi pin chưa đầy và:

- đã ở trạng thái hoàn thành; hoặc
- cần đổ rác nhưng pin hiện tại không đủ cho hành trình an toàn; hoặc
- còn rác nhưng không tìm thấy rác nào có thể xử lý an toàn với pin hiện tại.

Sau một action `CHARGE`, pin trở về 100.

### 9.5. Công thức pin an toàn

BFS, DFS, IDS, A* và IDA* tính pin dựa trên **đường đi thực tế do thuật toán tìm thấy**, vì vậy vật cản được tính vào chi phí.

Chi phí di chuyển theo một path:

```text
movementCost = (path.length - 1) * batteryLoss
```

Nếu mục tiêu là trạm sạc:

```text
requiredBattery = chi phí từ robot đến trạm sạc
```

Nếu mục tiêu là thùng rác:

```text
requiredBattery =
    chi phí đến thùng rác
  + 1 nếu cần đổ rác
  + chi phí từ thùng rác về trạm sạc
```

Nếu mục tiêu là một rác và hút xong chưa đầy:

```text
requiredBattery =
    chi phí đến rác
  + 1 để hút rác
  + chi phí từ rác về trạm sạc
```

Nếu mục tiêu là một rác và hút xong sẽ đầy:

```text
requiredBattery =
    chi phí đến rác
  + 1 để hút
  + chi phí từ rác đến thùng rác
  + 1 để đổ rác
  + chi phí từ thùng rác về trạm sạc
```

Chỉ rác thỏa mãn:

```text
robot.battery >= requiredBattery
```

mới được coi là rác an toàn.

### 9.6. Điểm mạnh và giới hạn của chính sách pin

Điểm mạnh:

- Tính đường thoát an toàn sau khi đến mục tiêu.
- Tính chi phí hút và đổ rác.
- Tính vật cản thông qua path thực tế.
- Tránh chọn rác mà robot đến được nhưng không thể quay về.

Giới hạn:

- Chỉ bảo đảm an toàn cho mục tiêu hiện tại, không tối ưu toàn bộ thứ tự gom rác.
- Nếu một công việc cần hơn 100 pin kể cả khi pin đầy, robot không thể thực hiện.
- Không có lượng pin dự phòng; pin vừa bằng chi phí dự kiến vẫn được chấp nhận.
- Nếu `batteryLoss = 0`, di chuyển không tốn pin nhưng hút/đổ vẫn tốn 1 pin.

### 9.7. Cách chuyển route thành action

Route có dạng:

```text
[ô hiện tại, ô tiếp theo, ..., đích]
```

`getActionForRouteStep(route[0], route[1])` so sánh tọa độ:

- `y` giảm 1: `UP`
- `y` tăng 1: `DOWN`
- `x` giảm 1: `LEFT`
- `x` tăng 1: `RIGHT`

Mỗi tick robot chỉ đi một ô. Route còn lại được giữ trong cache.

### 9.8. Cache đường đi

Có hai loại cache:

- `cachedRoute`: route hiện tại đến mục tiêu đang thực hiện.
- `pathCache`: các path đã tìm giữa từng cặp điểm trên cùng cấu trúc vật cản.

`getStaticMapKey()` dựa trên kích thước map và danh sách vật cản đã sắp xếp. Rác không nằm trong map key vì rác không chặn đường.

Khi vật cản hoặc kích thước thay đổi, cache không còn khớp và route được tính lại.

### 9.9. Phòng tránh vòng lặp

Trong quá trình tìm kiếm:

- BFS và DFS dùng `visited`.
- IDS dùng `pathSet` và `bestDepthByNode`.
- A* dùng `closedKeys` và `gScore`.
- IDA* dùng `pathSet` và `bestDepthByNode`.

Nhờ đó, một lần tìm đường không mở rộng vô hạn trong map hữu hạn.

Trong quá trình robot di chuyển, BFS và các lớp con lưu tối đa 6 vị trí gần nhất. Nếu bốn vị trí cuối có mẫu:

```text
A, B, A, B
```

thuật toán xác định robot đang lặp qua lại giữa hai ô. Nó xóa route, tìm lại đường và cấm bước đầu tiên quay lại ô trước.

Giới hạn:

- Cơ chế này chỉ phát hiện lặp hai ô, không trực tiếp phát hiện vòng tròn dài hơn.
- Greedy không có `recentPositions`, nên không có cơ chế phát hiện A-B-A-B.
- Simulator không có `maxSteps`; nếu thuật toán trả `STAY` mãi, Run không tự dừng.

---

## 10. Thuật toán BFS

Code: `js/algorithms/bfs.js`.

### 10.1. Ý tưởng

BFS mở rộng theo từng lớp khoảng cách:

```text
khoảng cách 0 -> khoảng cách 1 -> khoảng cách 2 -> ...
```

Trong map mà mỗi bước có cùng chi phí, BFS tìm đường có ít bước nhất.

### 10.2. Cấu trúc dữ liệu

```js
const queue = [{ position: start, path: [start] }];
const visited = new Set([startKey]);
```

- `queue`: hàng đợi FIFO, vào trước ra trước.
- `visited`: ngăn đưa cùng một ô vào queue nhiều lần.
- Mỗi node mang theo toàn bộ path đến node đó.

### 10.3. Thứ tự xét hàng xóm

BFS ưu tiên:

```text
UP -> RIGHT -> DOWN -> LEFT
```

Nếu có nhiều đường ngắn nhất bằng nhau, thứ tự này quyết định đường được chọn trước.

### 10.4. Cách BFS chọn rác

`findNearestSafeTrashTarget()` chạy BFS từ robot.

Mỗi khi lấy một node ra khỏi queue:

1. Nếu node có rác, tính xem rác đó có an toàn về pin không.
2. Nếu an toàn, trả về ngay.
3. Nếu không, tiếp tục BFS để tìm rác khác.

Vì BFS thăm theo số bước tăng dần, rác an toàn đầu tiên được tìm thấy là rác an toàn gần nhất theo **đường đi thực tế**, không chỉ theo Manhattan.

### 10.5. Né vật cản và chống lặp

Trước khi đưa hàng xóm vào queue:

```js
if (visited.has(key) || !this.canMoveTo(state, candidate.position)) {
  continue;
}
```

`canMoveTo()` loại ô ngoài map và ô có vật cản. `visited` ngăn BFS thăm lại cùng một ô.

### 10.6. Tính chất

Trong map hữu hạn, liên thông và mỗi bước có giá 1:

- BFS đầy đủ: nếu có đường thì sẽ tìm thấy.
- BFS tối ưu theo số bước.
- BFS có thể tốn nhiều bộ nhớ vì giữ cả một lớp node.

### 10.7. Code nên mở khi thuyết trình

- `computeNextAction()`: bộ điều phối action.
- `chooseWorkTarget()`: chọn rác/thùng rác/trạm sạc.
- `findNearestSafeTrashTarget()`: chọn rác bằng BFS.
- `findPath()`: tìm đường BFS.
- `getRequiredBatteryForTarget()`: tính pin an toàn.
- `isLoopingBetweenTwoCells()`: phát hiện A-B-A-B.

---

## 11. Thuật toán DFS

Code: `js/algorithms/dfs.js`.

### 11.1. Phần được kế thừa

DFS kế thừa BFS, nên dùng nguyên:

- bộ điều phối action;
- quy tắc pin;
- logic hút/đổ/sạc;
- cache;
- phát hiện lặp hai ô.

DFS chỉ thay `findNearestSafeTrashTarget()` và `findPath()`.

### 11.2. Cấu trúc dữ liệu

```js
const stack = [{ position: start, path: [start] }];
const visited = new Set([startKey]);
```

`stack.pop()` tạo LIFO: node vào sau được xét trước.

### 11.3. Cách chọn rác

DFS đi sâu theo một nhánh. Rác an toàn đầu tiên mà DFS gặp sẽ được chọn.

Do đó:

- rác được chọn không nhất thiết gần nhất;
- đường đến rác không nhất thiết ngắn nhất;
- kết quả phụ thuộc mạnh vào thứ tự hàng xóm.

### 11.4. Né vật cản và tránh lặp

- `canMoveTo()` loại vật cản và ô ngoài map.
- `visited` ngăn thăm lại ô đã đưa vào stack.
- `maxVisits` bằng số ô đi được là một giới hạn bổ sung.

### 11.5. Tính chất

- Thường dùng ít frontier memory hơn BFS.
- Có thể tìm một đường rất dài dù tồn tại đường ngắn hơn.
- Trong map hữu hạn và có `visited`, DFS vẫn đầy đủ cho bài toán tìm đường này.
- DFS không tối ưu theo số bước.

Code quan trọng: `findNearestSafeTrashTarget()`, `findPath()` và `runDFS()`.

---

## 12. Thuật toán IDS

Code: `js/algorithms/ids.js`.

### 12.1. Ý tưởng

IDS lặp lại Depth-Limited DFS với giới hạn độ sâu tăng dần:

```text
limit = 0
limit = 1
limit = 2
...
```

IDS kết hợp:

- khả năng tìm độ sâu nhỏ nhất giống BFS;
- mức sử dụng bộ nhớ theo nhánh gần với DFS.

### 12.2. Giới hạn tối đa

```text
maxDepth = số ô đi được - 1
```

Trong một đường đơn không lặp, số cạnh tối đa giữa hai ô không vượt quá giá trị này.

### 12.3. Cách chọn rác

`findNearestTrashTarget()`:

1. Chạy depth-limited search với limit 0.
2. Nếu không thấy, tăng limit.
3. Rác đầu tiên tìm thấy ở limit nhỏ nhất là rác gần nhất theo số bước.

Sau đó `findNearestSafeTrashTarget()` kiểm tra pin:

- Nếu rác gần nhất không an toàn, đưa key của rác vào `rejectedTrashKeys`.
- Chạy lại IDS để tìm rác gần tiếp theo.
- Lặp đến khi có rác an toàn hoặc đã loại tất cả rác.

### 12.4. Cơ chế chống lặp

`pathSet` chứa các ô đang nằm trên nhánh đệ quy hiện tại. Nếu một hàng xóm đã nằm trong `pathSet`, IDS không đi vào nó.

`bestDepthByNode` lưu độ sâu tốt nhất đã đến từng ô. Nếu đã đến một ô ở độ sâu nhỏ hơn hoặc bằng, một đường mới dài hơn đến cùng ô bị bỏ qua.

### 12.5. Tính chất

- Tìm đường ngắn nhất theo số bước trong bài toán này.
- Dùng ít bộ nhớ frontier hơn BFS.
- Tốn runtime do duyệt lại các tầng nông nhiều lần.

Code quan trọng: `findNearestTrashTarget()`, `depthLimitedTargetSearch()`, `findPath()` và `depthLimitedTraverse()`.

---

## 13. Thuật toán A*

Code: `js/algorithms/astar.js`.

### 13.1. Hàm đánh giá

A* sử dụng:

```text
f(n) = g(n) + h(n)
```

Trong dự án:

- `g(n)`: số bước từ điểm bắt đầu đến `n`.
- `h(n)`: khoảng cách Manhattan từ `n` đến đích.
- `f(n)`: ước lượng tổng số bước của đường đi qua `n`.

### 13.2. Tại sao Manhattan phù hợp?

Robot chỉ đi trên/dưới/trái/phải. Nếu không có vật cản, Manhattan chính là số bước tối thiểu. Vật cản chỉ có thể làm đường dài hơn, không thể làm đường ngắn hơn.

Do đó heuristic này:

- admissible: không đánh giá quá chi phí thực;
- consistent trong grid có chi phí cạnh bằng 1.

Vì vậy A* tìm đường ngắn nhất trong mô hình này.

### 13.3. Cấu trúc dữ liệu

- `openSet`: node chờ mở rộng.
- `openKeys`: kiểm tra nhanh node có trong open set.
- `closedKeys`: node đã mở rộng.
- `cameFrom`: cha của mỗi node, dùng để dựng lại path.
- `gScore`: chi phí tốt nhất đã biết.
- `fScore`: `g + h`.

### 13.4. Chọn node tiếp theo

`findLowestScoreIndex()` chọn theo thứ tự:

1. `fScore` nhỏ hơn.
2. Nếu bằng `f`, chọn `h` nhỏ hơn, tức gần đích hơn.
3. Nếu vẫn bằng, chọn `g` nhỏ hơn.

Hàng xóm cũng được sắp xếp theo Manhattan đến đích, sau đó theo:

```text
UP -> RIGHT -> DOWN -> LEFT
```

### 13.5. Cách chọn rác

`findNearestSafeTrashTarget()`:

1. Sắp xếp rác theo Manhattan để thử rác có vẻ gần trước.
2. Chạy A* tìm route thực tế đến từng rác.
3. Bỏ rác không có route.
4. Bỏ route dài hơn hoặc bằng route tốt nhất hiện tại.
5. Bỏ rác không an toàn về pin.
6. Chọn rác an toàn có route ngắn nhất.

Manhattan chỉ dùng để sắp thứ tự thử nghiệm; kết quả cuối dựa trên độ dài path A* thực tế.

### 13.6. Tính chất

- Đầy đủ và tối ưu trong map này.
- Thường mở rộng ít node hơn BFS khi heuristic hữu ích.
- Tốn bộ nhớ cho open/closed set và các score map.
- `openSet` hiện là array; mỗi lần chọn node nhỏ nhất phải quét tuyến tính, chưa dùng priority queue.

Code quan trọng: `findNearestSafeTrashTarget()`, `runAStar()`, `findLowestScoreIndex()` và `getSortedMoveCandidates()`.

---

## 14. Thuật toán IDA*

Code: `js/algorithms/idastar.js`.

### 14.1. Ý tưởng

IDA* kết hợp:

- hàm đánh giá `f = g + h` của A*;
- tìm kiếm sâu theo kiểu DFS;
- lặp với ngưỡng `bound` tăng dần.

Bound ban đầu:

```text
bound = Manhattan(start, goal)
```

Trong mỗi lần lặp:

- Nếu `f(n) > bound`, cắt nhánh và trả về giá trị `f(n)`.
- Bound tiếp theo là giá trị vượt ngưỡng nhỏ nhất đã gặp.
- Lặp đến khi tìm thấy đích hoặc không còn bound hữu hạn.

### 14.2. Khác IDS ở đâu?

- IDS tăng giới hạn theo độ sâu: 0, 1, 2, 3, ...
- IDA* tăng giới hạn theo giá trị `f = g + h`.

IDA* có heuristic nên có thể cắt nhiều nhánh không hứa hẹn.

### 14.3. Cách chọn rác

Giống A*:

1. Thử rác theo thứ tự Manhattan.
2. Tìm path IDA* thực tế đến từng rác.
3. Chọn route an toàn ngắn nhất.

### 14.4. Né vật cản và tránh chu trình

- Lọc hàng xóm bằng `canMoveTo()`.
- `pathSet` ngăn quay lại node đang có trên nhánh.
- `bestDepthByNode` bỏ đường dài hơn đến cùng node.
- Sắp hàng xóm theo Manhattan, sau đó UP/RIGHT/DOWN/LEFT.

### 14.5. Tính chất

- Tìm đường tối ưu trong mô hình này với heuristic Manhattan.
- Thường dùng ít bộ nhớ hơn A* vì không giữ toàn bộ open set lớn.
- Có thể tốn runtime do lặp lại tìm kiếm với nhiều bound.
- `maxDepth` trong code bằng tổng số ô của map, đóng vai trò giới hạn bảo vệ.

Code quan trọng: `runIDAStar()` và `depthLimitedSearch()`.

---

## 15. Thuật toán Greedy

Code: `js/algorithms/greedy.js`.

### 15.1. Greedy trong dự án thực sự làm gì?

Greedy trong dự án không phải Greedy Best-First Search đầy đủ với open/closed set. Nó là một chiến lược ra quyết định cục bộ:

- chọn mục tiêu gần nhất theo Manhattan;
- mỗi bước chọn ô lân cận làm Manhattan giảm nhiều nhất;
- chỉ kiểm tra vật cản ở ô sắp đi.

Khi bảo vệ nên mô tả chính xác:

> Đây là greedy local navigation dựa trên Manhattan, không phải một graph-search Greedy Best-First Search đầy đủ.

### 15.2. Thứ tự quyết định

`computeNextAction()`:

1. Nếu đang ở thùng rác và có rác: đổ nếu đủ pin, không thì tìm cách sạc.
2. Nếu đang ở trạm sạc và cần sạc: sạc.
3. Nếu đang trên rác và còn sức chứa: hút nếu đủ pin, không thì tìm cách sạc.
4. Chọn mục tiêu làm việc.
5. Nếu pin hiện tại không đủ nhưng pin đầy có thể làm, quay về trạm sạc.
6. Nếu không có mục tiêu, thử quay về trạm sạc.
7. Nếu đang ở mục tiêu, thực hiện action tại mục tiêu.
8. Nếu còn đủ pin đi một bước, chọn ô lân cận gần đích nhất.

### 15.3. Cách chọn rác

Greedy:

1. Lọc các rác mà nó ước lượng pin đầy có thể xử lý.
2. Trong các rác đó, chọn rác có Manhattan nhỏ nhất từ robot.

Greedy không tìm route thực tế đến từng rác trước khi chọn.

### 15.4. Cách di chuyển và né vật cản

`chooseMoveTowardTarget()`:

1. Tạo bốn ô lân cận.
2. Sắp theo Manhattan đến mục tiêu.
3. Chọn ô đầu tiên nằm trong map và không có vật cản.

Greedy né được vật cản ở mức cục bộ, nhưng không ghi nhớ ô đã đi và không lập kế hoạch toàn tuyến.

Ví dụ, nếu đích nằm bên phải nhưng có một bức tường dài:

- Greedy có thể chọn một bước lên hoặc xuống để né ô trước mặt.
- Ở bước sau, nó có thể quay lại vì ô cũ có Manhattan tốt.
- Nó có thể lặp A-B-A-B hoặc mắc tại cực tiểu cục bộ.

### 15.5. Cách Greedy tính pin

Greedy dùng Manhattan, không dùng path thực tế:

```text
movementCost = Manhattan(from, target) * batteryLoss
```

Sau đó cộng chi phí hút/đổ và đường Manhattan về trạm sạc.

Ưu điểm:

- Tính nhanh.

Nhược điểm:

- Nếu có vật cản, đường thực tế có thể dài hơn Manhattan.
- Greedy có thể kết luận “đủ pin” trong khi pin thực tế không đủ.
- Greedy có thể không tìm được đường về sạc dù một đường vòng tồn tại.

### 15.6. Giới hạn hoàn thành

Greedy có thể:

- lặp vô hạn giữa các ô;
- đứng yên với `STAY`;
- hết pin vì ước lượng thấp hơn chi phí thực;
- không hoàn thành map có vật cản phức tạp.

Điều này thể hiện nhược điểm của chiến lược tham lam cục bộ.

Code quan trọng: `computeNextAction()`, `chooseWorkTarget()`, `getRequiredBatteryForTarget()` và `BaseAlgorithm.chooseMoveTowardTarget()`.

---

## 16. Bảng so sánh các thuật toán

| Thuật toán | Cách chọn rác | Cách tìm đường | Né vật cản | Tối ưu path | Rủi ro lặp |
|---|---|---|---|---|---|
| BFS | Rác an toàn đầu tiên theo lớp BFS | Queue FIFO | Lập kế hoạch đầy đủ | Có, theo số bước | Thấp |
| DFS | Rác an toàn đầu tiên gặp theo nhánh DFS | Stack LIFO | Lập kế hoạch đầy đủ | Không | Thấp |
| IDS | Rác an toàn ở depth nhỏ nhất | DFS giới hạn lặp tăng dần | Lập kế hoạch đầy đủ | Có, theo số bước | Thấp |
| A* | Rác an toàn có route A* ngắn nhất | `f = g + h` | Lập kế hoạch đầy đủ | Có | Thấp |
| IDA* | Rác an toàn có route IDA* ngắn nhất | DFS với bound `f` | Lập kế hoạch đầy đủ | Có | Thấp |
| Greedy | Rác có Manhattan gần nhất | Chọn bước cục bộ | Chỉ né ô kế tiếp | Không | Cao |

### 16.1. Độ phức tạp lý thuyết

Ký hiệu:

- `b`: branching factor, tối đa gần 4 trong grid.
- `d`: độ sâu lời giải ngắn nhất.
- `m`: độ sâu tối đa.

| Thuật toán | Thời gian tổng quát | Bộ nhớ tổng quát |
|---|---|---|
| BFS | `O(b^d)` | `O(b^d)` |
| DFS | `O(b^m)` | `O(bm)` |
| IDS | `O(b^d)` | `O(bd)` |
| A* | Phụ thuộc heuristic, xấu nhất exponential | Phải giữ open/closed, thường lớn |
| IDA* | Phụ thuộc heuristic và số lần tăng bound | Gần DFS, thường nhỏ hơn A* |
| Greedy cục bộ | Mỗi action xét tối đa 4 ô, nhưng có thể không kết thúc | Rất nhỏ |

Trong code hiện tại, node của BFS/DFS mang theo path đầy đủ, nên chi phí bộ nhớ thực tế có thể cao hơn mô tả frontier đơn giản trong lý thuyết.

---

## 17. Ví dụ minh họa tính pin

Giả sử:

- pin hiện tại = 30;
- `batteryLoss = 2`;
- robot cách rác 4 bước theo path thực tế;
- sau khi hút rác thì thùng sẽ đầy;
- từ rác đến thùng rác: 3 bước;
- từ thùng rác về trạm sạc: 5 bước.

Pin cần:

```text
đến rác       = 4 * 2 = 8
hút rác       = 1
đến thùng rác = 3 * 2 = 6
đổ rác        = 1
về trạm sạc   = 5 * 2 = 10
--------------------------------
tổng          = 26
```

Vì `30 >= 26`, BFS/DFS/IDS/A*/IDA* coi rác này an toàn.

Nếu pin hiện tại là 25, robot không chọn rác này. Nếu đang ở trạm sạc và pin chưa đầy, robot sẽ sạc; nếu đang ngoài trạm sạc, nó ưu tiên tìm đường về trạm sạc nếu còn đủ pin.

---

## 18. Các tình huống biên

### 18.1. Map không có rác ngay từ đầu

Điều kiện done yêu cầu robot ở trạm sạc và `capacity = 0`. Robot mặc định bắt đầu tại trạm sạc nên map có thể hoàn thành ngay.

### 18.2. Pin mất mỗi bước bằng 100

Robot chỉ đi được một bước sau mỗi lần sạc. Nếu bất kỳ công việc an toàn nào cần hơn 100 pin, robot không thể hoàn thành.

### 18.3. Pin về 0 đúng lúc đến trạm sạc

Robot vẫn sạc được vì action sạc không yêu cầu pin lớn hơn 0, chỉ yêu cầu robot đang tại trạm sạc.

### 18.4. Pin về 0 tại rác hoặc thùng rác

Environment vẫn có thể thực hiện hút/đổ và clamp pin về 0, nhưng robot không thể di chuyển tiếp. Các thuật toán tìm kiếm cố gắng ngăn tình huống này bằng cách tính pin trước.

### 18.5. Route không tồn tại

Nhóm BFS/DFS/IDS/A*/IDA*:

- thử chuyển mục tiêu về trạm sạc;
- nếu vẫn không có route thì trả `STAY`.

Nếu map chỉnh tay bị mất liên thông, simulator có thể chạy `STAY` mãi.

---

## 19. Câu hỏi phản biện thường gặp

### Tại sao không đưa pin và capacity vào node tìm kiếm?

> Mỗi lần tìm đường trong dự án chỉ giải bài toán con từ vị trí hiện tại đến một mục tiêu cố định. Trong bài toán con này, trạng thái path chỉ cần vị trí và vật cản. Pin và capacity được bộ điều phối nghiệp vụ kiểm tra trước khi chọn mục tiêu. Đây là thiết kế đơn giản hóa, không phải tìm kiếm tối ưu toàn bộ chuỗi thu gom.

### A* có tối ưu toàn bộ nhiệm vụ không?

Không.

> A* tối ưu đường đi đến một mục tiêu được chọn. Dự án chọn mục tiêu theo từng lần, nên không bảo đảm thứ tự gom tất cả rác là tối ưu toàn cục.

### Tại sao BFS và IDS có thể cùng cho đường ngắn nhất?

> Vì mỗi action di chuyển có cùng chi phí theo số bước. BFS mở rộng theo lớp; IDS tìm depth nhỏ nhất bằng cách tăng limit. Cả hai gặp mục tiêu ở độ sâu ngắn nhất.

### Tại sao A* thường nhanh hơn BFS?

> A* dùng Manhattan để ưu tiên node có khả năng nằm trên đường đến đích, trong khi BFS mở rộng đều mọi hướng. Tuy nhiên runtime thực tế còn phụ thuộc map và cách triển khai; `openSet` hiện dùng array nên mỗi lần chọn min phải quét.

### Tại sao Greedy có thể thất bại dù map có đường?

> Vì Greedy chỉ chọn bước gần đích nhất tại thời điểm hiện tại, không lưu visited và không tìm toàn bộ route. Vật cản có thể tạo cực tiểu cục bộ hoặc làm robot quay lại.

### Map có bảo đảm hoàn thành không?

> Map sinh ngẫu nhiên bảo đảm liên thông, nhưng chưa bảo đảm mọi nhiệm vụ khả thi với giới hạn 100 pin. Map chỉnh tay còn có thể mất liên thông. Vì vậy “có đường” và “đủ pin để hoàn thành” là hai tiêu chí khác nhau.

### Required memory có phải RAM thực không?

> Không. Đây là peak số node/cấu trúc tìm kiếm mà thuật toán ghi nhận để so sánh tương đối, không phải phép đo byte RAM của JavaScript engine.

---

## 20. Điểm mạnh, giới hạn và hướng cải tiến

### 20.1. Điểm mạnh

- Tách rõ Environment và Algorithm.
- Map sinh ngẫu nhiên có tính liên thông.
- Có nhiều thuật toán để so sánh trên cùng map.
- Có logic pin an toàn tương đối đầy đủ cho nhóm graph-search.
- Có metrics và trace để minh họa.
- Có cache path và phát hiện lặp hai ô.
- Có Previous Step và history hỗ trợ demo.

### 20.2. Giới hạn

- Map Editor có thể tạo map mất liên thông.
- Simulator không có giới hạn step/tick.
- Greedy có thể lặp hoặc hết pin vì dùng Manhattan thay cho đường thực tế.
- Nhóm thuật toán tối ưu từng route, không tối ưu toàn bộ thứ tự gom rác.
- A* dùng array thay vì priority queue.
- BFS/DFS lưu full path trong mỗi frontier node, tốn bộ nhớ.
- Metrics memory chỉ là ước lượng theo node.
- README cũ nói IDS/A*/IDA* chưa triển khai, nhưng mã hiện tại đã triển khai.

### 20.3. Hướng cải tiến

- Kiểm tra liên thông sau mỗi lần Map Editor đặt vật cản.
- Thêm `maxSteps` hoặc watchdog để tự dừng khi không tiến triển.
- Phát hiện chu trình dài hơn bằng lịch sử state/action.
- Đổi A* sang binary heap priority queue.
- Lưu parent pointer thay vì copy full path cho từng node.
- Cho Greedy dùng visited tạm thời hoặc wall-following để giảm lặp.
- Mô hình hóa bài toán toàn cục với state gồm vị trí, tập rác còn lại, capacity và pin.
- Thêm seed cho random map để tái lập thí nghiệm.
- Thêm test tự động cho tính liên thông, pin và tính tối ưu path.

---

## 21. Gợi ý script trình bày trong 7-10 phút

### Phần 1: Bài toán

> Dự án mô phỏng robot hút bụi trên lưới hai chiều. Robot phải gom hết rác, quản lý sức chứa và pin, tránh vật cản, đổ rác, sau đó quay về trạm sạc.

### Phần 2: Map

> Map sinh ngẫu nhiên đặt robot và trạm sạc tại góc trên bên trái, thùng rác tại góc dưới bên phải. Vật cản được thêm từng ô và chỉ được chấp nhận nếu toàn bộ vùng đi được vẫn liên thông. Rác chỉ sinh trên các ô hợp lệ và có thể tiếp cận.

### Phần 3: Kiến trúc

> Environment thi hành luật. Simulator gọi thuật toán mỗi tick. Thuật toán chỉ chọn action tiếp theo. BFS là lớp chứa bộ điều phối chung cho DFS, IDS, A* và IDA*.

### Phần 4: Chọn mục tiêu và pin

> Robot ưu tiên đổ rác nếu cần, sạc nếu không đủ pin, hút rác nếu đang đứng trên rác, sau đó mới chọn mục tiêu. Trước khi chọn rác, robot tính cả chi phí đến rác, hút rác, đến điểm thoát an toàn và quay về trạm sạc.

### Phần 5: Khác biệt thuật toán

> BFS tìm theo lớp; DFS đi sâu theo nhánh; IDS lặp DFS với depth tăng dần; A* dùng `f = g + h`; IDA* dùng bound trên `f`; Greedy chỉ chọn mục tiêu và bước tiếp theo theo Manhattan.

### Phần 6: Kết quả và giới hạn

> BFS, IDS, A* và IDA* có thể tìm đường ngắn nhất trong mô hình path. DFS không tối ưu. Greedy nhanh và nhẹ nhưng có thể mắc kẹt. Dự án tối ưu từng đường con, chưa tối ưu toàn bộ lịch trình gom rác.

---

## 22. Danh sách code nên mở khi demo

1. `js/environment.js`
   - `createInitialState()`
   - `pickConnectedObstaclePositions()`
   - `isWalkableAreaConnected()`
   - `getReachablePositions()`
   - `moveRobot()`
   - `updateDoneStatus()`

2. `js/algorithms/bfs.js`
   - `computeNextAction()`
   - `chooseWorkTarget()`
   - `findNearestSafeTrashTarget()`
   - `findPath()`
   - `getRequiredBatteryForTarget()`
   - `isLoopingBetweenTwoCells()`

3. `js/algorithms/dfs.js`
   - `runDFS()`

4. `js/algorithms/ids.js`
   - `findNearestTrashTarget()`
   - `depthLimitedTraverse()`

5. `js/algorithms/astar.js`
   - `runAStar()`
   - `findLowestScoreIndex()`

6. `js/algorithms/idastar.js`
   - `runIDAStar()`
   - `depthLimitedSearch()`

7. `js/algorithms/greedy.js`
   - `chooseWorkTarget()`
   - `getRequiredBatteryForTarget()`

---

## 23. Kết luận ngắn gọn

CleanerBot không chỉ là minh họa tìm đường. Dự án gồm hai tầng bài toán:

1. **Tầng điều phối nghiệp vụ**: chọn lúc hút, đổ, sạc, chọn mục tiêu và bảo đảm pin.
2. **Tầng tìm đường**: BFS, DFS, IDS, A* hoặc IDA* tìm route đến mục tiêu; Greedy chọn từng bước cục bộ.

Khi bảo vệ, cần phân biệt rõ:

- “tìm đường tối ưu đến một mục tiêu” khác “tối ưu toàn bộ nhiệm vụ”;
- “map liên thông” khác “map khả thi về pin”;
- “Greedy né được ô vật cản kế tiếp” khác “Greedy lập được đường đi tránh vật cản”.

Ba điểm phân biệt này giải thích phần lớn hành vi và kết quả so sánh của dự án.

---

## 24. Thuật toán được code như thế nào để hoạt động trong dự án?

Phần này giải thích cách một thuật toán tìm kiếm lý thuyết được kết nối với ứng dụng và điều khiển robot thật sự.

### 24.1. Hợp đồng chung giữa Simulator và thuật toán

Mỗi thuật toán phải cung cấp hàm:

```js
nextAction(state)
```

Đầu vào `state` chứa trạng thái hiện tại:

```js
{
  robot,        // vị trí, pin, sức chứa
  map,          // kích thước, rác, vật cản, trạm sạc, thùng rác
  config,       // batteryLoss, actionCost, maxBattery
  steps,
  latestAction,
  latestLog
}
```

Đầu ra chỉ là **một action tiếp theo**:

```js
return ACTIONS.UP;
return ACTIONS.SUCK_TRASH;
return ACTIONS.CHARGE;
```

Thuật toán không trực tiếp sửa `state`. Nó chỉ đề xuất action. `Environment` mới thực thi action và cập nhật trạng thái.

Luồng gọi:

```text
Simulator
    -> algorithm.nextAction(state)
    -> nhận một action
    -> environment.applyAction(action)
    -> nhận state mới
    -> giao diện render state mới
```

Thiết kế này giúp:

- thuật toán chỉ tập trung vào quyết định;
- luật môi trường được quản lý tại một nơi;
- mọi thuật toán phải tuân theo cùng quy tắc;
- dễ thay đổi thuật toán mà không sửa Simulator hoặc Environment.

### 24.2. BaseAlgorithm chuẩn hóa cách gọi thuật toán

Các thuật toán kế thừa `BaseAlgorithm`.

```js
export class BaseAlgorithm {
  nextAction(state) {
    const startedAt = getNow();
    const action = this.computeNextAction(state);
    this.metrics.runtimeMs += getNow() - startedAt;
    return action ?? ACTIONS.STAY;
  }
}
```

`nextAction()` không chứa logic tìm đường cụ thể. Nó đóng vai trò lớp bao ngoài:

1. Đo thời gian bắt đầu.
2. Gọi `computeNextAction(state)` của thuật toán.
3. Cộng thời gian chạy vào metrics.
4. Nếu không nhận được action thì trả `STAY`.

Vì vậy, thuật toán mới chỉ cần override:

```js
computeNextAction(state)
```

hoặc kế thừa bộ điều phối của BFS rồi override hàm tìm đường.

### 24.3. Tại sao BFS vừa là thuật toán vừa là lớp nền?

`BFSAlgorithm` chứa hai nhóm logic:

#### Nhóm 1: Logic nghiệp vụ chung

- Đang đứng trên rác thì có nên hút không?
- Đã đầy rác thì có nên đến thùng rác không?
- Khi nào cần sạc?
- Mục tiêu tiếp theo là rác, thùng rác hay trạm sạc?
- Có đủ pin cho hành trình an toàn không?
- Route hiện tại còn dùng được không?
- Robot có đang lặp A-B-A-B không?

#### Nhóm 2: Logic tìm kiếm BFS

- `findNearestSafeTrashTarget()`
- `findPath()`

DFS, IDS, A* và IDA* cần cùng logic nghiệp vụ nhưng khác cách tìm đường. Vì vậy chúng kế thừa BFS và chỉ thay các hàm tìm kiếm:

```js
export class AStarAlgorithm extends BFSAlgorithm {
  findPath(state, start, goal, options = {}) {
    // Tìm đường bằng A*
  }
}
```

Khi `computeNextAction()` được kế thừa từ BFS gọi:

```js
this.findPath(state, start, goal)
```

JavaScript sẽ gọi phiên bản `findPath()` của lớp con. Đây là cơ chế đa hình giúp cùng một bộ điều phối có thể sử dụng BFS, DFS, IDS, A* hoặc IDA*.

### 24.4. Từ state đến mục tiêu

Một thuật toán không thể tìm đường nếu chưa biết cần đi đâu. Vì vậy `computeNextAction()` trước tiên xử lý các action tại chỗ:

```text
nếu đang ở thùng rác và cần đổ -> LET_TRASH_OUT
nếu đang ở trạm sạc và cần sạc -> CHARGE
nếu đang đứng trên rác và có thể hút -> SUCK_TRASH
```

Nếu không có action tại chỗ, nó gọi:

```js
const target = this.chooseWorkTarget(state);
```

`chooseWorkTarget()` quyết định mục tiêu:

- trạm sạc nếu đã hoàn thành hoặc cần sạc;
- thùng rác nếu đầy hoặc đã gom rác cuối cùng;
- một vị trí rác an toàn nếu còn khả năng thu gom.

Như vậy, code được chia thành hai bài toán con:

```text
1. Chọn mục tiêu nào?
2. Tìm đường đến mục tiêu đó bằng thuật toán nào?
```

### 24.5. Biểu diễn node và path

Trong các thuật toán, một vị trí thường có dạng:

```js
{ x: 3, y: 2 }
```

Để lưu trong `Set` hoặc `Map`, vị trí được đổi thành chuỗi:

```js
positionKey(position) {
  return `${position.x},${position.y}`;
}
```

Ví dụ:

```text
{ x: 3, y: 2 } -> "3,2"
```

Path là một mảng vị trí từ điểm bắt đầu đến đích:

```js
[
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 }
]
```

Mỗi cặp vị trí liên tiếp phải cách nhau đúng một ô theo bốn hướng.

### 24.6. Sinh các node hàng xóm

Từ một vị trí, thuật toán tạo tối đa bốn ứng viên:

```js
getMoveCandidates(position) {
  return [
    { action: ACTIONS.UP,    position: { x: position.x,     y: position.y - 1 } },
    { action: ACTIONS.RIGHT, position: { x: position.x + 1, y: position.y     } },
    { action: ACTIONS.DOWN,  position: { x: position.x,     y: position.y + 1 } },
    { action: ACTIONS.LEFT,  position: { x: position.x - 1, y: position.y     } },
  ];
}
```

Sau đó từng ứng viên được kiểm tra:

```js
if (!this.canMoveTo(state, candidate.position)) {
  continue;
}
```

`canMoveTo()` loại:

- tọa độ âm;
- tọa độ vượt kích thước map;
- ô có vật cản.

Đây là vị trí trong code nơi các thuật toán “biết” cách né vật cản.

### 24.7. Code BFS hoạt động như thế nào?

Phần cốt lõi của BFS:

```js
const queue = [
  {
    position: normalizedStart,
    path: [normalizedStart],
  },
];
const visited = new Set([this.positionKey(normalizedStart)]);

while (queue.length > 0) {
  const node = queue.shift();
  const current = node.position;

  if (samePosition(current, goal)) {
    return node.path;
  }

  for (const candidate of this.getMoveCandidates(current)) {
    const key = this.positionKey(candidate.position);

    if (visited.has(key) || !this.canMoveTo(state, candidate.position)) {
      continue;
    }

    visited.add(key);
    queue.push({
      position: candidate.position,
      path: [...node.path, candidate.position],
    });
  }
}
```

Giải thích từng bước:

1. Đưa vị trí bắt đầu vào queue.
2. Lấy node đầu queue bằng `shift()`.
3. Nếu node là đích, trả path.
4. Nếu chưa phải đích, sinh các hàng xóm.
5. Loại hàng xóm đã thăm hoặc không thể đi.
6. Đánh dấu đã thăm ngay khi đưa vào queue.
7. Tạo path mới bằng cách nối vị trí hàng xóm.
8. Đưa node mới xuống cuối queue.

Vì dùng FIFO, BFS xử lý hết các node ở khoảng cách nhỏ trước khi xử lý khoảng cách lớn.

### 24.8. Code DFS khác BFS ở đâu?

DFS sử dụng stack:

```js
const stack = [{ position: normalizedStart, path: [normalizedStart] }];

while (stack.length > 0) {
  const node = stack.pop();
  // ...
  stack.push(nextNode);
}
```

Khác biệt quan trọng:

```text
BFS: queue.shift() -> lấy node vào trước
DFS: stack.pop()   -> lấy node vào sau
```

Chỉ thay cấu trúc lấy node đã làm thay đổi hoàn toàn thứ tự tìm kiếm.

### 24.9. Code IDS hoạt động như thế nào?

IDS có vòng lặp ngoài tăng giới hạn:

```js
for (let depthLimit = 0; depthLimit <= maxDepth; depthLimit += 1) {
  const result = this.depthLimitedTraverse(..., depthLimit, ...);

  if (result) {
    return result;
  }
}
```

Hàm đệ quy giảm giới hạn sau mỗi cạnh:

```js
if (remainingDepth === 0) {
  return null;
}

const result = this.depthLimitedTraverse(
  state,
  path,
  pathSet,
  remainingDepth - 1,
  onFound
);
```

Ý nghĩa:

- Lần đầu chỉ kiểm tra node bắt đầu.
- Lần sau cho đi sâu một cạnh.
- Sau đó hai cạnh, ba cạnh...
- Khi tìm thấy đích ở giới hạn đầu tiên có lời giải, đó là độ sâu ngắn nhất.

### 24.10. Code A* hoạt động như thế nào?

A* lưu hai loại điểm:

```js
gScore.set(startKey, 0);
fScore.set(startKey, this.manhattanDistance(start, goal));
```

Mỗi vòng lặp, A* lấy node có `f` nhỏ nhất:

```js
const currentIndex = this.findLowestScoreIndex(openSet, goal, gScore, fScore);
const currentNode = openSet.splice(currentIndex, 1)[0];
```

Khi xét một hàng xóm:

```js
const tentativeGScore = currentNode.g + 1;

if (tentativeGScore >= (gScore.get(neighborKey) ?? Infinity)) {
  continue;
}

cameFrom.set(neighborKey, currentKey);
gScore.set(neighborKey, tentativeGScore);
fScore.set(
  neighborKey,
  tentativeGScore + this.manhattanDistance(neighbor.position, goal)
);
```

Giải thích:

1. `tentativeGScore` là chi phí của đường mới đến hàng xóm.
2. Nếu đường mới không tốt hơn đường đã biết, bỏ qua.
3. Nếu tốt hơn, cập nhật cha bằng `cameFrom`.
4. Cập nhật `g`.
5. Tính `f = g + Manhattan`.

Khi đến đích, `reconstructPath()` lần ngược `cameFrom` để dựng path hoàn chỉnh.

### 24.11. Code IDA* hoạt động như thế nào?

IDA* bắt đầu với:

```js
let bound = this.manhattanDistance(start, goal);
```

Tại mỗi node:

```js
const heuristic = this.manhattanDistance(current, goal);
const estimate = costSoFar + heuristic;

if (estimate > bound) {
  return estimate;
}
```

Nếu `f` vượt bound, nhánh bị cắt. Giá trị vượt bound nhỏ nhất được dùng làm bound cho lần lặp tiếp theo:

```js
if (result < nextBound) {
  nextBound = result;
}
```

Khi một nhánh tìm thấy đích, code trả symbol đặc biệt:

```js
const SEARCH_FOUND = Symbol("ida_star_found");
```

Symbol giúp phân biệt:

- “đã tìm thấy đích”;
- “chưa tìm thấy, giá trị bound tiếp theo là một số”.

### 24.12. Code Greedy hoạt động như thế nào?

Greedy không tạo open set hoặc tìm toàn bộ path. Nó chọn mục tiêu rồi gọi:

```js
return this.chooseMoveTowardTarget(state, target);
```

Hàm này sắp xếp bốn bước có thể đi:

```js
candidates.sort((a, b) => {
  return (
    this.manhattanDistance(a.position, target) -
    this.manhattanDistance(b.position, target)
  );
});
```

Sau đó chọn bước hợp lệ đầu tiên:

```js
const bestMove = candidates.find((candidate) =>
  this.canMoveTo(state, candidate.position)
);
```

Vì không lưu route hoặc visited, Greedy rất ngắn gọn nhưng có thể quay lại ô cũ và lặp.

### 24.13. Từ path thành chuyển động thật

Sau khi một thuật toán tìm được path, robot chưa di chuyển ngay toàn bộ path. Code chỉ lấy hai ô đầu:

```js
const action = this.getActionForRouteStep(route[0], route[1]);
```

Ví dụ:

```text
route[0] = { x: 2, y: 3 }
route[1] = { x: 3, y: 3 }
```

Vì `x` tăng 1, action là `RIGHT`.

Simulator gửi `RIGHT` sang Environment:

```js
const nextState = this.environment.applyAction(action);
```

Environment kiểm tra lại:

- pin còn hay không;
- ô mới có ngoài map không;
- ô mới có vật cản không.

Việc kiểm tra lại tại Environment giúp hệ thống vẫn an toàn nếu thuật toán trả action sai.

### 24.14. Tại sao mỗi bước phải tính lại quyết định?

Sau mỗi action, state có thể thay đổi:

- vị trí robot thay đổi;
- pin giảm;
- rác bị hút khỏi map;
- capacity thay đổi;
- robot có thể cần đổi mục tiêu;
- map có thể hoàn thành.

Do đó thuật toán được gọi lại ở mỗi tick. Tuy nhiên route hiện tại được cache để không phải tìm lại toàn bộ đường nếu mục tiêu và cấu trúc map chưa thay đổi.

### 24.15. Route cache hoạt động như thế nào?

Khi có route:

```js
this.cachedRoute = route;
this.cachedTargetKey = this.positionKey(target);
this.cachedMapKey = this.getStaticMapKey(state);
```

Ở tick tiếp theo, `syncCachedRoute()` kiểm tra:

1. Mục tiêu có còn giống trước không?
2. Kích thước và vật cản có thay đổi không?
3. Robot có còn nằm trên route không?

Nếu hợp lệ, nó cắt bỏ phần route robot đã đi qua:

```js
this.cachedRoute = this.cachedRoute.slice(currentIndex);
```

Nếu không hợp lệ, route bị xóa và thuật toán tìm lại.

### 24.16. Việc kiểm tra pin được gắn vào tìm kiếm như thế nào?

Khi một vị trí rác được tìm thấy, code chưa chọn ngay. Nó gọi:

```js
this.hasEnoughBatteryForTarget(state, current)
```

Hàm này tiếp tục gọi:

```js
this.getRequiredBatteryForTarget(state, target)
```

`getRequiredBatteryForTarget()` sử dụng chính `findPath()` của thuật toán để tính:

- path từ robot đến mục tiêu;
- path từ mục tiêu đến điểm thoát an toàn;
- path từ thùng rác về trạm sạc nếu cần.

Nhờ đa hình:

- BFS tính pin bằng path BFS;
- DFS tính pin bằng path DFS;
- A* tính pin bằng path A*;
- IDA* tính pin bằng path IDA*.

Đây là lý do cùng một hàm tính pin chung vẫn sử dụng đúng cách tìm đường của từng thuật toán.

### 24.17. Metrics được ghi trong code như thế nào?

Khi thuật toán mở rộng một node:

```js
this.recordNodeVisit({
  position: current,
  goal,
  g,
  h,
});
```

Khi cấu trúc tìm kiếm thay đổi:

```js
this.recordMemoryUsage(openSet.length + closedKeys.size);
```

Simulator tính pin tiêu thụ từ state thật:

```js
this.algorithm.addBatteryConsumed(
  Math.max(0, previousState.robot.battery - nextState.robot.battery)
);
```

Nhờ vậy:

- runtime được đo tại lúc thuật toán quyết định;
- visited nodes được tăng khi mở rộng node;
- memory ghi nhận kích thước cấu trúc lớn nhất;
- battery consumed lấy từ thay đổi thực tế, không chỉ từ dự đoán.

### 24.18. Cách thêm một thuật toán mới

Ví dụ tạo `UniformCostAlgorithm`:

```js
import { BFSAlgorithm } from "./bfs.js";

export class UniformCostAlgorithm extends BFSAlgorithm {
  constructor() {
    super();
    this.name = "Uniform Cost";
    this.reset();
  }

  findPath(state, start, goal, options = {}) {
    // Cài đặt Uniform Cost Search và trả về path.
  }
}
```

Sau đó đăng ký trong `registry.js`:

```js
{
  id: "uniform-cost",
  label: "Uniform Cost",
  loadClass: () =>
    import("./uniformCost.js").then((module) => module.UniformCostAlgorithm),
}
```

Nếu kế thừa `BFSAlgorithm` và override `findPath()`, thuật toán mới tự động có:

- chọn mục tiêu;
- xử lý hút/đổ/sạc;
- kiểm tra pin;
- cache route;
- chống lặp hai ô;
- metrics cơ bản.

### 24.19. Tóm tắt luồng code hoàn chỉnh

```text
Người dùng bấm Run
    ↓
Simulator.run() tạo interval
    ↓
Simulator.step()
    ↓
algorithm.nextAction(state)
    ↓
computeNextAction(state)
    ↓
chọn action tại chỗ hoặc chooseWorkTarget()
    ↓
findPath() bằng BFS/DFS/IDS/A*/IDA*, hoặc chọn bước Greedy
    ↓
kiểm tra pin và chuyển route thành action
    ↓
Environment.applyAction(action)
    ↓
Environment kiểm tra luật và tạo state mới
    ↓
Simulator ghi history, pin tiêu thụ và metrics
    ↓
Renderer cập nhật giao diện
    ↓
lặp lại cho đến khi map.done
```

Điểm cốt lõi cần trình bày khi bảo vệ:

> Thuật toán tìm kiếm không tự điều khiển toàn bộ ứng dụng. Nó là một thành phần nhận state và trả một action. Simulator điều phối vòng lặp, Environment thi hành luật, còn Renderer hiển thị kết quả. Các lớp kế thừa thay đổi cách tìm path nhưng tái sử dụng bộ điều phối nghiệp vụ chung.
