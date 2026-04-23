import json
import os
from dataclasses import dataclass
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from manim import (
    BLACK,
    BLUE_B,
    DecimalNumber,
    Dot,
    FadeIn,
    ImageMobject,
    ValueTracker,
    rate_functions,
    Scene,
    Text,
    VGroup,
    WHITE,
    RED,
)


@dataclass
class FunctionSpec:
    x_min: float
    x_max: float
    y_min: float
    y_max: float
    minimum: tuple[float, float]


def ackley(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    return (
        -20 * np.exp(-0.2 * np.sqrt(0.5 * (x * x + y * y)))
        - np.exp(0.5 * (np.cos(2 * np.pi * x) + np.cos(2 * np.pi * y)))
        + np.e
        + 20
    )


def rosenbrock(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    return (1 - x) ** 2 + 100 * (y - x**2) ** 2


def get_function(function_name: str):
    if function_name == "rosenbrock":
        return rosenbrock, FunctionSpec(-2.0, 2.0, -1.0, 3.0, (1.0, 1.0))
    return ackley, FunctionSpec(-5.0, 5.0, -5.0, 5.0, (0.0, 0.0))


def objective_values(func, positions: np.ndarray) -> np.ndarray:
    with np.errstate(over="ignore", invalid="ignore"):
        values = func(positions[:, 0], positions[:, 1])
    return np.nan_to_num(values, nan=np.inf, posinf=np.inf, neginf=np.inf)


def run_pso(config: dict) -> tuple[np.ndarray, FunctionSpec, np.ndarray]:
    f, spec = get_function(config["function_name"])
    rng = np.random.default_rng(config["seed"])

    n = config["particles"]
    iters = config["iterations"]
    w = config["inertia_weight"]
    c1 = config["cognitive_factor"]
    c2 = config["social_factor"]
    x_span = spec.x_max - spec.x_min
    y_span = spec.y_max - spec.y_min
    lower_bounds = np.array([spec.x_min, spec.y_min], dtype=float)
    upper_bounds = np.array([spec.x_max, spec.y_max], dtype=float)

    pos = np.column_stack(
        (
            rng.uniform(spec.x_min, spec.x_max, size=n),
            rng.uniform(spec.y_min, spec.y_max, size=n),
        )
    )
    vel = np.column_stack(
        (
            rng.uniform(-0.1 * x_span, 0.1 * x_span, size=n),
            rng.uniform(-0.1 * y_span, 0.1 * y_span, size=n),
        )
    )

    pbest = pos.copy()
    pbest_val = objective_values(f, pos)
    g_idx = np.argmin(pbest_val)
    gbest = pbest[g_idx].copy()
    gbest_val = pbest_val[g_idx]

    trajectory = [pos.copy()]
    gbest_trajectory = [np.array([gbest[0], gbest[1], gbest_val], dtype=float)]
    for _ in range(iters):
        r1 = rng.random((n, 2))
        r2 = rng.random((n, 2))
        vel = w * vel + c1 * r1 * (pbest - pos) + c2 * r2 * (gbest - pos)
        pos = pos + vel
        pos = np.clip(pos, lower_bounds, upper_bounds)

        values = objective_values(f, pos)
        improved = values < pbest_val
        pbest[improved] = pos[improved]
        pbest_val[improved] = values[improved]

        g_idx = np.argmin(pbest_val)
        gbest = pbest[g_idx].copy()
        gbest_val = pbest_val[g_idx]
        trajectory.append(pos.copy())
        gbest_trajectory.append(np.array([gbest[0], gbest[1], gbest_val], dtype=float))

    return np.array(trajectory), spec, np.array(gbest_trajectory)


def build_heatmap(function_name: str, spec: FunctionSpec, output_path: Path) -> None:
    f, _ = get_function(function_name)

    x = np.linspace(spec.x_min, spec.x_max, 420)
    y = np.linspace(spec.y_min, spec.y_max, 420)
    xx, yy = np.meshgrid(x, y)
    zz = f(xx, yy)
    zz = np.log1p(zz - zz.min())

    fig, ax = plt.subplots(figsize=(6.2, 6.2), dpi=170)
    ax.contourf(xx, yy, zz, levels=55, cmap="inferno")
    ax.contour(xx, yy, zz, levels=24, linewidths=0.35, colors="white", alpha=0.35)
    ax.set_axis_off()
    fig.tight_layout(pad=0)
    fig.savefig(output_path, bbox_inches="tight", pad_inches=0)
    plt.close(fig)


class PSOScene(Scene):
    def construct(self):
        self.camera.background_color = WHITE
        cfg_path = os.environ.get("PSO_CONFIG_PATH")
        if not cfg_path:
            raise RuntimeError("PSO_CONFIG_PATH ist nicht gesetzt.")

        with open(cfg_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        trajectory, spec, gbest_trajectory = run_pso(config)
        bg_path = Path(cfg_path).with_suffix(".png")
        build_heatmap(config["function_name"], spec, bg_path)

        plane_size = 6.8
        left_offset = -2.2

        bg = ImageMobject(str(bg_path)).set_width(plane_size).move_to([left_offset, 0, 0])
        self.add(bg)

        min_x, min_y = spec.minimum

        def map_point(x_val: float, y_val: float) -> np.ndarray:
            nx = (x_val - spec.x_min) / (spec.x_max - spec.x_min)
            ny = (y_val - spec.y_min) / (spec.y_max - spec.y_min)
            px = left_offset - plane_size / 2 + nx * plane_size
            py = -plane_size / 2 + ny * plane_size
            return np.array([px, py, 0.0])

        min_dot = Dot(point=map_point(min_x, min_y), radius=0.08, color=RED)

        particles = VGroup(
            *[
                Dot(point=map_point(p[0], p[1]), radius=0.06, color=BLUE_B)
                for p in trajectory[0]
            ]
        )

        title = Text(f"Function: {config['function_name'].capitalize()}", color=BLACK).scale(0.55)
        title.to_edge([1, 0, 0], buff=0.7).shift([0, 1.2, 0])
        info = Text(
            f"Particles: {config['particles']}    Iterations: {config['iterations']}",
            color=BLACK,
        ).scale(0.35)
        info.next_to(title, direction=[0, -1, 0], buff=0.35)
        params = Text(
            f"w={config['inertia_weight']:.2f}  c1={config['cognitive_factor']:.2f}  c2={config['social_factor']:.2f}",
            color=BLACK,
        ).scale(0.33)
        params.next_to(info, direction=[0, -1, 0], buff=0.25)

        gbest_label = Text("Global best:", color=BLACK).scale(0.33)
        gbest_val_tracker = ValueTracker(float(gbest_trajectory[0, 2]))
        gbest_val_prefix = Text("f(x*)=", color=BLACK).scale(0.33)
        gbest_val_value = DecimalNumber(
            gbest_val_tracker.get_value(),
            num_decimal_places=5,
            include_sign=False,
            mob_class=Text,
            color=BLACK,
        ).scale(0.33)
        gbest_val_value.add_updater(lambda m: m.set_value(gbest_val_tracker.get_value()))

        gbest_row = VGroup(gbest_label, gbest_val_prefix, gbest_val_value).arrange([1, 0, 0], buff=0.13)
        gbest_row.next_to(params, direction=[0, -1, 0], buff=0.3)

        legend_particle = Dot(radius=0.08, color=BLUE_B)
        legend_min = Dot(radius=0.08, color=RED)
        legend_text1 = Text("Particle", color=BLACK).scale(0.4)
        legend_text2 = Text("Global minimum", color=BLACK).scale(0.4)
        legend_row1 = VGroup(legend_particle, legend_text1).arrange([1, 0, 0], buff=0.2)
        legend_row2 = VGroup(legend_min, legend_text2).arrange([1, 0, 0], buff=0.2)
        legend = VGroup(legend_row1, legend_row2).arrange([0, -1, 0], aligned_edge=[-1, 0, 0], buff=0.25)
        legend.next_to(gbest_row, direction=[0, -1, 0], buff=0.4)

        self.play(
            FadeIn(min_dot),
            FadeIn(particles),
            FadeIn(title),
            FadeIn(info),
            FadeIn(params),
            FadeIn(gbest_row),
            FadeIn(legend),
        )

        total_steps = trajectory.shape[0]
        travel_steps = max(1, total_steps - 1)
        target_duration = 16.0
        step_runtime = max(0.08, min(0.24, target_duration / travel_steps))
        for t in range(1, total_steps):
            anims = [particles[i].animate.move_to(map_point(trajectory[t, i, 0], trajectory[t, i, 1])) for i in range(len(particles))]
            anims.append(gbest_val_tracker.animate.set_value(float(gbest_trajectory[t, 2])))
            self.play(*anims, run_time=step_runtime, rate_func=rate_functions.ease_in_out_sine)

        self.wait(1.2)
        if bg_path.exists():
            bg_path.unlink()
