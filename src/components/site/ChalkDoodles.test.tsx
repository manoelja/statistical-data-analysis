import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../../styles/global.css";
import { ChalkDoodles } from "./ClalkDoodles";

describe("ChalkDoodles", () => {
  it("renderiza o fundo chalk-bg", () => {
    render(<ChalkDoodles />);

    const { container } = render(<ChalkDoodles />);
    const root = container.querySelector(".chalk-bg");
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root?.className).toContain("chalk-bg");

    // a regra vem do global.css (.chalk-bg { pointer-events: none })
    expect(getComputedStyle(root as Element).pointerEvents).toBe("none");
  });

  it("desenha os 43 doodles com o filtro de giz aplicado", () => {
    const { container } = render(<ChalkDoodles />);
    const doodles = container.querySelectorAll(".chalk-doodle");
    expect(doodles).toHaveLength(43);
  });
});
