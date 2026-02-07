import { AppLogger, LogLevel } from "../logger";

describe("AppLogger (Client)", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    // Reset level to default (DEBUG in dev)
    AppLogger.setLevel(LogLevel.DEBUG);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should log info messages in development", () => {
    AppLogger.log("test message");
    expect(consoleLogSpy).toHaveBeenCalled();
    const callArgs = consoleLogSpy.mock.calls[0];
    expect(callArgs[0]).toContain("[INFO] test message");
  });

  it("should format messages with timestamps", () => {
    const mockDate = new Date("2023-01-01T00:00:00.000Z");
    jest.useFakeTimers().setSystemTime(mockDate);

    AppLogger.log("test message");

    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleLogSpy.mock.calls[0][0]).toContain(
      "2023-01-01T00:00:00.000Z",
    );

    jest.useRealTimers();
  });

  it("should use custom prefix", () => {
    AppLogger.log("test message", undefined, "CustomPrefix");
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleLogSpy.mock.calls[0][0]).toContain("[CustomPrefix]");
  });

  it("should not log info if level is set to WARN", () => {
    AppLogger.setLevel(LogLevel.WARN);
    AppLogger.log("should not see this");
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("should log errors even if level is WARN", () => {
    AppLogger.setLevel(LogLevel.WARN);
    AppLogger.error("error message");
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("[ERROR] error message");
  });

  it("should not log errors if level is SILENT", () => {
    AppLogger.setLevel(LogLevel.SILENT);
    AppLogger.error("should not see this");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should handle structured error objects", () => {
    const structuredError = {
      message: "DB Error",
      details: "Connection failed",
      code: "500",
      hint: "Check network",
    };

    AppLogger.error("Database failure", structuredError);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Database failure"),
      expect.objectContaining({
        message: "DB Error",
        details: "Connection failed",
        hint: "Check network",
      }),
    );
  });
});
