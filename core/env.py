from __future__ import annotations

import random
from dataclasses import dataclass, field

from .models import Config, Position, in_bounds


@dataclass
class GridEnvironment:
    config: Config
    robot_pos: Position = (0, 0)
    dock_pos: Position = (0, 0)
    obstacles: set[Position] = field(default_factory=set)
    dirts: set[Position] = field(default_factory=set)
    total_cost: int = 0
    steps: int = 0
    battery: int = 0

    def __post_init__(self) -> None:
        self.battery = self.config.battery_capacity

    @classmethod
    def random(cls, config: Config, seed: int | None = None) -> "GridEnvironment":
        rng = random.Random(seed)
        env = cls(config=config)
        size = config.size

        env.dock_pos = (0, 0)
        env.robot_pos = env.dock_pos

        for r in range(size):
            for c in range(size):
                pos = (r, c)
                if pos == env.dock_pos:
                    continue
                if rng.random() < config.obstacle_probability:
                    env.obstacles.add(pos)
                    continue
                if rng.random() < config.dirt_probability:
                    env.dirts.add(pos)

        if not env.dirts:
            for r in range(size):
                for c in range(size):
                    pos = (r, c)
                    if pos != env.dock_pos and pos not in env.obstacles:
                        env.dirts.add(pos)
                        return env
        return env

    @classmethod
    def from_layout(cls, config: Config, layout: list[list[str]]) -> "GridEnvironment":
        env = cls(config=config)
        size = len(layout)

        if size == 0:
            raise ValueError("Layout must not be empty")

        env.config.size = size

        robot_found = False
        dock_found = False

        for r in range(size):
            if len(layout[r]) != size:
                raise ValueError("Layout must be a square grid")

            for c in range(size):
                cell = layout[r][c]
                pos = (r, c)

                if cell == "obstacle":
                    env.obstacles.add(pos)
                elif cell == "dirt":
                    env.dirts.add(pos)
                elif cell == "robot":
                    if robot_found:
                        raise ValueError("Only one robot is allowed")
                    env.robot_pos = pos
                    robot_found = True
                elif cell == "dock":
                    if dock_found:
                        raise ValueError("Only one dock is allowed")
                    env.dock_pos = pos
                    dock_found = True
                elif cell == "robot+dock":
                    if robot_found or dock_found:
                        raise ValueError("Only one robot and one dock are allowed")
                    env.robot_pos = pos
                    env.dock_pos = pos
                    robot_found = True
                    dock_found = True
                elif cell == "empty":
                    pass
                else:
                    raise ValueError(f"Unknown cell type: {cell}")

        if not dock_found:
            env.dock_pos = (0, 0)

        if not robot_found:
            env.robot_pos = env.dock_pos

        if env.robot_pos in env.obstacles:
            raise ValueError("Robot cannot stand on obstacle")

        if env.dock_pos in env.obstacles:
            raise ValueError("Dock cannot stand on obstacle")

        return env

    def is_walkable(self, pos: Position) -> bool:
        return in_bounds(pos, self.config.size) and pos not in self.obstacles

    def move_robot(self, new_pos: Position) -> bool:
        if not self.is_walkable(new_pos):
            return False
        self.robot_pos = new_pos
        self.steps += 1
        self.total_cost += 1
        if self.config.battery_enabled:
            self.battery = max(0, self.battery - 1)
        return True

    def clean_current_cell(self) -> bool:
        if self.robot_pos in self.dirts:
            self.dirts.remove(self.robot_pos)
            return True
        return False

    def is_done(self) -> bool:
        if self.config.battery_enabled and self.battery == 0 and self.robot_pos != self.dock_pos:
            return True
        return len(self.dirts) == 0

    def to_dict(self) -> dict:
        return {
            "size": self.config.size,
            "robot": list(self.robot_pos),
            "dock": list(self.dock_pos),
            "obstacles": [list(x) for x in sorted(self.obstacles)],
            "dirts": [list(x) for x in sorted(self.dirts)],
            "total_cost": self.total_cost,
            "steps": self.steps,
            "battery_enabled": self.config.battery_enabled,
            "battery": self.battery,
            "battery_capacity": self.config.battery_capacity,
            "done": self.is_done(),
        }