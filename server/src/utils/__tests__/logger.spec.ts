import { AppLogger, LogLevel } from "../logger";

describe("AppLogger (Server)", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    AppLogger.setLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should log info messages", () => {
    AppLogger.log("server test");
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleLogSpy.mock.calls[0][0]).toContain(
      "[Server] [INFO] server test",
    );
  });

  it("should respect log levels", () => {
    AppLogger.setLevel(LogLevel.ERROR);
    AppLogger.log("should be ignored");
    AppLogger.error("should be logged");

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should format with custom prefix", () => {
    AppLogger.log("test", undefined, "API");
    expect(consoleLogSpy.mock.calls[0][0]).toContain("[API]");
  });

  it("should handle error objects with metadata", () => {
    const errorObj = { code: "E_TEST", message: "Something went wrong" };
    AppLogger.error("Operation failed", errorObj);

    expect(consoleErrorSpy).toHaveBeenCalled();
    // The implementation might handle objects specifically
  });
});
