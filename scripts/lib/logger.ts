/**
 * Tiny line-prefixed console logger used by the scraper sources and the
 * orchestrator. Kept as a dependency-free module so it works in both
 * Node 20 and the GitHub Actions runner without extra packages.
 *
 * All lines are prefixed with `[scrape]` so the GitHub Actions log is
 * easy to filter. Verbose lines (fetched URLs, per-restaurant debug
 * info) are gated behind `verbose` so the default log stays compact.
 */
export interface ScraperLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
  verbose(message: string): void;
  child(prefix: string): ScraperLogger;
}

const ROOT = "[scrape]";

function pad(prefix: string): string {
  return `[${prefix}]`;
}

function line(level: string, root: string, message: string): void {
  const stream =
    level === "error" ? process.stderr : process.stdout;
  stream.write(`${root} ${level} ${message}\n`);
}

function makeLogger(
  root: string,
  verboseEnabled: boolean,
): ScraperLogger {
  return {
    info(message) {
      line("info", root, message);
    },
    warn(message) {
      line("warn", root, message);
    },
    error(message) {
      line("error", root, message);
    },
    success(message) {
      line("ok  ", root, message);
    },
    verbose(message) {
      if (verboseEnabled) line("v   ", root, message);
    },
    child(prefix) {
      return makeLogger(pad(prefix), verboseEnabled);
    },
  };
}

/**
 * Create the root logger. Pass `--verbose` on the CLI to enable the
 * `verbose()` channel.
 */
export function createLogger(verbose: boolean): ScraperLogger {
  return makeLogger(ROOT, verbose);
}