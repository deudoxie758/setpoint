import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "@/components/FilterBar";
import { ClipFilters, Player } from "@/lib/types";

const players: Player[] = [
  { id: "p1", name: "Jane Doe", position: null, graduationYear: null, createdAt: "2026-01-01" },
];

function ControlledFilterBar({
  initial,
  onChange,
}: {
  initial: ClipFilters;
  onChange: (filters: ClipFilters) => void;
}) {
  const [filters, setFilters] = useState<ClipFilters>(initial);
  return (
    <FilterBar
      players={players}
      filters={filters}
      onChange={(next) => {
        setFilters(next);
        onChange(next);
      }}
    />
  );
}

describe("FilterBar", () => {
  it("calls onChange with the selected player id", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FilterBar players={players} filters={{}} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Filter by player"), "p1");

    expect(onChange).toHaveBeenCalledWith({ playerId: "p1" });
  });

  it("calls onChange with the selected skill, preserving existing filters", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<FilterBar players={players} filters={{ playerId: "p1" }} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Filter by skill"), "SPIKE");

    expect(onChange).toHaveBeenCalledWith({ playerId: "p1", skill: "SPIKE" });
  });

  it("calls onChange with the accumulated opponent text as it's typed", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ControlledFilterBar initial={{}} onChange={onChange} />);

    await user.type(screen.getByLabelText("Filter by opponent"), "Riv");

    expect(onChange).toHaveBeenLastCalledWith({ opponent: "Riv" });
  });
});
