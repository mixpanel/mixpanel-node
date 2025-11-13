const async_all = require("../lib/utils").async_all;

describe("async_all", () => {
  it("calls callback with empty results if no requests", (done) => {
    const requests = [];
    const handler_fn = vi.fn((_, cb) => cb());
    const callback = vi.fn();

    async_all(requests, handler_fn, callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("runs handler for each request and calls callback with results", () => {
    const requests = [1, 2, 3];
    const handler_fn = vi
      .fn()
      .mockImplementationOnce((_, cb) => cb(null, 4))
      .mockImplementationOnce((_, cb) => cb(null, 5))
      .mockImplementationOnce((_, cb) => cb(null, 6));

    const callback = vi.fn();

    async_all(requests, handler_fn, callback);
    expect(handler_fn).toHaveBeenCalledTimes(requests.length);
    expect(handler_fn.mock.calls[0][0]).toBe(1);
    expect(handler_fn.mock.calls[1][0]).toBe(2);
    expect(handler_fn.mock.calls[2][0]).toBe(3);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null, [4, 5, 6]);
  });

  it("calls callback with errors and results from handler", () => {
    const requests = [1, 2, 3];
    const handler_fn = vi
      .fn()
      .mockImplementationOnce((_, cb) => cb("error1", null))
      .mockImplementationOnce((_, cb) => cb("error2", null))
      .mockImplementationOnce((_, cb) => cb(null, 6));
    const callback = vi.fn();

    async_all(requests, handler_fn, callback);
    expect(handler_fn).toHaveBeenCalledTimes(requests.length);
    expect(handler_fn.mock.calls[0][0]).toBe(1);
    expect(handler_fn.mock.calls[1][0]).toBe(2);
    expect(handler_fn.mock.calls[2][0]).toBe(3);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      ["error1", "error2"],
      [null, null, 6],
    );
  });
});
