from dataclasses import dataclass
from typing import Iterable


# Models.py: chua DU LIEU co ban

Position = tuple[int, int]

DIRECTIONS = {
    "UP": (-1, 0),
    "DOWN": (1, 0),
    "LEFT": (0, -1),
    "RIGHT": (0, 1),
}

@dataclass
class Config:
    size: int = 8
    dirt_probability: float = 0.2
    obstacle_probability: float = 0.12
    battery_enabled: bool = False
    battery_capacity: int = 80

# Dataclass giup tu dong tao cac ham vi du nhu __init__, __repr__ ...... tuc la tao cac ham khoi tao
# Class stepresult giup bieu dien ket qua sau mot buoc hanh dong cua robot
@dataclass
class StepResult:
    action: str             # Robot vua di sang huong nao
    position: Position      # Vi tri (x, y) dang dung hien tai
    cost: int               # Buoc nay ton cost la bao nhieu
    cleaned: bool           # Co don rac hay khong
    done: bool              # Da ket thuc hay chua
    message: str = ""       # Message


# Class nay kiem tra mot vi tri co nam trong map hay khong
def in_bounds(pos: Position, size: int) -> bool:
    r, c = pos
    return 0 <= r < size and 0 <= c < size


# Sinh ra cac o hang xom hop le ma robot co the di toi
def neighbors(pos: Position, size: int) -> Iterable[tuple[str, Position]]:
    r, c = pos      # Vi tri hien tai theo hang va cot
    
    # Duyet qua tung huong thong qua dictionary Directions
    for action, (dr, dc) in DIRECTIONS.items():
        nr, nc = r + dr, c + dc

        # Neu thoa man dieu kien co the di, sinh tung phan tu mot thong qua "yield"
        if 0 <= nr < size and 0 <= nc < size:
            yield action, (nr, nc)