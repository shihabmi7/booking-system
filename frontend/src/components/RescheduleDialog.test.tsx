import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RescheduleDialog from "./RescheduleDialog";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const baseProps = {
  onClose: vi.fn(),
  authFetch: vi.fn(),
  basePath: "/api/bookings",
  bookingRef: "REF123",
  resourceId: "resource-1",
  serviceId: "service-1",
  currentStartTime: "2026-09-01T09:30:00.000Z",
  onRescheduled: vi.fn(),
};

beforeEach(() => {
  vi.restoreAllMocks();
  baseProps.onClose.mockReset();
  baseProps.authFetch.mockReset();
  baseProps.onRescheduled.mockReset();
});

function slotsResponse(times: string[]) {
  return {
    ok: true,
    json: async () => ({ slots: times.map((t) => ({ startTime: t, endTime: t })) }),
  };
}

describe("RescheduleDialog", () => {
  it("loads and displays available slots for the default (today's) date on open", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(slotsResponse(["2026-09-01T09:00:00.000Z"])));

    render(<RescheduleDialog {...baseProps} open />);

    expect(await screen.findByText(/09:00/)).toBeInTheDocument();
  });

  it("shows the closure note instead of slots when the resource is closed that day", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ slots: [], note: "Closed: Staff Training Day" }) })
    );

    render(<RescheduleDialog {...baseProps} open />);

    expect(await screen.findByText("Closed: Staff Training Day")).toBeInTheDocument();
  });

  it("confirming a selected slot PATCHes the reschedule endpoint and reports the new time back", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(slotsResponse(["2026-09-01T10:00:00.000Z"])));
    baseProps.authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startTime: "2026-09-01T10:00:00.000Z" }),
    });

    render(<RescheduleDialog {...baseProps} open />);

    const slot = await screen.findByText(/10:00/);
    await user.click(slot);
    await user.click(screen.getByRole("button", { name: /confirm new time/i }));

    await waitFor(() => expect(baseProps.onRescheduled).toHaveBeenCalledWith({ startTime: "2026-09-01T10:00:00.000Z" }));
    expect(baseProps.authFetch).toHaveBeenCalledWith(
      "/api/bookings/REF123/reschedule",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ startTime: "2026-09-01T10:00:00.000Z" }),
      })
    );
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("surfaces the server's error message and leaves the dialog open when the PATCH fails", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(slotsResponse(["2026-09-01T10:00:00.000Z"])));
    baseProps.authFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "That slot was just booked by someone else. Please pick another." }),
    });

    render(<RescheduleDialog {...baseProps} open />);
    await user.click(await screen.findByText(/10:00/));
    await user.click(screen.getByRole("button", { name: /confirm new time/i }));

    expect(await screen.findByText(/just booked by someone else/)).toBeInTheDocument();
    expect(baseProps.onClose).not.toHaveBeenCalled();
  });

  // Regression test for the exact bug fixed in this component: a native date input fires
  // onChange once per completed segment, so typing a new date can dispatch a request for an
  // in-progress (earlier) date before the final one goes out. Without the `cancelled` guard,
  // whichever response arrives LAST wins — even if it's the stale one — and the dialog would
  // show slots for a date that no longer matches what's typed in the field.
  it("ignores a stale slots response that resolves after a newer request has already returned", async () => {
    // Three requests total: the initial mount fetch (today's default date), then one per
    // fireEvent.change below — each consumed strictly in call order regardless of when it
    // actually resolves, which is what lets this test control the resolution order below.
    const mountRequest = deferred<Response>();
    const firstChangeRequest = deferred<Response>();
    const secondChangeRequest = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mountRequest.promise)
      .mockImplementationOnce(() => firstChangeRequest.promise)
      .mockImplementationOnce(() => secondChangeRequest.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<RescheduleDialog {...baseProps} open />);

    const dateInput = screen.getByLabelText(/new date/i);
    fireEvent.change(dateInput, { target: { value: "2026-09-02" } });
    // Second date change fires before the first change's request has resolved at all.
    fireEvent.change(dateInput, { target: { value: "2026-09-03" } });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    mountRequest.resolve(slotsResponse([]) as unknown as Response); // irrelevant to this test

    // Resolve OUT OF ORDER: the LATEST request (Sept 3) finishes first, then the stale
    // Sept 2 request finishes after it — the exact ordering that broke this before the fix.
    secondChangeRequest.resolve(slotsResponse(["2026-09-03T14:00:00.000Z"]) as unknown as Response);
    await screen.findByText(/02:00 PM/);

    firstChangeRequest.resolve(slotsResponse(["2026-09-02T09:00:00.000Z"]) as unknown as Response);

    // Give the stale response's .then() a turn to run (and be dropped) before asserting.
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByText(/02:00 PM/)).toBeInTheDocument();
    expect(screen.queryByText(/09:00 AM/)).not.toBeInTheDocument();
  });
});
